import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getMember(workspaceId: string, userId: string) {
  return prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
  })
}

// GET /api/workspaces/[id]/chat/channels
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await getMember(params.id, session.user.id)
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const channels = await prisma.channel.findMany({
    where: { workspaceId: params.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      createdById: true,
      _count: { select: { messages: true } },
    },
  })

  return NextResponse.json({ channels })
}

// POST /api/workspaces/[id]/chat/channels
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await getMember(params.id, session.user.id)
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Channel name is required' }, { status: 400 })

  // Normalise: lowercase, spaces→hyphens, strip special chars
  const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const existing = await prisma.channel.findFirst({
    where: { workspaceId: params.id, name: slug },
  })
  if (existing) return NextResponse.json({ error: 'A channel with that name already exists' }, { status: 409 })

  const channel = await prisma.channel.create({
    data: {
      name: slug,
      description: description?.trim() || null,
      workspaceId: params.id,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ channel }, { status: 201 })
}
