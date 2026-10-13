import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { listSelectableLots } from '@/lib/services/developer/lot-picker'

export const dynamic = 'force-dynamic'

/** Available units for the lead form's unit picker, searched server-side. */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const workspaceId = params.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getDeveloperAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const lots = await listSelectableLots(
      { workspaceId, userId: access.userId },
      { programId: params.get('programId') || undefined, q: params.get('q') || undefined }
    )
    return NextResponse.json({ lots })
  } catch (error) {
    return failure(error, 'Failed to fetch units', 'Error fetching selectable units')
  }
}
