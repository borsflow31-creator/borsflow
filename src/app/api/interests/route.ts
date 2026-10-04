import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { createInterest, interestInclude } from '@/lib/services/interests'
import { isInterestStatus } from '@/lib/crm/lifecycle'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

// GET /api/interests?workspaceId=…
// Filters: pipelineId (the buyer board, ordered by column), propertyId (the
// buyers on a listing), leadId (the properties a buyer is chasing), status.
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const workspaceId = params.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const where: Prisma.InterestWhereInput = { workspaceId }
    const pipelineId = params.get('pipelineId')
    if (pipelineId) where.pipelineId = pipelineId
    const propertyId = params.get('propertyId')
    if (propertyId) where.propertyId = propertyId
    const leadId = params.get('leadId')
    if (leadId) where.leadId = leadId
    const status = params.get('status')
    if (isInterestStatus(status)) where.status = status

    const interests = await prisma.interest.findMany({
      where,
      include: {
        ...interestInclude,
        // For the board card: how many offers, and the highest pending one.
        offers: { where: { status: 'pending' }, select: { id: true, amount: true, currency: true } },
        _count: { select: { meetings: true } },
      },
      orderBy: pipelineId ? [{ order: 'asc' }, { createdAt: 'asc' }] : [{ createdAt: 'desc' }],
      take: 1000,
    })

    return NextResponse.json({ interests, role: access.role, canWrite: access.role !== 'viewer' })
  } catch (error) {
    return failure(error, 'Failed to fetch interests', 'Error fetching interests')
  }
}

// POST /api/interests  { workspaceId, leadId, propertyId, stage?, source?, … }
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request)
    if (!body) return INVALID_BODY()
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error

    const interest = await createInterest({ workspaceId, userId: result.access.userId }, body)
    return NextResponse.json({ interest }, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to create interest', 'Error creating interest')
  }
}
