import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin, CHAT_BUCKET } from '@/lib/supabase-admin'
import {
  MAX_MESSAGE_LENGTH,
  findVisibleChannel,
  getChatAccess,
  logRealtimeError,
  messageInclude,
  presentMessage,
  publishChatDelete,
  publishChatEdit,
  publishSignal,
  readJson,
  type ChatAccess,
} from '@/lib/chat/server'

type Params = { params: { id: string; messageId: string } }

/** The message, if it exists in a channel this user can see. */
async function loadMessage(access: ChatAccess, messageId: string) {
  const message = await prisma.message.findFirst({
    where: { id: messageId, workspaceId: access.workspaceId },
    include: messageInclude,
  })
  if (!message?.channelId) return null
  const channel = await findVisibleChannel(access, message.channelId)
  return channel ? message : null
}

// PATCH /api/workspaces/[id]/chat/messages/[messageId]  { content }
// Authors edit their own messages; an edited message keeps its place in the timeline.
export async function PATCH(request: Request, { params }: Params) {
  const result = await getChatAccess(params.id, { write: true })
  if ('error' in result) return result.error
  const { access } = result

  const message = await loadMessage(access, params.messageId)
  if (!message || message.deletedAt) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  if (message.userId !== access.userId) {
    return NextResponse.json({ error: 'You can only edit your own messages' }, { status: 403 })
  }

  const body = await readJson(request)
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  if (!content && !message.filePath && !message.fileUrl) {
    return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Messages can be at most ${MAX_MESSAGE_LENGTH} characters` }, { status: 400 })
  }
  if (content === message.content) return NextResponse.json({ message: presentMessage(message) })

  const updated = presentMessage(await prisma.message.update({
    where: { id: message.id },
    data: { content, editedAt: new Date() },
    include: messageInclude,
  }))

  await publishChatEdit(updated).catch(logRealtimeError('publish edit'))
  await publishSignal(params.id, {
    type: 'message-changed', channelId: message.channelId!, messageId: message.id, parentId: message.parentId,
  }).catch(logRealtimeError('signal'))

  return NextResponse.json({ message: updated })
}

// DELETE /api/workspaces/[id]/chat/messages/[messageId]
// Authors delete their own messages; owner and admins can delete anyone's. The
// row is kept as "message deleted" so thread replies and ordering survive; its
// text, attachment and reactions are removed.
export async function DELETE(_request: Request, { params }: Params) {
  const result = await getChatAccess(params.id, { write: true })
  if ('error' in result) return result.error
  const { access } = result

  const message = await loadMessage(access, params.messageId)
  if (!message || message.deletedAt) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  if (message.userId !== access.userId && !access.canModerate) {
    return NextResponse.json({ error: 'You can only delete your own messages' }, { status: 403 })
  }

  const [row] = await prisma.$transaction([
    prisma.message.update({
      where: { id: message.id },
      data: {
        deletedAt: new Date(),
        content: '',
        filePath: null,
        fileUrl: null,
        fileName: null,
        fileType: null,
        pinnedAt: null,
        pinnedById: null,
      },
      include: messageInclude,
    }),
    prisma.messageReaction.deleteMany({ where: { messageId: message.id } }),
  ])
  const deleted = presentMessage(row)

  if (message.filePath) {
    await getSupabaseAdmin()?.storage.from(CHAT_BUCKET).remove([message.filePath])
      .catch(logRealtimeError('remove attachment'))
  }

  await publishChatDelete(deleted, access.userId).catch(logRealtimeError('publish delete'))
  await publishSignal(params.id, {
    type: 'message-changed', channelId: message.channelId!, messageId: message.id, parentId: message.parentId,
  }).catch(logRealtimeError('signal'))

  return NextResponse.json({ message: deleted })
}
