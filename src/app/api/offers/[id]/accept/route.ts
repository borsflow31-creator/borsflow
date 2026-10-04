import { NextRequest, NextResponse } from 'next/server'
import { getOfferAccess } from '@/lib/crm/access'
import { acceptOffer } from '@/lib/services/offers'
import { failure } from '@/lib/api/respond'

// POST /api/offers/[id]/accept
// Accepts this offer and rejects every competing pending offer on the property
// in one transaction. The response lists the offers that were rejected, so the
// client can say exactly what the click did.
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getOfferAccess(params.id, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const outcome = await acceptOffer(params.id, { workspaceId: access.workspaceId, userId: access.userId }, 'agent')
    return NextResponse.json(outcome)
  } catch (error) {
    return failure(error, 'Failed to accept the offer', 'Error accepting offer')
  }
}
