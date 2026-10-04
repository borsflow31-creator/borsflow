import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { convertMatch, dismissMatch } from '@/lib/services/search-briefs'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'

// PUT /api/matches/[id]  { action: 'convert' | 'dismiss' }
// convert: attach the buyer to the property as an interest (the agent's decision;
//          a match never becomes one on its own).
// dismiss: not a fit after all. A later price drop can re-open it.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const match = await prisma.propertyMatch.findUnique({ where: { id: params.id }, select: { workspaceId: true } })
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

    const result = await getWorkspaceAccess(match.workspaceId, { write: true })
    if ('error' in result) return result.error

    const body = await readBody(request)
    if (!body) return INVALID_BODY()
    const ctx = { workspaceId: match.workspaceId, userId: result.access.userId }

    if (body.action === 'convert') return NextResponse.json({ match: await convertMatch(params.id, ctx) })
    if (body.action === 'dismiss') {
      await dismissMatch(params.id, ctx)
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: "action must be 'convert' or 'dismiss'" }, { status: 400 })
  } catch (error) {
    return failure(error, 'Failed to update the match', 'Error updating match')
  }
}
