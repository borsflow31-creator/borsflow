import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SchedulingLogger } from '@/lib/scheduling/logger';
import { requireMeetingAccess } from '@/lib/api/workspace';

// GET /api/scheduling/meetings/[id]/notes
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireMeetingAccess(params.id);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    const { session } = access;

    const notes = await prisma.meetingNote.findMany({
      // Private notes are visible only to their author
      where: {
        meetingId: params.id,
        OR: [{ isPrivate: false }, { createdById: session.user.id }],
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

// POST /api/scheduling/meetings/[id]/notes — add a note
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireMeetingAccess(params.id);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    const { session, meeting } = access;

    const body = await request.json();
    const { content, noteType, isPrivate } = body;

    if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 });

    const note = await prisma.meetingNote.create({
      data: {
        meetingId: params.id,
        content,
        noteType: noteType || 'general',
        isPrivate: isPrivate || false,
        createdById: session.user.id,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } }
    });

    // Log activity
    await SchedulingLogger.logActivity(
      meeting.workspaceId,
      session.user.id,
      'note_added',
      'note',
      note.id,
      `Note added to meeting "${meeting.title}"`,
      { noteType },
      params.id,
      meeting.leadId || undefined
    );

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Error adding note:', error);
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
  }
}
