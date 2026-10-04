import { NextRequest, NextResponse } from 'next/server'
import { getOfferAccess } from '@/lib/crm/access'
import { rejectOffer } from '@/lib/services/offers'
import { failure } from '@/lib/api/respond'

// POST /api/offers/[id]/reject  { reason? }
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getOfferAccess(params.id, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const body = await request.json().catch(() => ({}))
    const offer = await rejectOffer(
      params.id,
      { workspaceId: access.workspaceId, userId: access.userId },
      { reason: typeof body?.reason === 'string' ? body.reason : undefined }
    )
    return NextResponse.json({ offer })
  } catch (error) {
    return failure(error, 'Failed to reject the offer', 'Error rejecting offer')
  }
}
