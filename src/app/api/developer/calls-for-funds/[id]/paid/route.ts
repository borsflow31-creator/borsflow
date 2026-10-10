import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { markCallForFundsPaid } from '@/lib/services/developer/calls-for-funds'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: callId } = await params
    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getDeveloperAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const call = await markCallForFundsPaid({ workspaceId, userId: access.userId }, callId, {
      paidAt: body.paidAt as string | null | undefined,
      method: body.method as string | null | undefined,
      reference: body.reference as string | null | undefined,
    })
    return NextResponse.json({ call })
  } catch (error) {
    return failure(error, 'Failed to mark call as paid', 'Error marking call as paid')
  }
}
