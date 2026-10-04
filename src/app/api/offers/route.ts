import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { createOffer, offerInclude } from '@/lib/services/offers'
import { OFFER_STATUSES } from '@/lib/crm/lifecycle'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

// GET /api/offers?workspaceId=…&propertyId=…&status=…
// With propertyId, offers come highest first and carry how many pending siblings
// each one competes with, which is what the accept dialog shows.
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const workspaceId = params.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const where: Prisma.OfferWhereInput = { workspaceId }
    const propertyId = params.get('propertyId')
    if (propertyId) where.propertyId = propertyId
    const leadId = params.get('leadId')
    if (leadId) where.leadId = leadId
    const interestId = params.get('interestId')
    if (interestId) where.interestId = interestId
    const status = params.get('status')
    if (status && (OFFER_STATUSES as readonly string[]).includes(status)) where.status = status

    const offers = await prisma.offer.findMany({
      where,
      include: offerInclude,
      orderBy: propertyId ? [{ status: 'asc' }, { amount: 'desc' }] : [{ offeredAt: 'desc' }],
      take: 500,
    })

    const pending = offers.filter(o => o.status === 'pending').length
    return NextResponse.json({
      offers: offers.map(o => ({ ...o, competing: o.status === 'pending' ? pending - 1 : 0 })),
      role: access.role,
      canWrite: access.role !== 'viewer',
    })
  } catch (error) {
    return failure(error, 'Failed to fetch offers', 'Error fetching offers')
  }
}

// POST /api/offers  { workspaceId, interestId, amount, expiresAt?, depositAmount?, financingType?, conditions? }
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request)
    if (!body) return INVALID_BODY()
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error

    const offer = await createOffer({ workspaceId, userId: result.access.userId }, body)
    return NextResponse.json({ offer }, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to create offer', 'Error creating offer')
  }
}
