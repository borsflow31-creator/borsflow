import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { getLotLedger } from '@/lib/services/developer/collections'

export const dynamic = 'force-dynamic'

/** A sold unit's calls, payments and balances, for the encaissement panel. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getDeveloperAccess(workspaceId)
    if ('error' in result) return result.error
    const { access } = result

    const ledger = await getLotLedger({ workspaceId, userId: access.userId }, id)
    return NextResponse.json({ ledger, canModerate: access.canModerate, canWrite: access.role !== 'viewer' })
  } catch (error) {
    return failure(error, 'Failed to load the unit', 'Error loading lot ledger')
  }
}
