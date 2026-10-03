// Server-only helpers shared by the workspace chat API routes.
//
// Messages are written here first and then broadcast over Supabase Realtime by
// the server. The database is the source of truth: what was saved is
// exactly what was broadcast, and a message can't be lost from history because
// the sender's tab closed between "sent live" and "archived".

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { consumeRateLimits, rateLimitedResponse, type RateLimitRule } from '@/lib/api/rate-limit'
import type { Role } from '@/lib/workspace'
import { chatRoomTopic, chatSignalChannel } from '@/lib/chatRooms'

/* ─── Limits ──────────────────────────────────────────────────────────────── */

export const MAX_MESSAGE_LENGTH = 4000
export const MAX_CHANNEL_NAME = 80
export const MAX_CHANNEL_DESCRIPTION = 500
export const MAX_FILE_NAME = 255

const CHAT_RATE_LIMITS = {
  message: { bucket: 'chat:message', limit: 120, windowMs: 60 * 1000, windowLabel: 'minute' },
  upload: { bucket: 'chat:upload', limit: 30, windowMs: 60 * 60 * 1000, windowLabel: 'hour' },
  channel: { bucket: 'chat:channel', limit: 20, windowMs: 60 * 60 * 1000, windowLabel: 'hour' },
  reaction: { bucket: 'chat:reaction', limit: 240, windowMs: 60 * 1000, windowLabel: 'minute' },
} satisfies Record<string, RateLimitRule>

const RATE_LIMIT_NOUNS = {
  message: { noun: 'message', verb: 'send' },
  upload: { noun: 'upload', verb: 'make' },
  channel: { noun: 'channel', verb: 'create' },
  reaction: { noun: 'reaction', verb: 'add' },
} as const

/** Returns a 429 response when over the limit, otherwise null (and records the use). */
export async function chatRateLimit(kind: keyof typeof CHAT_RATE_LIMITS, userId: string) {
  const result = await consumeRateLimits([{ subject: `user:${userId}`, rule: CHAT_RATE_LIMITS[kind] }])
  return result.allowed ? null : rateLimitedResponse(result, 1, RATE_LIMIT_NOUNS[kind])
}

/* ─── Access ──────────────────────────────────────────────────────────────── */

export interface ChatAccess {
  userId: string
  workspaceId: string
  role: Role
  isOwner: boolean
  /** Viewers can read but not post, upload, react or create channels. */
  canWrite: boolean
  /** Owner and admins can delete or pin anyone's messages and manage any channel. */
  canModerate: boolean
}

type AccessResult = { access: ChatAccess } | { error: NextResponse }

const fail = (error: string, status: number) => ({ error: NextResponse.json({ error }, { status }) })

/** Session + workspace membership + role, in one place for every chat route. */
export async function getChatAccess(workspaceId: string, opts: { write?: boolean } = {}): Promise<AccessResult> {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return fail('Unauthorized', 401)

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true, members: { where: { userId }, select: { role: true }, take: 1 } },
  })
  if (!workspace) return fail('Forbidden', 403)

  const isOwner = workspace.ownerId === userId
  const memberRole = workspace.members[0]?.role
  if (!isOwner && !memberRole) return fail('Forbidden', 403)

  const role: Role = isOwner ? 'owner' : (['admin', 'member', 'viewer'].includes(memberRole!) ? memberRole : 'member') as Role
  const access: ChatAccess = {
    userId,
    workspaceId,
    role,
    isOwner,
    canWrite: role !== 'viewer',
    canModerate: role === 'owner' || role === 'admin',
  }
  if (opts.write && !access.canWrite) return fail('You have view-only access to this workspace', 403)
  return { access }
}

/** Visibility filter: public channels, plus private ones the user belongs to (owners see all). */
export function visibleChannelWhere(access: ChatAccess): Prisma.ChannelWhereInput {
  if (access.isOwner) return { workspaceId: access.workspaceId }
  return {
    workspaceId: access.workspaceId,
    OR: [{ isPrivate: false }, { members: { some: { userId: access.userId } } }],
  }
}

/** The channel if this user may see it, otherwise null (callers answer 404, not 403). */
export function findVisibleChannel(access: ChatAccess, channelId: string) {
  return prisma.channel.findFirst({ where: { id: channelId, ...visibleChannelWhere(access) } })
}

