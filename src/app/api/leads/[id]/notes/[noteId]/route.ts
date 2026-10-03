import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLeadAccess } from '@/lib/crm/lead-access';

// DELETE /api/leads/[id]/notes/[noteId]
// Authors can delete their own notes; the owner and admins can delete any.
export async function DELETE(_request: NextRequest, { params }: { params: { id: string; noteId: string } }) {
  const result = await getLeadAccess(params.id, { write: true });
  if ('error' in result) return result.error;
  const { access } = result;

  const note = await prisma.activity.findFirst({
    where: { id: params.noteId, leadId: params.id, type: 'note_added' },
    select: { id: true, userId: true },
  });
  if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  if (note.userId !== access.userId && !access.canModerate) {
    return NextResponse.json({ error: 'You can only delete your own notes' }, { status: 403 });
  }

  await prisma.activity.delete({ where: { id: note.id } });
  return NextResponse.json({ success: true });
}
