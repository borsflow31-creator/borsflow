'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal, Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';
import ContactPicker, { type PickedContact } from '@/components/realestate/ContactPicker';
import { useWorkspaceAgents } from '@/components/developer/useWorkspaceAgents';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { LEAD_TASK_TYPES, SITE_VISIT_OUTCOMES } from '@/lib/crm/lifecycle';

/**
 * The four small forms a salesperson reaches for while working a buyer: log a
 * call, add a follow-up, book a site visit, record how a visit went. They are
 * shared by the buyer's Customer tab and by the Follow-ups and Site visits pages,
 * so a call logged from either place goes through the same request.
 */

/** `datetime-local` wants local wall-clock time without a zone: "2026-10-07T09:00". */
export function toLocalInput(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Tomorrow at 09:00 local: where a follow-up usually belongs. */
function tomorrowMorning(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toLocalInput(d);
}

/** What the server wants: an absolute instant. The input's value is local time. */
function toIso(local: string): string {
    return new Date(local).toISOString();
}

export interface LeadRef { id: string; name: string }

async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string; data?: any }> {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        return res.ok ? { ok: true, data } : { ok: false, error: data?.error };
    } catch {
        return { ok: false };
    }
}

function FormError({ message }: { message: string | null }) {
    return message ? (
        <p role="alert" className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">{message}</p>
    ) : null;
}

function Actions({ onClose, saving, label }: { onClose: () => void; saving: boolean; label: string }) {
    const { t } = useI18n();
    return (
        <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className={secondaryButton} disabled={saving}>{t('common.cancel')}</button>
            <button type="submit" className={`${primaryButton} inline-flex items-center gap-2`} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {label}
            </button>
        </div>
    );
}

/* ─── Log a call ──────────────────────────────────────────── */

export function LogCallModal({
    leadId, leadName, onClose, onDone,
}: { leadId: string; leadName: string; onClose: () => void; onDone: () => void }) {
    const { t } = useI18n();
    const [direction, setDirection] = useState<'outbound' | 'inbound'>('outbound');
    const [answered, setAnswered] = useState(true);
    const [durationMin, setDurationMin] = useState('');
    const [note, setNote] = useState('');
    const [followUpAt, setFollowUpAt] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        const result = await post(`/api/developer/leads/${leadId}/calls`, {
            direction,
            answered,
            durationMin: durationMin.trim() === '' ? undefined : Number(durationMin),
            note: note.trim() || undefined,
            followUpAt: followUpAt ? toIso(followUpAt) : undefined,
        });
        setSaving(false);
        if (!result.ok) return setError(result.error || t('developerCrm.call.failed'));
        onDone();
    };

    return (
        <Modal title={`${t('developerCrm.call.title')}: ${leadName}`} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                <FormError message={error} />
                <div className="grid grid-cols-2 gap-4">
                    <Field label={t('developerCrm.call.direction')}>
                        <select className={inputClass} value={direction} onChange={(e) => setDirection(e.target.value as 'outbound' | 'inbound')}>
                            <option value="outbound">{t('developerCrm.call.outbound')}</option>
                            <option value="inbound">{t('developerCrm.call.inbound')}</option>
                        </select>
                    </Field>
                    <Field label={t('developerCrm.call.answered')}>
                        <select className={inputClass} value={answered ? 'yes' : 'no'} onChange={(e) => setAnswered(e.target.value === 'yes')}>
                            <option value="yes">{t('developerCrm.call.answered')}</option>
                            <option value="no">{t('developerCrm.call.noAnswer')}</option>
                        </select>
                    </Field>
                </div>
                {answered && (
                    <Field label={t('developerCrm.call.duration')}>
                        <input type="number" min={0} max={600} className={inputClass} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
                    </Field>
                )}
                <Field label={t('developerCrm.call.note')}>
                    <textarea className={inputClass} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
                <Field label={t('developerCrm.call.followUp')}>
                    <input type="datetime-local" className={inputClass} value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
                </Field>
                <Actions onClose={onClose} saving={saving} label={t('developerCrm.call.save')} />
            </form>
        </Modal>
    );
}

/* ─── Add a follow-up ─────────────────────────────────────── */

