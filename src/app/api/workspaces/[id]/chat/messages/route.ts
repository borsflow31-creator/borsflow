import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  CHAT_FILE_TYPES,
  MAX_FILE_NAME,
  MAX_MESSAGE_LENGTH,
  afterCursor,
  beforeCursor,
  chatRateLimit,
  decodeCursor,
  findVisibleChannel,
  getChatAccess,
  isWorkspaceFilePath,
  logRealtimeError,
  messageInclude,
  notifyChatMentions,
  presentMessage,
  publishChatMessage,
  publishSignal,
  readJson,
} from '@/lib/chat/server'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100
const AROUND_EACH_SIDE = 25

// GET /api/workspaces/[id]/chat/messages?channelId=…
//   (default)        newest page of the main timeline, oldest-first, with hasMore
//   &before=cursor   older page (scroll-back), oldest-first, with hasMore
//   &after=cursor    everything newer (catch-up), oldest-first, with hasMore
//   &around=msgId    a window centred on one message (search results)
//   &parentId=msgId  the replies in a thread
//   &pinned=1        pinned messages, newest pin first
//   &ids=a,b         specific messages (refresh after a change signal)
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const result = await getChatAccess(params.id)
  if ('error' in result) return result.error
  const { access } = result

  const { searchParams } = new URL(request.url)
  const channelId = searchParams.get('channelId')
  // Without a channel this would return every message in the workspace.
  if (!channelId) return NextResponse.json({ error: 'channelId is required' }, { status: 400 })
  const channel = await findVisibleChannel(access, channelId)
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '') || DEFAULT_LIMIT, 1), MAX_LIMIT)
  const base: Prisma.MessageWhereInput = { workspaceId: params.id, channelId }
  const asc = { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] }
  const desc = { orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }] }

  // Specific messages (refreshing after a reaction/pin/edit signal)
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, 50)
  if (ids.length > 0) {
    const rows = await prisma.message.findMany({ where: { ...base, id: { in: ids } }, include: messageInclude })
    return NextResponse.json({ messages: rows.map(presentMessage) })
  }

  const parentId = searchParams.get('parentId')
  if (parentId) {
    const parent = await prisma.message.findFirst({ where: { id: parentId, ...base }, include: messageInclude })
    if (!parent) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    const replies = await prisma.message.findMany({
      where: { ...base, parentId, deletedAt: null },
      ...asc,
      take: 500,
      include: messageInclude,
    })
    return NextResponse.json({ parent: presentMessage(parent), messages: replies.map(presentMessage) })
  }

  if (searchParams.get('pinned') === '1') {
    const pinned = await prisma.message.findMany({
      where: { ...base, pinnedAt: { not: null }, deletedAt: null },
      orderBy: { pinnedAt: 'desc' },
      take: 50,
      include: messageInclude,
    })
    return NextResponse.json({ messages: pinned.map(presentMessage) })
  }

  const timeline: Prisma.MessageWhereInput = { ...base, parentId: null }

  const around = searchParams.get('around')
  if (around) {
    const target = await prisma.message.findFirst({ where: { id: around, ...timeline } })
    if (!target) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    const [older, newer] = await Promise.all([
      prisma.message.findMany({ where: { AND: [timeline, beforeCursor(target)] }, ...desc, take: AROUND_EACH_SIDE + 1, include: messageInclude }),
      prisma.message.findMany({ where: { AND: [timeline, { OR: [{ id: target.id }, afterCursor(target)] }] }, ...asc, take: AROUND_EACH_SIDE + 1, include: messageInclude }),
    ])
    const hasMore = older.length > AROUND_EACH_SIDE
    const hasNewer = newer.length > AROUND_EACH_SIDE
    const messages = [...older.slice(0, AROUND_EACH_SIDE).reverse(), ...newer.slice(0, AROUND_EACH_SIDE)]
    return NextResponse.json({ messages: messages.map(presentMessage), hasMore, hasNewer })
  }

  const after = decodeCursor(searchParams.get('after'))
  if (after) {
    const rows = await prisma.message.findMany({
      where: { AND: [timeline, afterCursor(after)] },
      ...asc,
      take: limit + 1,
      include: messageInclude,
    })
    return NextResponse.json({ messages: rows.slice(0, limit).map(presentMessage), hasMore: rows.length > limit })
  }

  const before = decodeCursor(searchParams.get('before'))
  const rows = await prisma.message.findMany({
    where: before ? { AND: [timeline, beforeCursor(before)] } : timeline,
    ...desc,
    take: limit + 1,
    include: messageInclude,
  })
  return NextResponse.json({
    messages: rows.slice(0, limit).reverse().map(presentMessage),
    hasMore: rows.length > limit,
  })
}

// POST /api/workspaces/[id]/chat/messages
// Saves the message, then publishes it to the channel's Ably room as the sender.
// Thread replies are not published to the room (they stay out of the main
// timeline); open thread panels pick them up from the workspace signal.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await getChatAccess(params.id, { write: true })
  if ('error' in result) return result.error
  const { access } = result

  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const channelId = typeof body.channelId === 'string' ? body.channelId : ''
  const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : null
  const clientMsgId = typeof body.clientMsgId === 'string' && body.clientMsgId.length <= 64 ? body.clientMsgId : undefined
  const filePath = body.filePath ?? null
  const fileType = typeof body.fileType === 'string' ? body.fileType : null
  const fileName = typeof body.fileName === 'string' ? body.fileName.trim().slice(0, MAX_FILE_NAME) : null

  if (!channelId) return NextResponse.json({ error: 'channelId is required' }, { status: 400 })
  if (content.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Messages can be at most ${MAX_MESSAGE_LENGTH} characters` }, { status: 400 })
  }
  if (filePath !== null && (!isWorkspaceFilePath(params.id, filePath) || !fileType || !CHAT_FILE_TYPES[fileType] || !fileName)) {
    return NextResponse.json({ error: 'Invalid attachment' }, { status: 400 })
  }
  if (!content && !filePath) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })

  const channel = await findVisibleChannel(access, channelId)
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  if (parentId) {
    // One level of threading: reply to a live top-level message in this channel.
    const parent = await prisma.message.findFirst({
      where: { id: parentId, channelId, workspaceId: params.id, parentId: null, deletedAt: null },
      select: { id: true },
    })
    if (!parent) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  const limited = await chatRateLimit('message', access.userId)
  if (limited) return limited

  const row = await prisma.message.create({
    data: {
      content,
      workspaceId: params.id,
      userId: access.userId,
      channelId,
      parentId,
      filePath: (filePath as string | null) ?? null,
      fileName: filePath ? fileName : null,
      fileType: filePath ? fileType : null,
    },
    include: messageInclude,
  })
  let message = presentMessage(row)

  if (!parentId) {
    try {
      const serial = await publishChatMessage(message, clientMsgId)
      if (serial) {
        const updated = await prisma.message.update({ where: { id: row.id }, data: { ablySerial: serial }, include: messageInclude })
        message = presentMessage(updated)
      }
    } catch (err) {
      // Saved but not delivered live: other members get it from catch-up / the signal.
      logRealtimeError('publish message')(err)
    }
  }

  await publishSignal(params.id, {
    type: 'message',
    channelId,
    messageId: message.id,
    userId: access.userId,
    parentId,
  }).catch(logRealtimeError('signal'))

  void notifyChatMentions(message, channel, row.user).catch(logRealtimeError('mention notifications'))

  return NextResponse.json({ message }, { status: 201 })
}
