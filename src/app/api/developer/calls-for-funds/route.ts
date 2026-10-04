import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { listCallsForFunds } from '@/lib/services/developer/calls-for-funds'

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

    const calls = await listCallsForFunds(
      { workspaceId, userId: access.userId },
      { programId, lotId, status }
    )

    return NextResponse.json({ calls })
  } catch (error) {
    return failure(error, 'Failed to fetch calls for funds', 'Error fetching calls for funds')
  }
}
