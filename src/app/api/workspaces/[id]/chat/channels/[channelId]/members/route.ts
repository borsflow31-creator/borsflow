import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findVisibleChannel, getChatAccess, logRealtimeError, publishSignal, readJson } from '@/lib/chat/server'

type Params = { params: { id: string; channelId: string } }

// PUT /api/workspaces/[id]/chat/channels/[channelId]/members  { memberIds: string[] }
// Replaces a private channel's member list. The creator, owner or an admin can
// manage it; the creator always stays a member. Removed members lose the channel
// immediately and its Realtime topic the next time their client joins it.
export async function PUT(req: Request, { params }: Params) {
  const result = await getChatAccess(params.id, { write: true })
  if ('error' in result) return result.error
  const { access } = result

  const channel = await findVisibleChannel(access, params.channelId)
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
  if (!channel.isPrivate) return NextResponse.json({ error: 'Only private channels have a member list' }, { status: 400 })
  if (channel.createdById !== access.userId && !access.canModerate) {
    return NextResponse.json({ error: 'Only the channel creator or a workspace admin can manage members' }, { status: 403 })
  }

  const body = await readJson(req)
  const requested = Array.isArray(body?.memberIds) ? body!.memberIds.filter((v): v is string => typeof v === 'string') : null
  if (!requested) return NextResponse.json({ error: 'memberIds must be a list' }, { status: 400 })

  const workspace = await prisma.workspace.findUnique({
    where: { id: params.id },
    select: { ownerId: true, members: { where: { userId: { in: requested } }, select: { userId: true } } },
  })
  const valid = new Set(workspace?.members.map(m => m.userId))
  if (workspace && requested.includes(workspace.ownerId)) valid.add(workspace.ownerId)
  const memberIds = Array.from(new Set([channel.createdById, ...requested.filter(id => valid.has(id))]))

  await prisma.$transaction([
    prisma.channelMember.deleteMany({ where: { channelId: channel.id, userId: { notIn: memberIds } } }),
    prisma.channelMember.createMany({
      data: memberIds.map(userId => ({ channelId: channel.id, userId })),
      skipDuplicates: true,
    }),
  ])

  await publishSignal(params.id, { type: 'channels-changed' }).catch(logRealtimeError('signal'))

  return NextResponse.json({ memberIds })
}
