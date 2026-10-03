import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findVisibleChannel, getChatAccess } from '@/lib/chat/server'

// POST /api/workspaces/[id]/chat/channels/[channelId]/read
// Marks everything in the channel up to now as read for the caller. Viewers can
// mark read too (it's their own state, not workspace content).
export async function POST(_req: Request, { params }: { params: { id: string; channelId: string } }) {
  const result = await getChatAccess(params.id)
  if ('error' in result) return result.error
  const { access } = result

  const channel = await findVisibleChannel(access, params.channelId)
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  const lastReadAt = new Date()
  await prisma.channelRead.upsert({
    where: { userId_channelId: { userId: access.userId, channelId: channel.id } },
    create: { userId: access.userId, channelId: channel.id, lastReadAt },
    update: { lastReadAt },
  })

  return NextResponse.json({ lastReadAt: lastReadAt.toISOString() })
}
