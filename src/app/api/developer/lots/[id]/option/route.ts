import { NextRequest, NextResponse } from 'next/server'
import { getDeveloperAccess } from '@/lib/crm/access'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'
import { setLotOption, releaseLotOption } from '@/lib/services/developer/lots'

export const dynamic = 'force-dynamic'

/** POST: Put lot on hold / option for a lead with TTL (duration in hours) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lotId } = await params
    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    const leadId = typeof body.leadId === 'string' ? body.leadId : ''
    const durationHours = typeof body.durationHours === 'number' ? body.durationHours : undefined

    if (!workspaceId || !leadId) {
      return NextResponse.json({ error: 'Workspace ID and Lead ID are required' }, { status: 400 })
    }

    const result = await getDeveloperAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const lot = await setLotOption(
      { workspaceId, userId: access.userId },
      lotId,
      { leadId, durationHours }
    )
    return NextResponse.json({ lot })
  } catch (error) {
    return failure(error, 'Failed to set lot option', 'Error setting lot option')
  }
}

/** DELETE: Release option hold and return lot to available */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lotId } = await params
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await getDeveloperAccess(workspaceId, { write: true })
    if ('error' in result) return result.error
    const { access } = result

    const lot = await releaseLotOption({ workspaceId, userId: access.userId }, lotId)
    return NextResponse.json({ lot })
  } catch (error) {
    return failure(error, 'Failed to release lot option', 'Error releasing lot option')
  }
}
