import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { getDeveloperDashboard, isDashboardPeriod } from '@/lib/services/developer/dashboard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const workspaceId = params.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getWorkspaceAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const requested = params.get('period')
    const period = isDashboardPeriod(requested) ? requested : 'month'

    const dashboard = await getDeveloperDashboard({ workspaceId, userId: access.userId }, { period })
    return NextResponse.json({ dashboard })
  } catch (error) {
    return failure(error, 'Failed to load dashboard', 'Error loading developer dashboard')
  }
}
