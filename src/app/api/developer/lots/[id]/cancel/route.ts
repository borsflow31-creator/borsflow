import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { cancelLotSale } from '@/lib/services/developer/lots'

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
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const outcome = await cancelLotSale(
      { workspaceId, userId: access.userId },
      lotId,
      {
        reason: typeof body.reason === 'string' ? body.reason : undefined,
        refundAmount: body.refundAmount as number | string | undefined,
      }
    )
    return NextResponse.json(outcome)
  } catch (error) {
    return failure(error, 'Failed to cancel sale', 'Error cancelling sale')
  }
}
