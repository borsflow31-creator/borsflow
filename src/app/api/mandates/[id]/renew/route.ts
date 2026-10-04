import { capacityError } from '@/lib/billing/capacity'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getMandateAccess } from '@/lib/crm/access'
import { renewMandate } from '@/lib/services/mandates'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'

// POST /api/mandates/[id]/renew  { endDate, renewalTerms? }
// The action the renewal work queue exists for. Also revives an expired mandate.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getMandateAccess(params.id, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    // Renewing an expired mandate puts it back in force, which is a new active mandate.
    const current = await prisma.mandate.findUnique({ where: { id: params.id }, select: { status: true } })
    if (current?.status === 'expired') {
      const full = await capacityError(access.workspaceId, 'activeMandates')
      if (full) return full
    }

    const mandate = await renewMandate(params.id, { workspaceId: access.workspaceId, userId: access.userId }, body)
    return NextResponse.json({ mandate })
  } catch (error) {
    return failure(error, 'Failed to renew mandate', 'Error renewing mandate')
  }
}
