import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { listCallPayments } from '@/lib/services/developer/collections'

export const dynamic = 'force-dynamic'

/** The payment journal: every payment on a call for funds, filtered, with confirmed totals. */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const workspaceId = searchParams.get('workspaceId')
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getDeveloperAccess(workspaceId)
    if ('error' in result) return result.error

    const journal = await listCallPayments(
      { workspaceId, userId: result.access.userId },
      {
        from: searchParams.get('from'),
        to: searchParams.get('to'),
        method: searchParams.get('method'),
        status: searchParams.get('status'),
        programId: searchParams.get('programId'),
        recordedBy: searchParams.get('recordedBy'),
        q: searchParams.get('q'),
      }
    )
    return NextResponse.json(journal)
  } catch (error) {
    return failure(error, 'Failed to load payments', 'Error loading payment journal')
  }
}
