'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRightLeft, CalendarDays, FileText, Loader2, Mail, MessageSquareText, Paperclip,
  Pencil, Receipt, Send, Sparkles, Trash2, UserPlus,
} from 'lucide-react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { relativeTime } from '@/lib/relative-time';

interface TimelineEntry {
  id: string;
  kind: 'note' | 'activity' | 'file' | 'quote' | 'invoice' | 'meeting' | 'email';
  type: string;
  at: string;
  actor: { id: string; name: string | null; email: string } | null;
  data: Record<string, any>;
}

const FILTERS = ['all', 'notes', 'activity', 'files', 'sales', 'emails', 'meetings'] as const;
type Filter = (typeof FILTERS)[number];

const FIELD_KEYS: Record<string, MessageKey> = {
  firstName: 'crm.timeline.fieldFirstName',
  lastName: 'crm.timeline.fieldLastName',
  email: 'crm.timeline.fieldEmail',
  phone: 'crm.timeline.fieldPhone',
  company: 'crm.timeline.fieldCompany',
  position: 'crm.timeline.fieldPosition',
  status: 'crm.timeline.fieldStatus',
  value: 'crm.timeline.fieldValue',
  source: 'crm.timeline.fieldSource',
  notes: 'crm.timeline.fieldNotes',
  tags: 'crm.timeline.fieldTags',
};

