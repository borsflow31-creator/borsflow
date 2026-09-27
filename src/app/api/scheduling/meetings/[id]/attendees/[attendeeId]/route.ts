import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMeetingAccess } from '@/lib/api/workspace';

// PATCH /api/scheduling/meetings/[id]/attendees/[attendeeId] — update status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; attendeeId: string } }
) {
  try {
    const access = await requireMeetingAccess(params.id);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

    // The attendee must belong to the meeting whose workspace was just authorized
    const existing = await prisma.meetingAttendee.findFirst({
      where: { id: params.attendeeId, meetingId: params.id },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });

    const body = await request.json();

    const attendee = await prisma.meetingAttendee.update({
      where: { id: params.attendeeId },
      data: {
        ...(body.status && { status: body.status, responseAt: new Date() }),
        ...(body.name   && { name: body.name }),
        ...(body.phone  !== undefined && { phone: body.phone }),
      },
    });

    return NextResponse.json({ attendee });
  } catch (error) {
    console.error('Error updating attendee:', error);
    return NextResponse.json({ error: 'Failed to update attendee' }, { status: 500 });
  }
}

// DELETE /api/scheduling/meetings/[id]/attendees/[attendeeId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; attendeeId: string } }
) {
  try {
    const access = await requireMeetingAccess(params.id);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

    const existing = await prisma.meetingAttendee.findFirst({
      where: { id: params.attendeeId, meetingId: params.id },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });

    await prisma.meetingAttendee.delete({ where: { id: params.attendeeId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting attendee:', error);
    return NextResponse.json({ error: 'Failed to delete attendee' }, { status: 500 });
  }
}
