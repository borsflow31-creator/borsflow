import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { completeTask, deleteTask, reopenTask, updateTask } from '@/lib/services/developer/tasks'

export const dynamic = 'force-dynamic'

/**
 * Edit a follow-up, or move it between open and done with `action`:
 * { action: 'complete' | 'reopen' }. Any other fields edit the task.
 */
export async function PATCH(
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
    const ctx = { workspaceId, userId: result.access.userId }

    if (body.action === 'complete') return NextResponse.json({ task: await completeTask(ctx, id) })
    if (body.action === 'reopen') return NextResponse.json({ task: await reopenTask(ctx, id) })
    if (body.action !== undefined) {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    return NextResponse.json({ task: await updateTask(ctx, id, body as any) })
  } catch (error) {
    return failure(error, 'Failed to update follow-up', 'Error updating follow-up')
  }
}

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

    const result = await getDeveloperAccess(workspaceId, { write: true })
    if ('error' in result) return result.error

    return NextResponse.json(await deleteTask({ workspaceId, userId: result.access.userId }, id))
  } catch (error) {
    return failure(error, 'Failed to delete follow-up', 'Error deleting follow-up')
  }
}
