import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { getLotLedger, recordDepositPayment } from '@/lib/services/developer/collections'

export const dynamic = 'force-dynamic'

/**
 * Record money received against a unit's reservation deposit: full or partial,
 * through the same ledger as the calls for funds. Answers with the refreshed
 * ledger; a retry with the same `clientRequestId` answers 200 with the payment
 * made the first time.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lotId } = await params
    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getDeveloperAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const ctx = { workspaceId, userId: result.access.userId }

    const { payment, replayed } = await recordDepositPayment(ctx, lotId, body)
    const ledger = await getLotLedger(ctx, lotId)
    return NextResponse.json({ payment, replayed, ledger }, { status: replayed ? 200 : 201 })
  } catch (error) {
    return failure(error, 'Failed to record the deposit', 'Error recording deposit payment')
  }
}
