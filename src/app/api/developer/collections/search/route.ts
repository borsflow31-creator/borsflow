import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { searchCollectionTargets } from '@/lib/services/developer/collections'

export const dynamic = 'force-dynamic'

/** Sold units to collect from, by buyer, unit or programme. */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getDeveloperAccess(workspaceId)
    if ('error' in result) return result.error

    const targets = await searchCollectionTargets(
      { workspaceId, userId: result.access.userId },
      searchParams.get('q') ?? ''
    )
    return NextResponse.json({ targets })
  } catch (error) {
    return failure(error, 'Failed to search', 'Error searching collection targets')
  }
}
