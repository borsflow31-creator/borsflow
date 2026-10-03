import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  MAX_CHANNEL_DESCRIPTION,
  chatRateLimit,
  getChatAccess,
  isNonEmptyString,
  logRealtimeError,
  publishSignal,
  readJson,
  slugifyChannelName,
  visibleChannelWhere,
} from '@/lib/chat/server'

// GET /api/workspaces/[id]/chat/channels
// Channels this user can see, each with its unread count (top-level messages
// from others since the user's read marker) and, for private ones, member ids.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const result = await getChatAccess(params.id)
  if ('error' in result) return result.error
  const { access } = result

  const channels = await prisma.channel.findMany({
    where: visibleChannelWhere(access),
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      isPrivate: true,
      createdAt: true,
      createdById: true,
      members: { select: { userId: true } },
    },
  })

  const unread = new Map<string, number>()
  if (channels.length > 0) {
    // One query for every channel; a channel the user has never opened counts
    // everything from others as unread.
    const rows = await prisma.$queryRaw<{ channelId: string; count: bigint }[]>(Prisma.sql`
      SELECT m."channelId", COUNT(*)::bigint AS count
      FROM "Message" m
      LEFT JOIN "ChannelRead" r ON r."channelId" = m."channelId" AND r."userId" = ${access.userId}
      WHERE m."channelId" IN (${Prisma.join(channels.map(c => c.id))})
        AND m."parentId" IS NULL
        AND m."deletedAt" IS NULL
        AND m."userId" <> ${access.userId}
        AND (r."lastReadAt" IS NULL OR m."createdAt" > r."lastReadAt")
      GROUP BY m."channelId"
    `)
    for (const r of rows) unread.set(r.channelId, Number(r.count))
  }

  return NextResponse.json({
    channels: channels.map(({ members, ...c }) => ({
      ...c,
      memberIds: c.isPrivate ? members.map(m => m.userId) : [],
      unreadCount: unread.get(c.id) ?? 0,
    })),
    role: access.role,
    canWrite: access.canWrite,
    canModerate: access.canModerate,
  })
}

// POST /api/workspaces/[id]/chat/channels  { name, description?, isPrivate?, memberIds? }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const result = await getChatAccess(params.id, { write: true })
  if ('error' in result) return result.error
  const { access } = result

  const body = await readJson(req)
  if (!body || !isNonEmptyString(body.name)) {
    return NextResponse.json({ error: 'Channel name is required' }, { status: 400 })
  }
  const slug = slugifyChannelName(body.name)
  if (!slug) {
    return NextResponse.json({ error: 'Use letters or numbers in the channel name' }, { status: 400 })
  }
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, MAX_CHANNEL_DESCRIPTION) : ''
  const isPrivate = body.isPrivate === true

  const limited = await chatRateLimit('channel', access.userId)
  if (limited) return limited

  const existing = await prisma.channel.findFirst({ where: { workspaceId: params.id, name: slug }, select: { id: true } })
  if (existing) return NextResponse.json({ error: 'A channel with that name already exists' }, { status: 409 })

  // Private channel members must belong to the workspace; the creator is always in.
  let memberIds: string[] = []
  if (isPrivate) {
    const requested = Array.isArray(body.memberIds) ? body.memberIds.filter((v): v is string => typeof v === 'string') : []
    const workspace = await prisma.workspace.findUnique({
      where: { id: params.id },
      select: { ownerId: true, members: { where: { userId: { in: requested } }, select: { userId: true } } },
    })
    const valid = new Set(workspace?.members.map(m => m.userId))
    if (workspace && requested.includes(workspace.ownerId)) valid.add(workspace.ownerId)
    memberIds = Array.from(new Set([access.userId, ...requested.filter(id => valid.has(id))]))
  }

  const channel = await prisma.channel.create({
    data: {
      name: slug,
      description: description || null,
      isPrivate,
      workspaceId: params.id,
      createdById: access.userId,
      ...(isPrivate ? { members: { create: memberIds.map(userId => ({ userId })) } } : {}),
    },
  })

  await publishSignal(params.id, { type: 'channels-changed' }).catch(logRealtimeError('signal'))

  return NextResponse.json(
    { channel: { ...channel, memberIds, unreadCount: 0 } },
    { status: 201 },
  )
}
