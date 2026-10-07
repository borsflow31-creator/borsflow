import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { deleteSpend } from '@/lib/services/developer/marketing-spend'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }
    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error

    return NextResponse.json(await deleteSpend({ workspaceId, userId: result.access.userId }, id))
  } catch (error) {
    return failure(error, 'Failed to delete spend', 'Error deleting marketing spend')
  }
}
