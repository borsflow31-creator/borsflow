import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  chatRateLimit,
  findVisibleChannel,
  getChatAccess,
  logRealtimeError,
  messageInclude,
  presentMessage,
  publishSignal,
  readJson,
} from '@/lib/chat/server'

// One emoji (possibly a multi-codepoint sequence), no text.
const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️){1,16}$/u

// POST /api/workspaces/[id]/chat/messages/[messageId]/reactions  { emoji }
// Toggles the caller's reaction: adds it, or removes it if already there.
export async function POST(request: Request, { params }: { params: { id: string; messageId: string } }) {
  const result = await getChatAccess(params.id, { write: true })
  if ('error' in result) return result.error
  const { access } = result

  const body = await readJson(request)
  const emoji = typeof body?.emoji === 'string' ? body.emoji.trim() : ''
  if (!emoji || emoji.length > 32 || !EMOJI.test(emoji)) {
    return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 })
  }

  const message = await prisma.message.findFirst({
    where: { id: params.messageId, workspaceId: params.id, deletedAt: null },
    select: { id: true, channelId: true, parentId: true },
  })
  if (!message?.channelId || !(await findVisibleChannel(access, message.channelId))) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const limited = await chatRateLimit('reaction', access.userId)
  if (limited) return limited

  const key = { messageId_userId_emoji: { messageId: message.id, userId: access.userId, emoji } }
  const existing = await prisma.messageReaction.findUnique({ where: key })
  if (existing) {
    await prisma.messageReaction.delete({ where: key })
  } else {
    try {
      await prisma.messageReaction.create({ data: { messageId: message.id, userId: access.userId, emoji } })
    } catch (err) {
      // A double-click raced us to the same reaction: that's the state we wanted.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err
    }
  }

  const updated = await prisma.message.findUniqueOrThrow({ where: { id: message.id }, include: messageInclude })
  await publishSignal(params.id, {
    type: 'message-changed', channelId: message.channelId, messageId: message.id, parentId: message.parentId,
  }).catch(logRealtimeError('signal'))

  return NextResponse.json({ message: presentMessage(updated) })
}
