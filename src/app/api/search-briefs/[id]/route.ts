import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { briefInsights, updateBrief } from '@/lib/services/search-briefs'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/** The brief's workspace, from the record, never from the client. */
async function load(id: string) {
  return prisma.searchBrief.findUnique({ where: { id }, include: { lead: { select: { id: true, firstName: true, lastName: true, email: true } } } })
}

// GET /api/search-briefs/[id] — the brief, what the buyer's viewings have said, and its matches.
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const brief = await load(params.id)
    if (!brief) return NextResponse.json({ error: 'Search brief not found' }, { status: 404 })
    const result = await getWorkspaceAccess(brief.workspaceId)
    if ('error' in result) return result.error

    const [insights, matches] = await Promise.all([
      briefInsights(brief.leadId),
      prisma.propertyMatch.findMany({
        where: { searchBriefId: brief.id },
        include: { property: { select: { id: true, title: true, reference: true, city: true, price: true, currency: true, status: true } } },
        orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
        take: 100,
      }),
    ])
    return NextResponse.json({ brief, insights, matches, canWrite: result.access.role !== 'viewer' })
  } catch (error) {
    return failure(error, 'Failed to fetch search brief', 'Error fetching search brief')
  }
}

async function update(request: NextRequest, { params }: Params) {
  try {
    const brief = await load(params.id)
    if (!brief) return NextResponse.json({ error: 'Search brief not found' }, { status: 404 })
    const result = await getWorkspaceAccess(brief.workspaceId, { write: true })
    if ('error' in result) return result.error

    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const updated = await updateBrief(params.id, { workspaceId: brief.workspaceId, userId: result.access.userId }, body)
    return NextResponse.json(updated)
  } catch (error) {
    return failure(error, 'Failed to update the search brief', 'Error updating search brief')
  }
}
export const PUT = update
export const PATCH = update

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const brief = await load(params.id)
    if (!brief) return NextResponse.json({ error: 'Search brief not found' }, { status: 404 })
    const result = await getWorkspaceAccess(brief.workspaceId, { write: true })
    if ('error' in result) return result.error

    await prisma.searchBrief.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return failure(error, 'Failed to delete the search brief', 'Error deleting search brief')
  }
}