/** Ids of every channel the user can see; used for search. */
export async function visibleChannelIds(access: ChatAccess): Promise<string[]> {
  const rows = await prisma.channel.findMany({ where: visibleChannelWhere(access), select: { id: true } })
  return rows.map(r => r.id)
}

/* ─── Validation ──────────────────────────────────────────────────────────── */

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null
  } catch {
    return null
  }
}

export const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

/** Lowercase, hyphenated, a-z0-9 only. Empty result means the name was unusable. */
export function slugifyChannelName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_CHANNEL_NAME)
}

/** A file path is only accepted if it is inside this workspace's folder of the chat bucket. */
export function isWorkspaceFilePath(workspaceId: string, path: unknown): path is string {
  return (
    typeof path === 'string' &&
    path.startsWith(`${workspaceId}/`) &&
    /^[A-Za-z0-9_-]+\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/.test(path)
  )
}

/* ─── Serialization ───────────────────────────────────────────────────────── */

export const messageInclude = {
  user: { select: { id: true, name: true, email: true } },
  reactions: { select: { emoji: true, userId: true } },
  _count: { select: { replies: { where: { deletedAt: null } } } },
} satisfies Prisma.MessageInclude

export type MessageWithRelations = Prisma.MessageGetPayload<{ include: typeof messageInclude }>

/** Shape sent to the browser (REST responses and realtime broadcasts alike). */
export function presentMessage(m: MessageWithRelations) {
  const deleted = !!m.deletedAt
  const reactions: Record<string, string[]> = {}
  if (!deleted) {
    for (const r of m.reactions) (reactions[r.emoji] ??= []).push(r.userId)
  }
  return {
    id: m.id,
    content: deleted ? '' : m.content,
    userId: m.userId,
    workspaceId: m.workspaceId,
    channelId: m.channelId,
    parentId: m.parentId,
    // Private files are served through the signed-URL route; legacy rows keep their URL.
    fileUrl: deleted
      ? null
      : m.filePath
        ? `/api/workspaces/${m.workspaceId}/chat/files/${m.id}`
        : m.fileUrl,
    fileName: deleted ? null : m.fileName,
    fileType: deleted ? null : m.fileType,
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt?.toISOString() ?? null,
    deletedAt: m.deletedAt?.toISOString() ?? null,
    pinnedAt: m.pinnedAt?.toISOString() ?? null,
    pinnedById: m.pinnedById,
    replyCount: m._count.replies,
    reactions,
    user: m.user,
  }
}

export type PresentedMessage = ReturnType<typeof presentMessage>

/* ─── Realtime (server-side publishing) ──────────────────────────────────── */

/** What a chat channel's topic carries in its `message` event. */
export type ChatMessageEvent = {
  kind: 'created' | 'updated' | 'deleted'
  message: PresentedMessage
  /** Lets the sender's tab swap its optimistic bubble for the saved message. */
  clientMsgId?: string
}

/**
 * Broadcast on a private Supabase Realtime topic via `realtime.send`. Only the
 * server writes messages and signals; RLS stops clients from doing the same.
 */
async function broadcast(topic: string, event: string, payload: unknown) {
  await prisma.$executeRaw`select realtime.send(${JSON.stringify(payload)}::jsonb, ${event}, ${topic}, true)`
}

// Thread replies stay out of the channel topic; the thread panel follows them via signals.
const roomOf = (m: PresentedMessage) =>
  m.channelId && !m.parentId ? chatRoomTopic(m.workspaceId, m.channelId) : null

/** Publish a saved message into its channel's topic. */
export async function publishChatMessage(m: PresentedMessage, clientMsgId: string | undefined) {
  const topic = roomOf(m)
  if (topic) await broadcast(topic, 'message', { kind: 'created', message: m, clientMsgId } satisfies ChatMessageEvent)
}

/** Mirror an edit into the topic so open clients update in place. */
export async function publishChatEdit(m: PresentedMessage) {
  const topic = roomOf(m)
  if (topic) await broadcast(topic, 'message', { kind: 'updated', message: m } satisfies ChatMessageEvent)
}

/** Mirror a delete into the topic. `m` is the already-tombstoned message. */
export async function publishChatDelete(m: PresentedMessage) {
  const topic = roomOf(m)
  if (topic) await broadcast(topic, 'message', { kind: 'deleted', message: m } satisfies ChatMessageEvent)
}

export type ChatSignal =
  | { type: 'message'; channelId: string; messageId: string; userId: string; parentId: string | null }
  | { type: 'message-changed'; channelId: string; messageId: string; parentId: string | null }
  | { type: 'channels-changed' }

