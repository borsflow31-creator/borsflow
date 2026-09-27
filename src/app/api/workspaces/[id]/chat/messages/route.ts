import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safeFileUrl } from '@/components/chat/chatFormat'

// Client-supplied Ably timestamps are only trusted within this window of server time.
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

const messageInclude = {
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.MessageInclude

async function getMember(workspaceId: string, userId: string) {
  return prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
  })
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await getMember(params.id, session.user.id)
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const after = searchParams.get('after')
  const channelId = searchParams.get('channelId') ?? null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50') || 50, 100)

  const where = {
    workspaceId: params.id,
    channelId: channelId ?? undefined,
    ...(after ? { createdAt: { gt: new Date(after) } } : {}),
  }

  // `after` is a catch-up cursor: everything newer than it, oldest first.
  if (after) {
    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: messageInclude,
    })
    return NextResponse.json({ messages })
  }

  // Initial load: the NEWEST `limit` messages, returned oldest-first for rendering.
  const newest = await prisma.message.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: messageInclude,
  })
  return NextResponse.json({ messages: newest.reverse() })
}

// Archives a message that was already delivered live over Ably. `ablySerial` makes this
// idempotent, so client retries (and a future server-side webhook) cannot create duplicates.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await getMember(params.id, session.user.id)
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { content, channelId, fileUrl: rawFileUrl, fileName, fileType, ablySerial, createdAt } = await request.json()
  const fileUrl = safeFileUrl(rawFileUrl)

  if (!content?.trim() && !fileUrl) {
    return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
  }

  if (ablySerial != null && (typeof ablySerial !== 'string' || !ablySerial || ablySerial.length > 200)) {
    return NextResponse.json({ error: 'Invalid ablySerial' }, { status: 400 })
  }

  // A channel id from the body must belong to this workspace.
  if (channelId) {
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, workspaceId: params.id },
      select: { id: true },
    })
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
  }

  if (ablySerial) {
    const existing = await prisma.message.findUnique({ where: { ablySerial }, include: messageInclude })
    if (existing) {
      // Same serial from another author/workspace is never a retry of ours.
      if (existing.workspaceId !== params.id || existing.userId !== session.user.id) {
        return NextResponse.json({ error: 'Message already archived' }, { status: 409 })
      }
      return NextResponse.json({ message: existing }, { status: 200 })
    }
  }

  // Store the Ably timestamp so archived history and the live stream share one clock.
  const now = Date.now()
  const parsed = typeof createdAt === 'string' || typeof createdAt === 'number' ? new Date(createdAt).getTime() : NaN
  const createdAtMs = Number.isFinite(parsed) && Math.abs(parsed - now) <= MAX_CLOCK_SKEW_MS ? parsed : now

  try {
    const message = await prisma.message.create({
      data: {
        content: content?.trim() ?? '',
        workspaceId: params.id,
        userId: session.user.id,
        channelId: channelId ?? null,
        fileUrl: fileUrl ?? null,
        fileName: fileName ?? null,
        fileType: fileType ?? null,
        ablySerial: ablySerial ?? null,
        createdAt: new Date(createdAtMs),
      },
      include: messageInclude,
    })
    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    // Lost a race with a concurrent retry of the same serial: return the winner.
    if (ablySerial && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await prisma.message.findUnique({ where: { ablySerial }, include: messageInclude })
      if (existing && existing.workspaceId === params.id && existing.userId === session.user.id) {
        return NextResponse.json({ message: existing }, { status: 200 })
      }
    }
    throw err
  }
}
