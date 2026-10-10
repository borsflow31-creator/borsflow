import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { recordSiteVisitOutcome } from '@/lib/services/developer/site-visits'

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

    const visit = await recordSiteVisitOutcome({ workspaceId, userId: result.access.userId }, id, body)
    return NextResponse.json({ visit })
  } catch (error) {
    return failure(error, 'Failed to record outcome', 'Error recording site visit outcome')
  }
}
