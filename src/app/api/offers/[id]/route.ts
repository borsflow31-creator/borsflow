import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOfferAccess } from '@/lib/crm/access'
import { offerInclude } from '@/lib/services/offers'
import { publicOfferUrl } from '@/lib/crm/public-links'
import { failure } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

// GET /api/offers/[id]
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getOfferAccess(params.id)
    if ('error' in result) return result.error
    const { access } = result

    const offer = await prisma.offer.findUniqueOrThrow({ where: { id: params.id }, include: offerInclude })
    return NextResponse.json({
      offer: { ...offer, shareUrl: offer.publicToken ? publicOfferUrl(offer.publicToken) : null },
      role: access.role,
      canWrite: access.role !== 'viewer',
    })
  } catch (error) {
    return failure(error, 'Failed to fetch offer', 'Error fetching offer')
  }
}
