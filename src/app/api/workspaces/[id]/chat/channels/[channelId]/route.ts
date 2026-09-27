import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE /api/workspaces/[id]/chat/channels/[channelId]
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; channelId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await prisma.workspace.findFirst({
    where: {
      id: params.id,
      OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }],
    },
  })
  if (!workspace) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const channel = await prisma.channel.findFirst({
    where: { id: params.channelId, workspaceId: params.id },
  })
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  // Only creator or workspace owner can delete
  if (channel.createdById !== session.user.id && workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  // Unlink messages first (set channelId to null)
  await prisma.message.updateMany({
    where: { channelId: params.channelId },
    data: { channelId: null },
  })

  await prisma.channel.delete({ where: { id: params.channelId } })

  return NextResponse.json({ success: true })
}

// PATCH /api/workspaces/[id]/chat/channels/[channelId]
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; channelId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await prisma.workspace.findFirst({
    where: {
      id: params.id,
      OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }],
    },
  })
  if (!workspace) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const channel = await prisma.channel.findFirst({
    where: { id: params.channelId, workspaceId: params.id },
  })
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  if (channel.createdById !== session.user.id && workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { description } = await req.json()

  const updated = await prisma.channel.update({
    where: { id: params.channelId },
    data: { description: description?.trim() || null },
  })

  return NextResponse.json({ channel: updated })
}
