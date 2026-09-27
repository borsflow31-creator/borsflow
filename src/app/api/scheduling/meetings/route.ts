import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ZoomClient } from '@/lib/scheduling/zoom-client';
import { decrypt } from '@/lib/encryption';
import { requireWorkspaceAccess, leadBelongsToWorkspace } from '@/lib/api/workspace';

/**
 * GET: Lists all meetings for a workspace, optionally filtered by lead or user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const leadId = searchParams.get('leadId');
    const userId = searchParams.get('userId');

    if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

    const access = await requireWorkspaceAccess(workspaceId);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

    const where: any = { workspaceId };
    if (leadId) where.leadId = leadId;
    if (userId) where.userId = userId;

    const meetings = await prisma.meeting.findMany({
      where,
      orderBy: { startTime: 'desc' },
      include: {
        attendees: true,
        user: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });

    return NextResponse.json({ meetings });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}

/**
 * POST: Create a new meeting internally and optionally on a provider (Zoom)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, title, startTime, duration, platform, leadId } = body;

    if (!workspaceId || !title || !startTime || !duration) {
      return NextResponse.json({ error: 'title, startTime, duration, and workspaceId required' }, { status: 400 });
    }

    const access = await requireWorkspaceAccess(workspaceId);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    const { session } = access;

    if (leadId && !(await leadBelongsToWorkspace(leadId, workspaceId))) {
      return NextResponse.json({ error: 'Lead not found in this workspace' }, { status: 400 });
    }

    let meetingUrl = '';
    let platformMeetingId = '';

    // If Zoom is requested, create it via Zoom API
    if (platform === 'zoom') {
      const config = await prisma.videoConferenceConfig.findFirst({
        where: { workspaceId, platform: 'zoom', isActive: true }
      });

      if (config?.accessToken) {
        const zoomClient = new ZoomClient(decrypt(config.accessToken));
        try {
          const zoomMeeting = await zoomClient.createMeeting('me', {
            topic: title,
            start_time: startTime,
            duration: duration,
          });
          meetingUrl = zoomMeeting.join_url;
          platformMeetingId = String(zoomMeeting.id);
        } catch (err: any) {
          console.error('Zoom meeting creation failed:', err.message);
        }
      }
    }

    const meeting = await prisma.meeting.create({
      data: {
        workspaceId,
        title,
        startTime: new Date(startTime),
        endTime: new Date(new Date(startTime).getTime() + duration * 60000),
        duration,
        platform: platform || 'in_person',
        meetingType: platform ? 'online' : 'in_person',
        meetingUrl,
        platformMeetingId,
        leadId,
        userId: session.user.id,
        createdById: session.user.id,
      }
    });

    return NextResponse.json({ meeting });
  } catch (error) {
    console.error('Error creating meeting:', error);
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }
}
