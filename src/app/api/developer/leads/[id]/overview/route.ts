import { NextRequest, NextResponse } from 'next/server'
import { getLeadAccess } from '@/lib/crm/lead-access'
import { failure } from '@/lib/api/respond'
import { getCustomerOverview } from '@/lib/services/developer/customer'
import { refuseNonDeveloper } from '@/lib/crm/access'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await getLeadAccess(id)
    if ('error' in result) return result.error
    const notDeveloper = await refuseNonDeveloper(result.access.workspaceId)
    if (notDeveloper) return notDeveloper
    const { access } = result

    const overview = await getCustomerOverview(
      { workspaceId: access.workspaceId, userId: access.userId },
      id,
      access.canModerate
    )
    return NextResponse.json({ overview })
  } catch (error) {
    return failure(error, 'Failed to load customer', 'Error loading customer overview')
  }
}
