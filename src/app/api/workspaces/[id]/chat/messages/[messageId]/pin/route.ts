import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  findVisibleChannel,
  getChatAccess,
  logRealtimeError,
  messageInclude,
  presentMessage,
  publishSignal,
  readJson,
} from '@/lib/chat/server'

// POST /api/workspaces/[id]/chat/messages/[messageId]/pin  { pinned: boolean }
// Any member who can post may pin or unpin top-level messages in the channel.
export async function POST(request: Request, { params }: { params: { id: string; messageId: string } }) {
  const result = await getChatAccess(params.id, { write: true })
  if ('error' in result) return result.error
  const { access } = result

  const body = await readJson(request)
  if (typeof body?.pinned !== 'boolean') return NextResponse.json({ error: 'pinned must be true or false' }, { status: 400 })

  const message = await prisma.message.findFirst({
    where: { id: params.messageId, workspaceId: params.id, deletedAt: null, parentId: null },
    select: { id: true, channelId: true },
  })
  if (!message?.channelId || !(await findVisibleChannel(access, message.channelId))) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: body.pinned
      ? { pinnedAt: new Date(), pinnedById: access.userId }
      : { pinnedAt: null, pinnedById: null },
    include: messageInclude,
  })

  await publishSignal(params.id, {
    type: 'message-changed', channelId: message.channelId, messageId: message.id, parentId: null,
  }).catch(logRealtimeError('signal'))

  return NextResponse.json({ message: presentMessage(updated) })
}
