import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMeetingAccess, leadBelongsToWorkspace } from '@/lib/api/workspace';

// GET /api/scheduling/meetings/[id]/attendees
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireMeetingAccess(params.id);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

    const attendees = await prisma.meetingAttendee.findMany({
      where: { meetingId: params.id },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({ attendees });
  } catch (error) {
    console.error('Error fetching attendees:', error);
    return NextResponse.json({ error: 'Failed to fetch attendees' }, { status: 500 });
  }
}

// POST /api/scheduling/meetings/[id]/attendees — add an attendee
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireMeetingAccess(params.id);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    const { meeting } = access;

    const body = await request.json();
    const { name, email, phone, type, leadId } = body;

    if (!name || !email) return NextResponse.json({ error: 'name and email required' }, { status: 400 });

    if (leadId && !(await leadBelongsToWorkspace(leadId, meeting.workspaceId))) {
      return NextResponse.json({ error: 'Lead not found in this workspace' }, { status: 400 });
    }

    const attendee = await prisma.meetingAttendee.create({
      data: {
        meetingId: params.id,
        name,
        email,
        phone,
        type: type || 'external',
        leadId,
        status: 'invited',
      }
    });

    return NextResponse.json({ attendee });
  } catch (error) {
    // Attendee email is unique per meeting; adding the same person twice used to
    // surface as a 500.
    if ((error as { code?: string } | null)?.code === 'P2002') {
      return NextResponse.json({ error: 'This person is already an attendee of the meeting' }, { status: 409 });
    }
    console.error('Error adding attendee:', error);
    return NextResponse.json({ error: 'Failed to add attendee' }, { status: 500 });
  }
}
