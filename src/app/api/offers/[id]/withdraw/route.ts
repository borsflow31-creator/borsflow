import { NextRequest, NextResponse } from 'next/server'
import { getOfferAccess } from '@/lib/crm/access'
import { withdrawOffer } from '@/lib/services/offers'
import { failure } from '@/lib/api/respond'

// POST /api/offers/[id]/withdraw
// Withdrawing an accepted offer collapses the sale and puts the property back on
// the market in the same transaction.
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getOfferAccess(params.id, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const offer = await withdrawOffer(params.id, { workspaceId: access.workspaceId, userId: access.userId })
    return NextResponse.json({ offer })
  } catch (error) {
    return failure(error, 'Failed to withdraw the offer', 'Error withdrawing offer')
  }
}
