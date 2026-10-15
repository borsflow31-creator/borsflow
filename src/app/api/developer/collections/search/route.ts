import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { searchCollectionClients } from '@/lib/services/developer/collections'

export const dynamic = 'force-dynamic'

/** Buyers to collect from, each with their sold units, found by buyer, unit or programme. */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getDeveloperAccess(workspaceId)
    if ('error' in result) return result.error

    const clients = await searchCollectionClients(
      { workspaceId, userId: result.access.userId },
      searchParams.get('q') ?? '',
      // ?client=<lead id>: that one buyer, with every unit, as when a link reopens them.
      { buyerLeadId: searchParams.get('client') }
    )
    // `targets`, one row per unit, is kept for anything still reading it.
    return NextResponse.json({ clients, targets: clients.flatMap((c) => c.units) })
  } catch (error) {
    return failure(error, 'Failed to search', 'Error searching collection targets')
  }
}
