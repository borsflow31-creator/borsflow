import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { setDocumentVisibility } from '@/lib/services/developer/sales-documents'

export const dynamic = 'force-dynamic'

/** Change who can see a reservation form or contract: `{ workspaceId, visibility: 'team' | 'managers' }`. */
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

    const document = await setDocumentVisibility(
      { workspaceId, userId: result.access.userId, canModerate: result.access.canModerate },
      id,
      body.visibility
    )
    return NextResponse.json({ document })
  } catch (error) {
    return failure(error, 'Failed to change visibility', 'Error changing document visibility')
  }
}
