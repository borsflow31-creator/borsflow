import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { getProgram, updateProgram, deleteProgram } from '@/lib/services/developer/programs'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const program = await getProgram({ workspaceId, userId: access.userId }, id)
    return NextResponse.json({ program })
  } catch (error) {
    return failure(error, 'Failed to fetch program', 'Error fetching program')
  }
}

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

    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const program = await updateProgram({ workspaceId, userId: access.userId }, id, body as any)
    return NextResponse.json({ program })
  } catch (error) {
    return failure(error, 'Failed to update program', 'Error updating program')
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

    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const res = await deleteProgram({ workspaceId, userId: access.userId }, id)
    return NextResponse.json(res)
  } catch (error) {
    return failure(error, 'Failed to delete program', 'Error deleting program')
  }
}
