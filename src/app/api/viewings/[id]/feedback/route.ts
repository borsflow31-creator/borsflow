import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { recordViewingFeedback } from '@/lib/services/viewings'
import { failure, readBody, INVALID_BODY } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/** The viewing's workspace, from the record, never from the client. */
async function workspaceOf(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, select: { workspaceId: true, propertyId: true } })
  return meeting && meeting.propertyId ? meeting : null
}

// GET /api/viewings/[id]/feedback  ([id] is the meeting id)
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const meeting = await workspaceOf(params.id)
    if (!meeting) return NextResponse.json({ error: 'Viewing not found' }, { status: 404 })

    const result = await getWorkspaceAccess(meeting.workspaceId)
    if ('error' in result) return result.error

    const feedback = await prisma.viewingFeedback.findUnique({ where: { meetingId: params.id } })
    return NextResponse.json({ feedback })
  } catch (error) {
    return failure(error, 'Failed to fetch feedback', 'Error fetching viewing feedback')
  }
}

// PUT /api/viewings/[id]/feedback
//   { attended?, interestLevel?, priceVerdict?, conditionVerdict?, locationVerdict?,
//     layoutVerdict?, comments? }
// One feedback row per viewing, so this creates it the first time and revises it
// after, rather than adding a second row the vendor report would double-count.
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const meeting = await workspaceOf(params.id)
    if (!meeting) return NextResponse.json({ error: 'Viewing not found' }, { status: 404 })

    const result = await getWorkspaceAccess(meeting.workspaceId, { write: true })
    if ('error' in result) return result.error

    const body = await readBody(request)
    if (!body) return INVALID_BODY()

    const feedback = await recordViewingFeedback(params.id, { workspaceId: meeting.workspaceId, userId: result.access.userId }, body)
    return NextResponse.json({ feedback })
  } catch (error) {
    return failure(error, 'Failed to save feedback', 'Error saving viewing feedback')
  }
}
