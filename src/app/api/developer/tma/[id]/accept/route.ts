import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure, readBody } from '@/lib/api/respond'
import { acceptTMARequest } from '@/lib/services/developer/tma'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await readBody(request)

    const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const signedAddendumDoc =
      typeof body?.signedAddendumDoc === 'string' ? body.signedAddendumDoc : undefined

    const updated = await acceptTMARequest(
      { workspaceId, userId: access.userId },
      id,
      { signedAddendumDoc }
    )

    return NextResponse.json({ tma: updated })
  } catch (error) {
    return failure(error, 'Failed to accept TMA request', 'Error accepting TMA request')
  }
}
