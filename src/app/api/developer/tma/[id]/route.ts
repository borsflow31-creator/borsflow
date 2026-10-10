import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { getTMARequest, deleteTMARequest } from '@/lib/services/developer/tma'

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

    const result = await getDeveloperAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const tma = await getTMARequest({ workspaceId, userId: access.userId }, id)
    return NextResponse.json({ tma })
  } catch (error) {
    return failure(error, 'Failed to fetch TMA request', 'Error fetching TMA request')
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
    const { access } = result

    const res = await deleteTMARequest({ workspaceId, userId: access.userId }, id)
    return NextResponse.json(res)
  } catch (error) {
    return failure(error, 'Failed to delete TMA request', 'Error deleting TMA request')
  }
}
