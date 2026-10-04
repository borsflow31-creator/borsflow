'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import SelectRefined from '@/components/ui/SelectRefined';
import ContactPicker, { type PickedContact } from './ContactPicker';
import PropertyPicker, { type PickedProperty } from './PropertyPicker';
import { Badge, Field, Modal, STATUS_TONE, contactName, errorFrom, inputClass, primaryButton, secondaryButton } from './ui';
import { VERDICTS, VERDICT_DIMENSIONS, type Verdict } from '@/lib/crm/lifecycle';

interface Feedback {
    attended: boolean;
    interestLevel?: number | null;
    priceVerdict?: Verdict | null;
    conditionVerdict?: Verdict | null;
    locationVerdict?: Verdict | null;
    layoutVerdict?: Verdict | null;
    comments?: string | null;
}

export interface ViewingRow {
    id: string;
    title: string;
    startTime: string;
    status: string;
    interestId?: string | null;
    property: { id: string; title: string; reference: string; city: string };
    lead?: { id: string; firstName: string; lastName: string } | null;
    viewingFeedback?: Feedback | null;
}

const VERDICT_TONE: Record<string, 'good' | 'warn' | 'bad'> = { positive: 'good', neutral: 'warn', negative: 'bad' };

/** Book a viewing: a meeting plus the property shown and the buyer. */
export function ViewingFormModal({
    workspaceId,
    property,
    lead,
    interestId,
    onSaved,
    onClose,
}: {
    workspaceId: string;
    property?: PickedProperty | null;
    lead?: PickedContact | null;
    interestId?: string;
    onSaved: () => void;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const [picked, setPicked] = useState<PickedProperty | null>(property ?? null);
    const [buyer, setBuyer] = useState<PickedContact | null>(lead ?? null);
    const [start, setStart] = useState('');
    const [duration, setDuration] = useState('30');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!picked) return setError(t('realEstate.viewings.schedule.propertyRequired'));
        if (!start) return setError(t('realEstate.viewings.schedule.startRequired'));
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/viewings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId,
                    propertyId: picked.id,
                    interestId: interestId || undefined,
                    leadId: interestId ? undefined : buyer?.id,
                    // datetime-local is wall-clock time in the browser's zone; send an
                    // absolute instant so the server does not reinterpret it as UTC.
                    startTime: new Date(start).toISOString(),
                    duration,
                    title: t('realEstate.viewings.schedule.titleFor', { property: picked.title }),
                    notes: notes.trim() || undefined,
                }),
            });
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.viewings.errors.save')));
            onSaved();
        } catch {
            setError(t('realEstate.viewings.errors.save'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={t('realEstate.viewings.schedule.title')} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}
                <Field label={t('realEstate.viewings.schedule.property')}>
                    <PropertyPicker workspaceId={workspaceId} value={picked} onChange={setPicked} placeholder={t('realEstate.properties.searchPlaceholder')} />
                </Field>
                {!interestId && (
                    <Field label={t('realEstate.viewings.schedule.buyer')}>
                        <ContactPicker workspaceId={workspaceId} value={buyer} onChange={setBuyer} placeholder={t('realEstate.viewings.schedule.buyerNone')} />
                    </Field>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label={t('realEstate.viewings.schedule.start')}>
                        <input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} className={inputClass} />
                    </Field>
                    <Field label={t('realEstate.viewings.schedule.duration')}>
                        <input type="number" min={5} step={5} value={duration} onChange={e => setDuration(e.target.value)} className={inputClass} />
                    </Field>
                </div>
                <Field label={t('realEstate.viewings.schedule.notes')}>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={`${inputClass} resize-none`} />
                </Field>
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className={secondaryButton}>{t('common.cancel')}</button>
                    <button type="submit" disabled={saving} className={primaryButton}>{saving ? t('common.saving') : t('realEstate.viewings.schedule.submit')}</button>
                </div>
            </form>
        </Modal>
    );
}

/** Structured feedback: a verdict per dimension, an interest level, free text. */
export function FeedbackModal({
    viewing,
    onSaved,
    onClose,
}: {
    viewing: ViewingRow;
    onSaved: () => void;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const existing = viewing.viewingFeedback;
    const [attended, setAttended] = useState(existing?.attended ?? true);
    const [level, setLevel] = useState<number | null>(existing?.interestLevel ?? null);
    const [verdicts, setVerdicts] = useState<Record<string, string>>({
        price: existing?.priceVerdict ?? '',
        condition: existing?.conditionVerdict ?? '',
        location: existing?.locationVerdict ?? '',
        layout: existing?.layoutVerdict ?? '',
    });
    const [comments, setComments] = useState(existing?.comments ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const verdictOptions = useMemo(
        () => [{ value: '', label: t('realEstate.viewings.feedback.verdictNone') }, ...VERDICTS.map(v => ({ value: v, label: t(`realEstate.viewings.feedback.verdict.${v}` as MessageKey) }))],
        [t]
    );

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`/api/viewings/${viewing.id}/feedback`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attended,
                    interestLevel: attended ? level : null,
                    priceVerdict: verdicts.price || null,
                    conditionVerdict: verdicts.condition || null,
                    locationVerdict: verdicts.location || null,
                    layoutVerdict: verdicts.layout || null,
                    comments: comments.trim() || null,
                }),
            });
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.viewings.errors.feedback')));
            onSaved();
        } catch {
            setError(t('realEstate.viewings.errors.feedback'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={t('realEstate.viewings.feedback.title')} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}
                <p className="body-md text-on-surface-variant">{viewing.property.title}{viewing.lead ? ` · ${contactName(viewing.lead)}` : ''}</p>

                <label className="flex items-center gap-2 body-sm text-on-surface">
                    <input type="checkbox" checked={attended} onChange={e => setAttended(e.target.checked)} />
                    {t('realEstate.viewings.feedback.attended')}
                </label>

                {attended && (
                    <>
                        <div>
                            <p className="body-sm text-on-surface-variant mb-2">{t('realEstate.viewings.feedback.interestLevel')}</p>
                            <div className="flex gap-2" role="radiogroup" aria-label={t('realEstate.viewings.feedback.interestLevel')}>
                                {[1, 2, 3, 4, 5].map(n => (
                                    <button
                                        key={n}
                                        type="button"
                                        role="radio"
                                        aria-checked={level === n}
                                        onClick={() => setLevel(level === n ? null : n)}
                                        className={`w-10 h-10 rounded-lg body-md transition-colors ${level === n ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {VERDICT_DIMENSIONS.map(dim => (
                                <Field key={dim} label={t(`realEstate.viewings.feedback.dimensions.${dim}` as MessageKey)}>
                                    <SelectRefined value={verdicts[dim]} options={verdictOptions} onChange={v => setVerdicts(prev => ({ ...prev, [dim]: v }))} variant="filled" />
                                </Field>
                            ))}
                        </div>
                    </>
                )}

                <Field label={t('realEstate.viewings.feedback.comments')}>
                    <textarea value={comments} onChange={e => setComments(e.target.value)} rows={4} className={`${inputClass} resize-none`} />
                </Field>
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className={secondaryButton}>{t('common.cancel')}</button>
                    <button type="submit" disabled={saving} className={primaryButton}>{saving ? t('common.saving') : t('realEstate.viewings.feedback.save')}</button>
                </div>
            </form>
        </Modal>
    );
}

/** Viewings, with the feedback beside each one and the action to record it. */
export default function ViewingsList({
    workspaceId,
    propertyId,
    when,
    canWrite,
    refreshKey = 0,
    onChanged,
    onBook,
}: {
    workspaceId: string;
    propertyId?: string;
    when?: 'upcoming' | 'past' | 'needs_feedback';
    canWrite: boolean;
    refreshKey?: number;
    onChanged?: () => void;
    onBook?: () => void;
}) {
    const { t, formatDateTime } = useI18n();
    const [rows, setRows] = useState<ViewingRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [feedbackFor, setFeedbackFor] = useState<ViewingRow | null>(null);

    const load = useCallback(async () => {
        try {
            const params = new URLSearchParams({ workspaceId });
            if (propertyId) params.set('propertyId', propertyId);
            if (when) params.set('when', when);
            const res = await fetch(`/api/viewings?${params}`);
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.viewings.errors.load')));
            setRows((await res.json()).viewings);
        } catch {
            setError(t('realEstate.viewings.errors.load'));
        } finally {
            setLoading(false);
        }
    }, [workspaceId, propertyId, when, t]);

    useEffect(() => { load(); }, [load, refreshKey]);

    if (loading) return <div className="skeleton h-40 rounded-lg" />;

    return (
        <div className="space-y-4">
            {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}
            {canWrite && onBook && (
                <div className="flex justify-end">
                    <button onClick={onBook} className={primaryButton}>{t('realEstate.viewings.new')}</button>
                </div>
            )}

            {rows.length === 0 ? (
                <p className="body-md text-on-surface-variant text-center py-10">
                    {propertyId ? t('realEstate.viewings.emptyForProperty') : t('realEstate.viewings.empty')}
                </p>
            ) : (
                <ul className="space-y-3">
                    {rows.map(v => {
                        const fb = v.viewingFeedback;
                        const past = new Date(v.startTime).getTime() < Date.now();
                        return (
                            <li key={v.id} className="bg-surface-container rounded-lg p-4 space-y-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="title-md text-on-surface">{formatDateTime(v.startTime)}</p>
                                        <p className="body-sm text-on-surface-variant">
                                            {v.lead ? contactName(v.lead) : t('realEstate.viewings.schedule.buyerNone')}
                                            {!propertyId && (
                                                <> · <Link href={`/properties/${v.property.id}?workspace=${workspaceId}&tab=viewings`} className="text-primary hover:underline">{v.property.title}</Link></>
                                            )}
                                        </p>
                                    </div>
                                    <Badge tone={STATUS_TONE[v.status] ?? 'neutral'}>{t(`realEstate.viewings.status.${v.status}` as MessageKey)}</Badge>
                                </div>

                                {fb ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        {fb.interestLevel != null && <Badge tone="info">{t('realEstate.viewings.feedback.summary', { level: fb.interestLevel })}</Badge>}
                                        {VERDICT_DIMENSIONS.map(dim => {
                                            const verdict = fb[`${dim}Verdict` as keyof Feedback] as string | null | undefined;
                                            return verdict ? (
                                                <Badge key={dim} tone={VERDICT_TONE[verdict]}>
                                                    {t(`realEstate.viewings.feedback.dimensions.${dim}` as MessageKey)}: {t(`realEstate.viewings.feedback.verdict.${verdict}` as MessageKey)}
                                                </Badge>
                                            ) : null;
                                        })}
                                    </div>
                                ) : past && v.lead && v.status !== 'cancelled' ? (
                                    <p className="body-xs text-error">{t('realEstate.viewings.needsFeedback')}</p>
                                ) : null}
                                {fb?.comments && <p className="body-sm text-on-surface-variant">{fb.comments}</p>}

                                {canWrite && v.lead && v.status !== 'cancelled' && (
                                    <button onClick={() => setFeedbackFor(v)} className={secondaryButton}>
                                        {fb ? t('realEstate.viewings.feedback.edit') : t('realEstate.viewings.feedback.add')}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {feedbackFor && (
                <FeedbackModal
                    viewing={feedbackFor}
                    onClose={() => setFeedbackFor(null)}
                    onSaved={() => { setFeedbackFor(null); load(); onChanged?.(); }}
                />
            )}
        </div>
    );
}
