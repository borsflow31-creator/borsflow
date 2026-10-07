import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { listSpend, saveSpend } from '@/lib/services/developer/marketing-spend'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }
    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error

    const spend = await listSpend({ workspaceId, userId: result.access.userId })
    return NextResponse.json({ spend })
  } catch (error) {
    return failure(error, 'Failed to fetch spend', 'Error fetching marketing spend')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }
    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error

    const spend = await saveSpend({ workspaceId, userId: result.access.userId }, body)
    return NextResponse.json({ spend })
  } catch (error) {
    return failure(error, 'Failed to save spend', 'Error saving marketing spend')
  }
}