/**
 * Lightweight workspace-wide events (unread bumps, reactions, pins, thread
 * replies, channel list changes). Receivers only use them as a cue to refetch
 * from the API, so they carry ids, never content.
 */
export async function publishSignal(workspaceId: string, signal: ChatSignal) {
  await broadcast(chatSignalChannel(workspaceId), 'signal', signal)
}

/** Realtime failures must not fail the request: the message is already saved. */
export function logRealtimeError(context: string) {
  return (err: unknown) => console.error(`[chat] ${context} failed:`, err instanceof Error ? err.message : err)
}

/* ─── Files ───────────────────────────────────────────────────────────────── */

// Shared with CRM prospect files (src/lib/uploads.ts)
export { UPLOAD_FILE_TYPES as CHAT_FILE_TYPES, MAX_UPLOAD_SIZE as MAX_FILE_SIZE } from '@/lib/uploads'

/* ─── Cursors ─────────────────────────────────────────────────────────────── */

// Pagination cursors are "createdAt|id": createdAt alone can tie at a page
// boundary, which used to drop messages during catch-up.
export function encodeCursor(m: { createdAt: Date | string; id: string }) {
  const iso = typeof m.createdAt === 'string' ? m.createdAt : m.createdAt.toISOString()
  return `${iso}|${m.id}`
}

export function decodeCursor(raw: string | null): { createdAt: Date; id: string } | null {
  if (!raw) return null
  const [iso, id] = raw.split('|')
  const createdAt = new Date(iso)
  if (!id || isNaN(createdAt.getTime())) return null
  return { createdAt, id }
}

/** Strictly after the cursor in (createdAt, id) order. */
export function afterCursor(c: { createdAt: Date; id: string }): Prisma.MessageWhereInput {
  return { OR: [{ createdAt: { gt: c.createdAt } }, { createdAt: c.createdAt, id: { gt: c.id } }] }
}

/** Strictly before the cursor in (createdAt, id) order. */
export function beforeCursor(c: { createdAt: Date; id: string }): Prisma.MessageWhereInput {
  return { OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }] }
}

/* ─── Mentions ────────────────────────────────────────────────────────────── */

/**
 * Notify people mentioned in a new message. Structured `<@id>` tokens from the
 * autocomplete are exact; plain "@Name" text still works as a fallback. In a
 * private channel only its members (and the owner) can be notified.
 */
export async function notifyChatMentions(
  m: PresentedMessage,
  channel: { id: string; name: string; isPrivate: boolean },
  actor: { id: string; name: string | null; email: string },
) {
  if (!m.content || !m.content.includes('@')) return
  const [{ workspaceMembersForMentions }, { extractMentionedUserIds, extractMentionTokens }, { notify }] = await Promise.all([
    import('@/lib/notifications/recipients'),
    import('@/lib/notifications/mentions'),
    import('@/lib/notifications/notify'),
  ])
  let members = await workspaceMembersForMentions(m.workspaceId)
  if (channel.isPrivate) {
    const [rows, ws] = await Promise.all([
      prisma.channelMember.findMany({ where: { channelId: channel.id }, select: { userId: true } }),
      prisma.workspace.findUnique({ where: { id: m.workspaceId }, select: { ownerId: true } }),
    ])
    const allowed = new Set([...rows.map(r => r.userId), ws?.ownerId])
    members = members.filter(member => allowed.has(member.id))
  }
  const mentioned = Array.from(new Set([
    ...extractMentionTokens(m.content, members, actor.id),
    ...extractMentionedUserIds(m.content, members, actor.id),
  ]))
  if (mentioned.length === 0) return
  // Notification text shows names, not raw <@id> tokens
  const byId = new Map(members.map(member => [member.id, member.name]))
  const body = m.content.replace(/<@([A-Za-z0-9_-]{1,64})>/g, (_, id) => `@${byId.get(id) ?? 'someone'}`)
  const thread = m.parentId ? `&thread=${m.parentId}` : ''
  await notify({
    recipients: mentioned,
    type: 'team.mentioned_chat',
    workspaceId: m.workspaceId,
    actorId: actor.id,
    title: `${actor.name || actor.email} mentioned you in #${channel.name}`,
    body,
    href: `/workspaces/${m.workspaceId}/chat?channel=${channel.id}${thread}`,
  })
}
