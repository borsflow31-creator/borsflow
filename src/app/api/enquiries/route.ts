import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { receiveEnquiry } from '@/lib/services/intake'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'

// POST /api/enquiries  { workspaceId, leadId?, firstName, lastName, email?, phone?, message?, propertyId? }
//
// `leadId` is an existing contact the agent picked from the list; without it the
// name and address given are de-duplicated as a website enquiry would be.
//
// An agent logging an enquiry that came by phone or in person. It lands through the
// same intake as the website form -- de-duplicated by
// address, attached to the property named, logged, and starting any lead_created
// automation -- so a manual enquiry is not a second-class path.
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request)
    if (!body) return INVALID_BODY()
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const result = await getWorkspaceAccess(workspaceId, { write: true })
    if ('error' in result) return result.error

    const outcome = await receiveEnquiry({
      workspaceId,
      channel: 'manual',
      actorId: result.access.userId,
      firstName: body.firstName as string,
      lastName: body.lastName as string,
      email: body.email as string,
      phone: body.phone as string,
      message: body.message as string,
      leadId: body.leadId as string,
      propertyId: body.propertyId as string,
      propertyReference: body.propertyReference as string,
    })
    return NextResponse.json(outcome, { status: outcome.created ? 201 : 200 })
  } catch (error) {
    return failure(error, 'Failed to record the enquiry', 'Error recording enquiry')
  }
}
