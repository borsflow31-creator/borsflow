import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { approveTMATechnical } from '@/lib/services/developer/tma'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getDeveloperAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const updated = await approveTMATechnical(
      { workspaceId, userId: access.userId },
      id,
      {
        techApproverNote: typeof body.techApproverNote === 'string' ? body.techApproverNote : undefined,
        costEstimate: typeof body.costEstimate === 'number' ? body.costEstimate : undefined,
        priceQuote: typeof body.priceQuote === 'number' ? body.priceQuote : undefined,
      }
    )

    return NextResponse.json({ tma: updated })
  } catch (error) {
    return failure(error, 'Failed to review TMA request', 'Error reviewing TMA request')
  }
}
