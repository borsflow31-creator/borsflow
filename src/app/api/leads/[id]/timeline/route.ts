import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLeadAccess } from '@/lib/crm/lead-access';

const PAGE_SIZE = 30;

export type TimelineKind = 'note' | 'activity' | 'file' | 'quote' | 'invoice' | 'meeting' | 'email';
const FILTER_KINDS: Record<string, TimelineKind[]> = {
  all: ['note', 'activity', 'file', 'quote', 'invoice', 'meeting', 'email'],
  notes: ['note'],
  activity: ['activity'],
  files: ['file'],
  sales: ['quote', 'invoice'],
  emails: ['email'],
  meetings: ['meeting'],
};

type Actor = { id: string; name: string | null; email: string } | null;

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  type: string;
  at: string;
  actor: Actor;
  data: Record<string, unknown>;
}

const parse = (json: string | null): Record<string, unknown> => {
  if (!json) return {};
  try {
    const value = JSON.parse(json);
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
};

// GET /api/leads/[id]/timeline?filter=all|notes|activity|files|sales|emails|meetings&before=ISO
// Everything that happened to a prospect, newest first: notes, stage and field
// changes, files, quotes, invoices, meetings and emails sent to them. Each
// source is read up to one page past the cursor, merged, and cut to a page.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const result = await getLeadAccess(params.id);
  if ('error' in result) return result.error;
  const { access } = result;

  const filter = request.nextUrl.searchParams.get('filter') ?? 'all';
  const kinds = new Set(FILTER_KINDS[filter] ?? FILTER_KINDS.all);
  const beforeRaw = request.nextUrl.searchParams.get('before');
  const before = beforeRaw && !isNaN(Date.parse(beforeRaw)) ? new Date(beforeRaw) : null;
  const createdBefore = before ? { lt: before } : undefined;
  const take = PAGE_SIZE + 1;
  const userSelect = { select: { id: true, name: true, email: true } } as const;

  // Notes and files are Activity rows too; "activity" means every other event.
  const NOTE_FILE_TYPES = ['note_added', 'file_added', 'file_deleted'];
  const wantActivity = kinds.has('note') || kinds.has('activity') || kinds.has('file');
  const activityTypeFilter =
    filter === 'notes' ? { type: 'note_added' }
      : filter === 'files' ? { type: { in: ['file_added', 'file_deleted'] } }
        : filter === 'activity' ? { type: { notIn: NOTE_FILE_TYPES } }
          : {};

  const [activities, quotes, invoices, meetings, emails] = await Promise.all([
    wantActivity
      ? prisma.activity.findMany({
          where: {
            leadId: params.id,
            workspaceId: access.workspaceId,
            createdAt: createdBefore,
            ...activityTypeFilter,
          },
          orderBy: { createdAt: 'desc' },
          take,
          include: { user: userSelect },
        })
      : [],
    kinds.has('quote')
      ? prisma.quote.findMany({
          where: { leadId: params.id, workspaceId: access.workspaceId, createdAt: createdBefore },
          orderBy: { createdAt: 'desc' },
          take,
          select: { id: true, quoteNumber: true, status: true, total: true, currency: true, createdAt: true },
        })
      : [],
    kinds.has('invoice')
      ? prisma.invoice.findMany({
          where: { leadId: params.id, workspaceId: access.workspaceId, createdAt: createdBefore },
          orderBy: { createdAt: 'desc' },
          take,
          select: { id: true, invoiceNumber: true, status: true, total: true, currency: true, createdAt: true },
        })
      : [],
    kinds.has('meeting')
      ? prisma.meeting.findMany({
          where: { leadId: params.id, workspaceId: access.workspaceId, createdAt: createdBefore },
          orderBy: { createdAt: 'desc' },
          take,
          select: { id: true, title: true, startTime: true, status: true, createdAt: true },
        })
      : [],
    kinds.has('email')
      ? prisma.emailRecipient.findMany({
          where: {
            leadId: params.id,
            email: { workspaceId: access.workspaceId },
            sentAt: before ? { not: null, lt: before } : { not: null },
          },
          orderBy: { sentAt: 'desc' },
          take,
          select: {
            id: true,
            status: true,
            sentAt: true,
            openedAt: true,
            bouncedAt: true,
            email: { select: { subject: true, campaign: { select: { id: true, name: true } } } },
          },
        })
      : [],
  ]);

  const entries: TimelineEntry[] = [
    ...activities.map((a): TimelineEntry => ({
      id: a.id,
      kind: a.type === 'note_added' ? 'note' : a.type.startsWith('file_') ? 'file' : 'activity',
      type: a.type,
      at: a.createdAt.toISOString(),
      actor: a.user,
      data: { description: a.description, ...parse(a.metadata), meetingId: a.meetingId },
    })),
    ...quotes.map((q): TimelineEntry => ({
      id: `quote-${q.id}`, kind: 'quote', type: 'quote', at: q.createdAt.toISOString(), actor: null,
      data: { quoteId: q.id, number: q.quoteNumber, status: q.status, total: q.total, currency: q.currency },
    })),
    ...invoices.map((i): TimelineEntry => ({
      id: `invoice-${i.id}`, kind: 'invoice', type: 'invoice', at: i.createdAt.toISOString(), actor: null,
      data: { invoiceId: i.id, number: i.invoiceNumber, status: i.status, total: i.total, currency: i.currency },
    })),
    ...meetings.map((m): TimelineEntry => ({
      id: `meeting-${m.id}`, kind: 'meeting', type: 'meeting', at: m.createdAt.toISOString(), actor: null,
      data: { meetingId: m.id, title: m.title, startTime: m.startTime.toISOString(), status: m.status },
    })),
    ...emails.map((e): TimelineEntry => ({
      id: `email-${e.id}`, kind: 'email', type: 'email', at: e.sentAt!.toISOString(), actor: null,
      data: {
        subject: e.email.subject,
        status: e.status,
        openedAt: e.openedAt?.toISOString() ?? null,
        bouncedAt: e.bouncedAt?.toISOString() ?? null,
        campaignName: e.email.campaign?.name ?? null,
      },
    })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || (a.id < b.id ? 1 : -1));

  const page = entries.slice(0, PAGE_SIZE);
  return NextResponse.json({
    entries: page,
    nextCursor: entries.length > PAGE_SIZE ? page[page.length - 1].at : null,
    canWrite: access.role !== 'viewer',
    canModerate: access.canModerate,
    userId: access.userId,
  });
}
