import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import {
  confirmPayment,
  failPayment,
  getLotLedger,
  refundPayment,
  reversePayment,
} from '@/lib/services/developer/collections'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const ACTIONS = ['confirm', 'fail', 'reverse', 'refund'] as const
type Action = (typeof ACTIONS)[number]

/**
 * What can happen to a payment after it is recorded:
 *  - confirm: a pending cheque cleared;
 *  - fail: a pending cheque bounced or was withdrawn (needs a reason);
 *  - reverse: a confirmed payment was recorded in error (owner/admin, reason);
 *  - refund: money given back against a confirmed payment (owner/admin, reason).
 * None deletes anything. Answers with the refreshed ledger of the unit.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const { id, action } = await params
    if (!(ACTIONS as readonly string[]).includes(action)) {
      return NextResponse.json({ error: 'Unknown action' }, { status: 404 })
    }
    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getDeveloperAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result
    const ctx = { workspaceId, userId: access.userId, canModerate: access.canModerate }

    let payment
    switch (action as Action) {
      case 'confirm':
        payment = await confirmPayment(ctx, id)
        break
      case 'fail':
        payment = await failPayment(ctx, id, body)
        break
      case 'reverse':
        payment = await reversePayment(ctx, id, body)
        break
      case 'refund':
        payment = (await refundPayment(ctx, id, body)).payment
        break
    }

    const call = await prisma.callForFunds.findUnique({ where: { invoiceId: payment.invoiceId }, select: { lotId: true } })
    const ledger = call ? await getLotLedger(ctx, call.lotId) : null
    return NextResponse.json({ payment, ledger })
  } catch (error) {
    return failure(error, 'Failed to update the payment', 'Error updating payment')
  }
}
