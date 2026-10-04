import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

// GET /api/matches?workspaceId=…&propertyId=…&status=new,notified
// The agent's inbox of buyers a listing suits, best fit first.
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const workspaceId = params.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error

    const where: Prisma.PropertyMatchWhereInput = { workspaceId }
    const propertyId = params.get('propertyId')
    if (propertyId) where.propertyId = propertyId
    const leadId = params.get('leadId')
    if (leadId) where.leadId = leadId
    const statuses = (params.get('status') ?? '').split(',').filter(Boolean)
    if (statuses.length) where.status = { in: statuses }

    const matches = await prisma.propertyMatch.findMany({
      where,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, email: true } },
        property: { select: { id: true, title: true, reference: true, city: true, price: true, currency: true } },
        searchBrief: { select: { id: true, name: true } },
      },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    })
    return NextResponse.json({ matches, canWrite: result.access.role !== 'viewer' })
  } catch (error) {
    return failure(error, 'Failed to fetch matches', 'Error fetching matches')
  }
}
