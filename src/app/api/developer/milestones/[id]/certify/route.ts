import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { certifyMilestone } from '@/lib/services/developer/milestones'

export const dynamic = 'force-dynamic'

/** POST: Certify a construction milestone and auto-generate calls for funds */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: milestoneId } = await params
    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getDeveloperAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const architectCertificateDoc =
      typeof body.architectCertificateDoc === 'string' ? body.architectCertificateDoc : undefined
    const autoGenerateCalls =
      typeof body.autoGenerateCalls === 'boolean' ? body.autoGenerateCalls : true

    const data = await certifyMilestone(
      { workspaceId, userId: access.userId },
      milestoneId,
      { architectCertificateDoc, autoGenerateCalls }
    )

    return NextResponse.json(data)
  } catch (error) {
    return failure(error, 'Failed to certify milestone', 'Error certifying milestone')
  }
}
