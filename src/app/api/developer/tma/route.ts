import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { listTMARequests, createTMARequest } from '@/lib/services/developer/tma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const programId = searchParams.get('programId') || undefined
    const lotId = searchParams.get('lotId') || undefined
    const status = searchParams.get('status') || undefined
    const category = searchParams.get('category') || undefined

    const requests = await listTMARequests(
      { workspaceId, userId: access.userId },
      { programId, lotId, status, category }
    )

    return NextResponse.json({ requests })
  } catch (error) {
    return failure(error, 'Failed to fetch TMA requests', 'Error fetching TMA requests')
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
    const { access } = result

    const tma = await createTMARequest({ workspaceId, userId: access.userId }, body as any)
    return NextResponse.json({ tma }, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to create TMA request', 'Error creating TMA request')
  }
}
