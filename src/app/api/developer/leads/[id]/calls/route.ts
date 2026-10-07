import { NextRequest, NextResponse } from 'next/server'
import { getLeadAccess } from '@/lib/crm/lead-access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { logCall } from '@/lib/services/developer/calls'

export const dynamic = 'force-dynamic'

/** Log a phone call with a lead. Access comes from the lead, not the request. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const result = await getLeadAccess(id, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const logged = await logCall({ workspaceId: access.workspaceId, userId: access.userId }, id, body)
    return NextResponse.json({ task: logged.task }, { status: 201 })
  } catch (error) {
    return failure(error, 'Failed to log call', 'Error logging call')
  }
}
