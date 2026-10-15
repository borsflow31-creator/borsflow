import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { getLotLedger, recordCallPayment } from '@/lib/services/developer/collections'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Record money received against a call: full or partial. Answers with the
 * refreshed ledger so the screen does not need a second request. A retry with
 * the same `clientRequestId` answers 200 with the payment made the first time.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: callId } = await params
    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getDeveloperAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const ctx = { workspaceId, userId: result.access.userId }

    const { payment, replayed } = await recordCallPayment(ctx, callId, body)
    const call = await prisma.callForFunds.findUniqueOrThrow({ where: { id: callId }, select: { lotId: true } })
    const ledger = await getLotLedger(ctx, call.lotId)
    return NextResponse.json({ payment, replayed, ledger }, { status: replayed ? 200 : 201 })
  } catch (error) {
    return failure(error, 'Failed to record the payment', 'Error recording call payment')
  }
}
