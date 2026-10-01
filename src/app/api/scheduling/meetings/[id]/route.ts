import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ZoomClient } from '@/lib/scheduling/zoom-client';
import { decrypt } from '@/lib/encryption';
import { requireMeetingAccess } from '@/lib/api/workspace';
import { notify } from '@/lib/notifications/notify';

// PATCH /api/scheduling/meetings/[id] — update status or other fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireMeetingAccess(params.id);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    const { session, meeting } = access;

    const body = await request.json();
    const { id } = params;

    // If cancelling a Zoom meeting, also cancel on Zoom
    if (body.status === 'cancelled' && meeting.platform === 'zoom' && meeting.platformMeetingId) {
      try {
        const config = await prisma.videoConferenceConfig.findFirst({
          where: { workspaceId: meeting.workspaceId, platform: 'zoom', isActive: true }
        });
        if (config?.accessToken) {
          const zoomClient = new ZoomClient(decrypt(config.accessToken));
          await zoomClient.deleteMeeting(meeting.platformMeetingId);
        }
      } catch (err: any) {
        console.error('Failed to cancel Zoom meeting externally:', err.message);
      }
    }

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        ...(body.status      && { status: body.status, ...(body.status === 'cancelled' ? { cancelledAt: new Date(), cancellationReason: body.reason } : {}) }),
        ...(body.title       && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        updatedBy: session.user.id,
      },
      include: { attendees: true, lead: true }
    });

    if (body.status === 'cancelled' && updated.userId) {
      void notify({
        recipients: [updated.userId],
        type: 'meetings.cancelled',
        workspaceId: updated.workspaceId,
        actorId: session.user.id,
        title: `Meeting cancelled: ${updated.title}`,
        body: body.reason || undefined,
        href: `/meetings?workspace=${updated.workspaceId}`,
      });
    }

    return NextResponse.json({ meeting: updated });
  } catch (error) {
    console.error('Error updating meeting:', error);
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 });
  }
}

// DELETE /api/scheduling/meetings/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireMeetingAccess(params.id);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

    await prisma.meeting.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 });
  }
}

// GET /api/scheduling/meetings/[id] — single meeting detail
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireMeetingAccess(params.id);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    const { session } = access;

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: {
        attendees: true,
        // Private notes are visible only to their author
        notes:     { where: { OR: [{ isPrivate: false }, { createdById: session.user.id }] } },
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
        lead:      { select: { id: true, firstName: true, lastName: true, email: true } },
        user:      { select: { id: true, name: true, email: true } },
      }
    });

    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    return NextResponse.json({ meeting });
  } catch (error) {
    console.error('Error fetching meeting:', error);
    return NextResponse.json({ error: 'Failed to fetch meeting' }, { status: 500 });
  }
}
