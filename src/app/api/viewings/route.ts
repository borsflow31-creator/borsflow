import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { createViewing, viewingInclude } from '@/lib/services/viewings'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { clampInt } from '@/lib/products'

export const dynamic = 'force-dynamic'

// GET /api/viewings?workspaceId=…&when=upcoming|past|needs_feedback&propertyId=…&leadId=…
// A viewing is a Meeting that has a property, so this is the meetings table
// narrowed to those -- not a second appointment system.
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const workspaceId = params.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const now = new Date()
    const where: Prisma.MeetingWhereInput = { workspaceId, propertyId: { not: null } }

    const propertyId = params.get('propertyId')
    if (propertyId) where.propertyId = propertyId
    const leadId = params.get('leadId')
    if (leadId) where.leadId = leadId
    const interestId = params.get('interestId')
    if (interestId) where.interestId = interestId

    const when = params.get('when')
    if (when === 'upcoming') {
      where.startTime = { gte: now }
      where.status = { notIn: ['cancelled', 'no_show'] }
    } else if (when === 'past') {
      where.startTime = { lt: now }
    } else if (when === 'needs_feedback') {
      // Over, not cancelled, with a buyer to report on and no feedback yet.
      where.startTime = { lt: now }
      where.status = { notIn: ['cancelled', 'no_show'] }
      where.leadId = { not: null }
      where.viewingFeedback = { is: null }
    }

    const viewings = await prisma.meeting.findMany({
      where,
      include: viewingInclude,
      orderBy: { startTime: when === 'upcoming' ? 'asc' : 'desc' },
      take: clampInt(params.get('limit'), 100, 1, 200),
    })

    return NextResponse.json({ viewings, role: access.role, canWrite: access.role !== 'viewer' })
  } catch (error) {
    return failure(error, 'Failed to fetch viewings', 'Error fetching viewings')
  }
}

// POST /api/viewings  { workspaceId, propertyId, interestId? | leadId?, startTime, duration?, title?, notes? }
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request)
    if (!body) return INVALID_BODY()
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error

    const viewing = await createViewing({ workspaceId, userId: result.access.userId }, body)
    return NextResponse.json({ viewing }, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to book the viewing', 'Error booking viewing')
  }
}