export function TaskModal({
    workspaceId, lead, onClose, onDone,
}: {
    workspaceId: string;
    /** Fixed when opened from a buyer; otherwise the form asks which buyer. */
    lead?: LeadRef;
    onClose: () => void;
    onDone: () => void;
}) {
    const { t } = useI18n();
    const agents = useWorkspaceAgents(workspaceId);
    const [picked, setPicked] = useState<PickedContact | null>(null);
    const [type, setType] = useState<string>('follow_up');
    const [title, setTitle] = useState('');
    const [dueAt, setDueAt] = useState(tomorrowMorning());
    const [assigneeId, setAssigneeId] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const leadId = lead?.id ?? picked?.id;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!leadId) return setError(t('developerCrm.tasks.pickBuyer'));
        setSaving(true);
        setError(null);
        const result = await post('/api/developer/tasks', {
            workspaceId,
            leadId,
            type,
            title: title.trim(),
            dueAt: toIso(dueAt),
            // Empty means "the lead's owner", which the server picks.
            assigneeId: assigneeId || undefined,
        });
        setSaving(false);
        if (!result.ok) return setError(result.error || t('developerCrm.tasks.saveFailed'));
        onDone();
    };

    return (
        <Modal title={t('developerCrm.tasks.add')} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                <FormError message={error} />
                {!lead && (
                    <Field label={t('developerCrm.tasks.buyer')}>
                        <ContactPicker workspaceId={workspaceId} value={picked} onChange={setPicked} placeholder={t('developerCrm.tasks.pickBuyer')} />
                    </Field>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label={t('developerCrm.tasks.type')}>
                        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
                            {LEAD_TASK_TYPES.map((v) => (
                                <option key={v} value={v}>{t(`developerCrm.taskTypes.${v}` as MessageKey)}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label={t('developerCrm.tasks.due')}>
                        <input type="datetime-local" required className={inputClass} value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
                    </Field>
                </div>
                <Field label={t('developerCrm.tasks.titleField')}>
                    <input type="text" required maxLength={200} className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('developerCrm.tasks.titlePlaceholder')} autoFocus />
                </Field>
                <Field label={t('developerCrm.tasks.assignee')}>
                    <select className={inputClass} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                        <option value="">{t('developerCrm.lead.owner')}</option>
                        {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </Field>
                <Actions onClose={onClose} saving={saving} label={t('developerCrm.tasks.save')} />
            </form>
        </Modal>
    );
}

/* ─── Book a site visit ───────────────────────────────────── */

export function SiteVisitModal({
    workspaceId, lead, onClose, onDone,
}: { workspaceId: string; lead?: LeadRef; onClose: () => void; onDone: () => void }) {
    const { t } = useI18n();
    const agents = useWorkspaceAgents(workspaceId);
    const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
    const [lots, setLots] = useState<{ id: string; lotNumber: string; status: string }[]>([]);
    const [picked, setPicked] = useState<PickedContact | null>(null);
    const [programId, setProgramId] = useState('');
    const [lotId, setLotId] = useState('');
    const [startTime, setStartTime] = useState(tomorrowMorning());
    const [duration, setDuration] = useState('45');
    const [hostId, setHostId] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/developer/programs?workspaceId=${workspaceId}`)
            .then((r) => (r.ok ? r.json() : { programs: [] }))
            .then((d) => setPrograms(d.programs ?? []))
            .catch(() => {});
    }, [workspaceId]);

    // Units of the chosen project, available ones first: those are what gets shown.
    useEffect(() => {
        setLotId('');
        if (!programId) return setLots([]);
        fetch(`/api/developer/programs/${programId}/lots?workspaceId=${workspaceId}`)
            .then((r) => (r.ok ? r.json() : { lots: [] }))
            .then((d) =>
                setLots(
                    [...(d.lots ?? [])].sort(
                        (a: any, b: any) => Number(b.status === 'available') - Number(a.status === 'available')
                    )
                )
            )
            .catch(() => setLots([]));
    }, [programId, workspaceId]);

    const leadId = lead?.id ?? picked?.id;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!leadId) return setError(t('developerCrm.tasks.pickBuyer'));
        setSaving(true);
        setError(null);
        const result = await post('/api/developer/site-visits', {
            workspaceId,
            leadId,
            programId,
            lotId: lotId || undefined,
            startTime: toIso(startTime),
            duration: Number(duration) || undefined,
            hostId: hostId || undefined,
            notes: notes.trim() || undefined,
        });
        setSaving(false);
        if (!result.ok) return setError(result.error || t('developerCrm.visits.bookFailed'));
        onDone();
    };

    return (
        <Modal title={t('developerCrm.visits.schedule')} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                <FormError message={error} />
                {!lead && (
                    <Field label={t('developerCrm.tasks.buyer')}>
                        <ContactPicker workspaceId={workspaceId} value={picked} onChange={setPicked} placeholder={t('developerCrm.tasks.pickBuyer')} />
                    </Field>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label={t('developerCrm.visits.project')}>
                        <select required className={inputClass} value={programId} onChange={(e) => setProgramId(e.target.value)}>
                            <option value="" disabled />
                            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </Field>
                    <Field label={t('developerCrm.visits.unit')}>
                        <select className={inputClass} value={lotId} onChange={(e) => setLotId(e.target.value)} disabled={!programId}>
                            <option value="">{t('developerCrm.visits.anyUnit')}</option>
                            {lots.map((l) => <option key={l.id} value={l.id}>{l.lotNumber}</option>)}
                        </select>
                    </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                        <Field label={t('developerCrm.visits.when')}>
                            <input type="datetime-local" required className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </Field>
                    </div>
                    <Field label={t('developerCrm.visits.duration')}>
                        <input type="number" min={5} step={5} className={inputClass} value={duration} onChange={(e) => setDuration(e.target.value)} />
                    </Field>
                </div>
                <Field label={t('developerCrm.visits.host')}>
                    <select className={inputClass} value={hostId} onChange={(e) => setHostId(e.target.value)}>
                        <option value="">—</option>
                        {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </Field>
                <Field label={t('developerCrm.visits.notes')}>
                    <textarea className={inputClass} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
                <Actions onClose={onClose} saving={saving} label={t('developerCrm.visits.book')} />
            </form>
        </Modal>
    );
}

/* ─── Record how a visit went ─────────────────────────────── */

export function SiteVisitOutcomeModal({
    workspaceId, visitId, buyerName, onClose, onDone,
}: { workspaceId: string; visitId: string; buyerName: string; onClose: () => void; onDone: () => void }) {
    const { t } = useI18n();
    const [attended, setAttended] = useState(true);
    const [outcome, setOutcome] = useState<string>('interested');
    const [comments, setComments] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        const result = await post(`/api/developer/site-visits/${visitId}/outcome`, {
            workspaceId,
            attended,
            outcome: attended ? outcome : undefined,
            comments: comments.trim() || undefined,
        });
        setSaving(false);
        if (!result.ok) return setError(result.error || t('developerCrm.visits.saveFailed'));
        onDone();
    };

    const followsUp = !attended || outcome === 'interested' || outcome === 'needs_follow_up';

    return (
        <Modal title={`${t('developerCrm.visits.recordOutcome')}: ${buyerName}`} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                <FormError message={error} />
                <div role="radiogroup" className="grid grid-cols-2 gap-2">
                    {[true, false].map((v) => (
                        <button
                            key={String(v)}
                            type="button"
                            role="radio"
                            aria-checked={attended === v}
                            onClick={() => setAttended(v)}
                            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                attended === v ? 'border-secondary bg-secondary/10 text-secondary' : 'border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            {v ? t('developerCrm.visits.attended') : t('developerCrm.visits.noShow')}
                        </button>
                    ))}
                </div>
                {attended && (
                    <Field label={t('developerCrm.visits.outcome')}>
                        <select className={inputClass} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                            {SITE_VISIT_OUTCOMES.map((o) => (
                                <option key={o} value={o}>{t(`developerCrm.visits.outcome_${o}` as MessageKey)}</option>
                            ))}
                        </select>
                    </Field>
                )}
                <Field label={t('developerCrm.visits.comments')}>
                    <textarea className={inputClass} rows={3} maxLength={2000} value={comments} onChange={(e) => setComments(e.target.value)} />
                </Field>
                {followsUp && <p className="text-xs text-on-surface-variant">{t('developerCrm.visits.followUpNote')}</p>}
                <Actions onClose={onClose} saving={saving} label={t('developerCrm.visits.save')} />
            </form>
        </Modal>
    );
}
