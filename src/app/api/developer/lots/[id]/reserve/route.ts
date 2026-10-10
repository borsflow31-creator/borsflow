import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { reserveLot } from '@/lib/services/developer/lots'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lotId } = await params
    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    const buyerLeadId = typeof body.buyerLeadId === 'string' ? body.buyerLeadId : ''

    if (!workspaceId || !buyerLeadId) {
      return NextResponse.json({ error: 'Workspace ID and Buyer Lead ID are required' }, { status: 400 })
    }

    const result = await getDeveloperAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const lot = await reserveLot(
      { workspaceId, userId: access.userId },
      lotId,
      {
        buyerLeadId,
        reservationFee: body.reservationFee as number | string | null | undefined,
        reservationFeePaidAt: body.reservationFeePaidAt as string | null | undefined,
        salesAgentId: typeof body.salesAgentId === 'string' && body.salesAgentId ? body.salesAgentId : undefined,
      }
    )
    return NextResponse.json({ lot })
  } catch (error) {
    return failure(error, 'Failed to reserve lot', 'Error reserving lot')
  }
}
