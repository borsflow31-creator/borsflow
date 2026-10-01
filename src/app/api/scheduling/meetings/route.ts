import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceAccess } from '@/lib/api/workspace';
import { createMeeting } from '@/lib/services/meetings';
import { ServiceError } from '@/lib/services/errors';

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

    const meeting = await createMeeting({
      workspaceId,
      userId: session.user.id,
      title,
      startTime,
      duration,
      platform,
      leadId,
    });

    return NextResponse.json({ meeting });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating meeting:', error);
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }
}
