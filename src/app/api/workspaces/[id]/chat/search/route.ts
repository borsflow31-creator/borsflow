import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getChatAccess, messageInclude, presentMessage, visibleChannelIds } from '@/lib/chat/server'

const PAGE_SIZE = 30

// GET /api/workspaces/[id]/chat/search?q=…&cursor=…
// Case-insensitive text search over messages in channels the caller can see,
// newest first. Returns each hit with its channel so the UI can jump to it.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const result = await getChatAccess(params.id)
  if ('error' in result) return result.error
  const { access } = result

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ results: [], nextCursor: null })
  if (q.length > 200) return NextResponse.json({ error: 'Search is too long' }, { status: 400 })

  const channelIds = await visibleChannelIds(access)
  if (channelIds.length === 0) return NextResponse.json({ results: [], nextCursor: null })

  const cursor = searchParams.get('cursor')
  const rows = await prisma.message.findMany({
    where: {
      workspaceId: params.id,
      channelId: { in: channelIds },
      deletedAt: null,
      content: { contains: q, mode: 'insensitive' },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { ...messageInclude, channel: { select: { id: true, name: true } } },
  })

  const page = rows.slice(0, PAGE_SIZE)
  return NextResponse.json({
    results: page.map(r => ({ ...presentMessage(r), channel: r.channel })),
    nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
  })
}
