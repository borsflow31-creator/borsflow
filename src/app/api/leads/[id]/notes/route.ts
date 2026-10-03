import { NextRequest, NextResponse } from 'next/server';
import { getLeadAccess } from '@/lib/crm/lead-access';
import { CrmLogger } from '@/lib/crm/logger';

const MAX_NOTE_LENGTH = 5000;

// POST /api/leads/[id]/notes  { body }
// Adds a timestamped note to the prospect's history. Unlike the single "Notes"
// field on the form, earlier notes are never overwritten.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const result = await getLeadAccess(params.id, { write: true });
  if ('error' in result) return result.error;
  const { access } = result;

  let body: unknown;
  try {
    body = (await request.json())?.body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const text = typeof body === 'string' ? body.trim() : '';
  if (!text) return NextResponse.json({ error: 'Write something first' }, { status: 400 });
  if (text.length > MAX_NOTE_LENGTH) {
    return NextResponse.json({ error: `Notes can be at most ${MAX_NOTE_LENGTH} characters` }, { status: 400 });
  }

  const note = await CrmLogger.logActivity(
    access.workspaceId,
    access.userId,
    'note_added',
    params.id,
    text.length > 120 ? `${text.slice(0, 117)}…` : text,
    { body: text },
    params.id
  );
  if (!note) return NextResponse.json({ error: 'Could not save the note' }, { status: 500 });

  return NextResponse.json({ id: note.id }, { status: 201 });
}