export default function LeadTimeline({ leadId, workspaceId }: { leadId: string; workspaceId: string }) {
  const { t, locale, formatDateTime, formatCurrency, formatDate } = useI18n();
  const [filter, setFilter] = useState<Filter>('all');
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [perms, setPerms] = useState({ canWrite: false, canModerate: false, userId: '' });
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (before?: string) => {
      const qs = new URLSearchParams({ filter, ...(before ? { before } : {}) });
      const res = await fetch(`/api/leads/${leadId}/timeline?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('crm.timeline.loadFailed'));
      setPerms({ canWrite: !!data.canWrite, canModerate: !!data.canModerate, userId: data.userId });
      return data as { entries: TimelineEntry[]; nextCursor: string | null };
    },
    [filter, leadId, t]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPage();
      setEntries(data.entries);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('crm.timeline.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [fetchPage, t]);

  useEffect(() => { void reload(); }, [reload]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextCursor);
      setEntries((current) => {
        const seen = new Set(current.map((e) => e.id));
        return [...current, ...data.entries.filter((e) => !seen.has(e.id))];
      });
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('crm.timeline.loadFailed'));
    } finally {
      setLoadingMore(false);
    }
  };

  const addNote = async () => {
    const body = note.trim();
    if (!body || savingNote) return;
    setSavingNote(true);
    setNoteError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('crm.timeline.noteFailed'));
      setNote('');
      await reload();
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : t('crm.timeline.noteFailed'));
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async (id: string) => {
    const res = await fetch(`/api/leads/${leadId}/notes/${id}`, { method: 'DELETE' });
    if (res.ok) setEntries((current) => current.filter((e) => e.id !== id));
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t('crm.timeline.noteFailed'));
    }
  };

  const who = (entry: TimelineEntry) => entry.actor?.name || entry.actor?.email || null;
  const fieldLabel = (field: string) => (FIELD_KEYS[field] ? t(FIELD_KEYS[field]) : field);
  const showValue = (field: string, v: unknown) => {
    if (v === null || v === undefined || v === '') return t('crm.timeline.empty');
    if (field === 'value' && typeof v === 'number') return formatCurrency(v);
    if (Array.isArray(v)) return v.join(', ') || t('crm.timeline.empty');
    return String(v);
  };

  /** Icon, colour and content for one entry. */
  const render = (entry: TimelineEntry) => {
    const d = entry.data;
    switch (entry.type) {
      case 'note_added':
        return {
          icon: MessageSquareText, tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
          title: t('crm.timeline.noteBy', { name: who(entry) ?? t('crm.timeline.someone') }),
          body: <p className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface">{d.body ?? d.description}</p>,
        };
      case 'lead_created':
        return {
          icon: d.via === 'import' ? Sparkles : UserPlus, tone: 'bg-secondary/15 text-secondary',
          title: d.via === 'import' ? t('crm.timeline.createdByImport') : t('crm.timeline.created', { name: who(entry) ?? t('crm.timeline.someone') }),
          body: d.source ? <p className="text-xs text-on-surface-variant">{t('crm.timeline.source', { source: d.source })}</p> : null,
        };
      case 'lead_stage_changed':
        return {
          icon: ArrowRightLeft, tone: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
          title: t('crm.timeline.stageChanged', { from: d.from ?? '?', to: d.to ?? '?' }),
          body: null,
        };
      case 'lead_updated': {
        const changes: Array<{ field: string; from?: unknown; to?: unknown }> = Array.isArray(d.changes) ? d.changes : [];
        return {
          icon: Pencil, tone: 'bg-surface-container-highest text-on-surface-variant',
          title: t('crm.timeline.updated', { name: who(entry) ?? t('crm.timeline.someone') }),
          body: (
            <ul className="mt-1 space-y-0.5 text-xs text-on-surface-variant">
              {changes.map((c) => (
                <li key={c.field}>
                  <span className="font-medium text-on-surface">{fieldLabel(c.field)}</span>
                  {'from' in c || 'to' in c ? (
                    <>: <span className="line-through opacity-70">{showValue(c.field, c.from)}</span> → {showValue(c.field, c.to)}</>
                  ) : (
                    <> {t('crm.timeline.changed')}</>
                  )}
                </li>
              ))}
            </ul>
          ),
        };
      }
      case 'file_added':
      case 'file_deleted':
        return {
          icon: entry.type === 'file_added' ? Paperclip : Trash2,
          tone: entry.type === 'file_added' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-error/10 text-error',
          title: entry.type === 'file_added'
            ? t('crm.timeline.fileAdded', { name: who(entry) ?? t('crm.timeline.someone') })
            : t('crm.timeline.fileDeleted', { name: who(entry) ?? t('crm.timeline.someone') }),
          body: <p className="truncate text-xs text-on-surface-variant">{d.fileName}</p>,
        };
      case 'quote':
        return {
          icon: FileText, tone: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
          title: (
            <Link href={`/quotes/${d.quoteId}?workspace=${workspaceId}`} className="hover:underline">
              {t('crm.timeline.quote', { number: d.number })}
            </Link>
          ),
          body: <p className="text-xs text-on-surface-variant">{formatCurrency(d.total, d.currency || undefined)} · {d.status}</p>,
        };
      case 'invoice':
        return {
          icon: Receipt, tone: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
          title: (
            <Link href={`/invoices/${d.invoiceId}?workspace=${workspaceId}`} className="hover:underline">
              {t('crm.timeline.invoice', { number: d.number })}
            </Link>
          ),
          body: <p className="text-xs text-on-surface-variant">{formatCurrency(d.total, d.currency || undefined)} · {d.status}</p>,
        };
      case 'meeting':
        return {
          icon: CalendarDays, tone: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
          title: t('crm.timeline.meeting', { title: d.title }),
          body: <p className="text-xs text-on-surface-variant">{formatDateTime(d.startTime)} · {d.status}</p>,
        };
      case 'email':
        return {
          icon: d.status === 'opened' || d.status === 'clicked' ? Mail : Send,
          tone: d.bouncedAt ? 'bg-error/10 text-error' : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
          title: t('crm.timeline.emailSent', { subject: d.subject }),
          body: (
            <p className="text-xs text-on-surface-variant">
              {d.campaignName ? `${d.campaignName} · ` : ''}
              {d.bouncedAt ? t('crm.timeline.emailBounced') : d.openedAt ? t('crm.timeline.emailOpened', { date: formatDateTime(d.openedAt) }) : t('crm.timeline.emailNotOpened')}
            </p>
          ),
        };
      default:
        return { icon: Pencil, tone: 'bg-surface-container-highest text-on-surface-variant', title: d.description ?? entry.type, body: null };
    }
  };

  const filterLabel: Record<Filter, MessageKey> = {
    all: 'crm.timeline.filterAll',
    notes: 'crm.timeline.filterNotes',
    activity: 'crm.timeline.filterActivity',
    files: 'crm.timeline.filterFiles',
    sales: 'crm.timeline.filterSales',
    emails: 'crm.timeline.filterEmails',
    meetings: 'crm.timeline.filterMeetings',
  };

  return (
    <div className="space-y-4">
      {perms.canWrite ? (
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void addNote(); } }}
            rows={2}
            maxLength={5000}
            placeholder={t('crm.timeline.notePlaceholder')}
            aria-label={t('crm.timeline.notePlaceholder')}
            className="w-full resize-y rounded-lg bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:ring-2 focus:ring-secondary/40"
          />
          {noteError ? <p className="mt-1 text-xs text-error">{noteError}</p> : null}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="hidden text-xs text-on-surface-variant sm:inline">{t('crm.timeline.noteHint')}</span>
            <button
              type="button"
              onClick={() => void addNote()}
              disabled={!note.trim() || savingNote}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-on-secondary hover:opacity-90 disabled:opacity-40"
            >
              {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquareText className="h-3.5 w-3.5" />}
              {t('crm.timeline.addNote')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('crm.timeline.filterAria')}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {t(filterLabel[f])}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{error}</div> : null}

      {loading ? (
        <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-on-surface-variant" />
      ) : entries.length === 0 ? (
        <p className="rounded-xl bg-surface-container-low px-6 py-8 text-center text-sm text-on-surface-variant">{t('crm.timeline.emptyHistory')}</p>
      ) : (
        <ol className="relative">
          {entries.map((entry, index) => {
            const prev = entries[index - 1];
            const newDay = !prev || new Date(prev.at).toDateString() !== new Date(entry.at).toDateString();
            const view = render(entry);
            const Icon = view.icon;
            const canDeleteNote = entry.type === 'note_added' && perms.canWrite && (perms.canModerate || entry.actor?.id === perms.userId);
            return (
              <Fragment key={entry.id}>
                {newDay ? (
                  <li className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-on-surface-variant first:mt-0">
                    {formatDate(entry.at, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </li>
                ) : null}
                <li className="group relative flex gap-3 pb-4 pl-0.5">
                  {/* rail */}
                  <span aria-hidden className="absolute bottom-0 left-[17px] top-9 w-px bg-outline-variant/20 group-last:hidden" />
                  <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${view.tone}`}>
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-on-surface">{view.title}</p>
                      <div className="flex shrink-0 items-center gap-1">
                        <time dateTime={entry.at} title={formatDateTime(entry.at)} className="text-xs text-on-surface-variant">
                          {relativeTime(entry.at, locale)}
                        </time>
                        {canDeleteNote ? (
                          <button
                            type="button"
                            onClick={() => void deleteNote(entry.id)}
                            aria-label={t('crm.timeline.deleteNote')}
                            title={t('crm.timeline.deleteNote')}
                            className="rounded p-1 text-on-surface-variant opacity-100 hover:text-error sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {view.body}
                  </div>
                </li>
              </Fragment>
            );
          })}
        </ol>
      )}

      {nextCursor ? (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-secondary hover:bg-secondary/10 disabled:opacity-50"
        >
          {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t('crm.timeline.loadMore')}
        </button>
      ) : null}
    </div>
  );
}
