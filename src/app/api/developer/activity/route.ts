import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { getTeamActivity } from '@/lib/services/developer/activity-board'
import { isDashboardPeriod } from '@/lib/services/developer/dashboard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const workspaceId = params.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getDeveloperAccess(workspaceId)
    if ('error' in result) return result.error

    const requested = params.get('period')
    const activity = await getTeamActivity(
      { workspaceId, userId: result.access.userId },
      { period: isDashboardPeriod(requested) ? requested : 'month' }
    )
    return NextResponse.json({ activity })
  } catch (error) {
    return failure(error, 'Failed to load team activity', 'Error loading team activity')
  }
}
