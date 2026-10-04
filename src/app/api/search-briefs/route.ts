import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { createBrief } from '@/lib/services/search-briefs'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

// GET /api/search-briefs?workspaceId=…&leadId=…
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const workspaceId = params.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error

    const where: Prisma.SearchBriefWhereInput = { workspaceId }
    const leadId = params.get('leadId')
    if (leadId) where.leadId = leadId

    const briefs = await prisma.searchBrief.findMany({
      where,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { matches: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return NextResponse.json({ briefs, canWrite: result.access.role !== 'viewer' })
  } catch (error) {
    return failure(error, 'Failed to fetch search briefs', 'Error fetching search briefs')
  }
}

// POST /api/search-briefs  { workspaceId, leadId, name, priceMax, cities, … }
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request)
    if (!body) return INVALID_BODY()
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error

    const { brief, matched } = await createBrief({ workspaceId, userId: result.access.userId }, body)
    return NextResponse.json({ brief, matched }, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to save the search brief', 'Error creating search brief')
  }
}
