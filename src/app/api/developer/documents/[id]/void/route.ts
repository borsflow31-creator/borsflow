import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { voidDocument } from '@/lib/services/developer/sales-documents'

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
    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error

    const document = await voidDocument({ workspaceId, userId: result.access.userId, canModerate: result.access.canModerate }, id)
    return NextResponse.json({ document })
  } catch (error) {
    return failure(error, 'Failed to void document', 'Error voiding document')
  }
}
