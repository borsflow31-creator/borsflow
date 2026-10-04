'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import SelectRefined from '@/components/ui/SelectRefined';
import ContactPicker, { type PickedContact } from './ContactPicker';
import {
    Badge, Field, Modal, SectionTitle, STATUS_TONE, contactName, dangerButton, errorFrom, inputClass,
    primaryButton, secondaryButton, useWorkspaceInfo,
} from './ui';
import { FEE_PAYERS, FEE_TYPES, MANDATE_TYPES } from '@/lib/crm/lifecycle';

interface PriceChange { id: string; fromPrice: number; toPrice: number; reason?: string | null; changedAt: string }

export interface MandateRecord {
    id: string;
    reference: string;
    mandateType: string;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
    renewalTerms?: string | null;
    askingPrice: number;
    netToVendor?: number | null;
    feeType: string;
    commissionPercent?: number | null;
    feeFixed?: number | null;
    feePayer: string;
    signedAt?: string | null;
    notes?: string | null;
    ownerId?: string | null;
    daysToExpiry?: number | null;
    reportEveryDays?: number | null;
    shareUrl?: string | null;
    lead: { id: string; firstName: string; lastName: string; email?: string | null };
    property: { id: string; title: string; currency?: string | null };
    priceChanges?: PriceChange[];
}

const day = (v?: string | null) => (v ? v.slice(0, 10) : '');

/** "Ends in 12 days" / "Ends today" / "Expired 3 days ago", for the work queue and the panel. */
export function ExpiryLabel({ days }: { days: number | null | undefined }) {
    const { t } = useI18n();
    if (days === null || days === undefined) return <span className="text-on-surface-variant">{t('realEstate.mandates.noEnd')}</span>;
    if (days > 0) return <span className={days <= 30 ? 'text-error' : 'text-on-surface-variant'}>{t('realEstate.mandates.expiresIn', { days })}</span>;
    if (days === 0) return <span className="text-error">{t('realEstate.mandates.endsToday')}</span>;
    return <span className="text-error">{t('realEstate.mandates.expiredAgo', { days: Math.abs(days) })}</span>;
}

/** Create or edit a mandate. The property is fixed by whoever opens it. */
export function MandateFormModal({
    workspaceId,
    property,
    mandate,
    defaultVendor,
    onSaved,
    onClose,
}: {
    workspaceId: string;
    property: { id: string; title: string; price: number };
    mandate?: MandateRecord | null;
    defaultVendor?: PickedContact | null;
    onSaved: () => void;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const info = useWorkspaceInfo(workspaceId);
    const editing = Boolean(mandate);
    const [vendor, setVendor] = useState<PickedContact | null>(mandate?.lead ?? defaultVendor ?? null);
    const [f, setF] = useState({
        reference: mandate?.reference ?? '',
        mandateType: mandate?.mandateType ?? 'simple',
        startDate: day(mandate?.startDate),
        endDate: day(mandate?.endDate),
        renewalTerms: mandate?.renewalTerms ?? '',
        askingPrice: String(mandate?.askingPrice ?? property.price ?? ''),
        netToVendor: mandate?.netToVendor != null ? String(mandate.netToVendor) : '',
        feeType: mandate?.feeType ?? 'percent',
        commissionPercent: mandate?.commissionPercent != null ? String(mandate.commissionPercent) : '',
        feeFixed: mandate?.feeFixed != null ? String(mandate.feeFixed) : '',
        feePayer: mandate?.feePayer ?? 'vendor',
        signedAt: day(mandate?.signedAt),
        ownerId: mandate?.ownerId ?? '',
        notes: mandate?.notes ?? '',
        reportEveryDays: mandate?.reportEveryDays != null ? String(mandate.reportEveryDays) : '',
        activate: false,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(prev => ({ ...prev, [k]: v }));

    const typeOptions = useMemo(() => MANDATE_TYPES.map(v => ({ value: v, label: t(`realEstate.mandates.type.${v}` as MessageKey) })), [t]);
    const feeOptions = useMemo(() => FEE_TYPES.map(v => ({ value: v, label: t(`realEstate.mandates.fee.${v}` as MessageKey) })), [t]);
    const payerOptions = useMemo(() => FEE_PAYERS.map(v => ({ value: v, label: t(`realEstate.mandates.payer.${v}` as MessageKey) })), [t]);
    const agentOptions = useMemo(
        () => [{ value: '', label: t('realEstate.properties.form.ownerNone') }, ...info.agents.map(a => ({ value: a.id, label: a.name }))],
        [info.agents, t]
    );

    const blank = (v: string) => (v.trim() === '' ? null : v.trim());

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendor) return setError(t('realEstate.mandates.form.vendorRequired'));
        if (f.startDate && f.endDate && f.endDate <= f.startDate) return setError(t('realEstate.mandates.errors.dates'));
        setSaving(true);
        setError('');

        const body: Record<string, unknown> = {
            workspaceId,
            propertyId: property.id,
            leadId: vendor.id,
            mandateType: f.mandateType,
            startDate: blank(f.startDate),
            endDate: blank(f.endDate),
            renewalTerms: blank(f.renewalTerms),
            netToVendor: blank(f.netToVendor),
            feeType: f.feeType,
            commissionPercent: f.feeType === 'percent' ? blank(f.commissionPercent) : null,
            feeFixed: f.feeType === 'fixed' ? blank(f.feeFixed) : null,
            feePayer: f.feePayer,
            signedAt: blank(f.signedAt),
            ownerId: f.ownerId || null,
            notes: blank(f.notes),
            reportEveryDays: blank(f.reportEveryDays),
        };
        if (f.reference.trim()) body.reference = f.reference.trim();
        // The asking price is set at creation; afterwards it changes through the
        // price-change action so the history is kept.
        if (!editing) {
            body.askingPrice = blank(f.askingPrice) ?? 0;
            body.status = f.activate ? 'active' : 'draft';
        }

        try {
            const res = await fetch(editing ? `/api/mandates/${mandate!.id}` : '/api/mandates', {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.mandates.errors.save')));
            onSaved();
        } catch {
            setError(t('realEstate.mandates.errors.save'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={editing ? t('realEstate.mandates.edit') : t('realEstate.mandates.new')} onClose={onClose} wide>
            <form onSubmit={submit} className="space-y-4">
                {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}
                <p className="body-md text-on-surface-variant">{property.title}</p>
                <Field label={t('realEstate.mandates.form.vendor')}>
                    <ContactPicker workspaceId={workspaceId} value={vendor} onChange={setVendor} placeholder={t('realEstate.properties.form.vendorNone')} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label={t('realEstate.mandates.form.type')}>
                        <SelectRefined value={f.mandateType} options={typeOptions} onChange={v => set('mandateType', v)} variant="filled" />
                    </Field>
                    <Field label={t('realEstate.mandates.form.reference')}>
                        <input value={f.reference} onChange={e => set('reference', e.target.value)} className={inputClass} placeholder={t('realEstate.mandates.form.referencePlaceholder')} />
                    </Field>
                    <Field label={t('realEstate.mandates.form.startDate')}>
                        <input type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)} className={inputClass} />
                    </Field>
                    <Field label={t('realEstate.mandates.form.endDate')}>
                        <input type="date" value={f.endDate} onChange={e => set('endDate', e.target.value)} className={inputClass} />
                    </Field>
                    <Field label={t('realEstate.mandates.form.signedAt')}>
                        <input type="date" value={f.signedAt} onChange={e => set('signedAt', e.target.value)} className={inputClass} />
                    </Field>
                    {!editing && (
                        <Field label={t('realEstate.mandates.form.askingPrice')}>
                            <input type="number" min={0} step="any" value={f.askingPrice} onChange={e => set('askingPrice', e.target.value)} className={inputClass} />
                        </Field>
                    )}
                    <Field label={t('realEstate.mandates.form.netToVendor')}>
                        <input type="number" min={0} step="any" value={f.netToVendor} onChange={e => set('netToVendor', e.target.value)} className={inputClass} />
                    </Field>
                    <Field label={t('realEstate.mandates.form.feeType')}>
                        <SelectRefined value={f.feeType} options={feeOptions} onChange={v => set('feeType', v)} variant="filled" />
                    </Field>
                    {f.feeType === 'percent' ? (
                        <Field label={t('realEstate.mandates.form.commission')}>
                            <input type="number" min={0} max={100} step="any" value={f.commissionPercent} onChange={e => set('commissionPercent', e.target.value)} className={inputClass} />
                        </Field>
                    ) : (
                        <Field label={t('realEstate.mandates.form.feeFixed')}>
                            <input type="number" min={0} step="any" value={f.feeFixed} onChange={e => set('feeFixed', e.target.value)} className={inputClass} />
                        </Field>
                    )}
                    <Field label={t('realEstate.mandates.form.feePayer')}>
                        <SelectRefined value={f.feePayer} options={payerOptions} onChange={v => set('feePayer', v)} variant="filled" />
                    </Field>
                    <Field label={t('realEstate.mandates.form.owner')}>
                        <SelectRefined value={f.ownerId} options={agentOptions} onChange={v => set('ownerId', v)} variant="filled" />
                    </Field>
                </div>
                <Field label={t('realEstate.mandates.reportEvery')} hint={t('realEstate.mandates.reportNone')}>
                    <input type="number" min={1} max={90} value={f.reportEveryDays} onChange={e => set('reportEveryDays', e.target.value)} className={inputClass} />
                </Field>
                <Field label={t('realEstate.mandates.form.renewalTerms')}>
                    <input value={f.renewalTerms} onChange={e => set('renewalTerms', e.target.value)} className={inputClass} />
                </Field>
                <Field label={t('realEstate.mandates.form.notes')}>
                    <textarea value={f.notes} onChange={e => set('notes', e.target.value)} rows={3} className={`${inputClass} resize-none`} />
                </Field>
                {!editing && (
                    <label className="flex items-center gap-2 body-sm text-on-surface">
                        <input type="checkbox" checked={f.activate} onChange={e => set('activate', e.target.checked)} />
                        {t('realEstate.mandates.activate')}
                    </label>
                )}
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className={secondaryButton}>{t('common.cancel')}</button>
                    <button type="submit" disabled={saving} className={primaryButton}>
                        {saving ? t('common.saving') : editing ? t('realEstate.mandates.form.save') : t('realEstate.mandates.form.create')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

type ActionMode = 'renew' | 'terminate' | 'price';

/** The three small mandate actions: renew, terminate, change the price. */
export function MandateActionDialog({
    mandate,
    mode,
    onDone,
    onClose,
}: {
    mandate: MandateRecord;
    mode: ActionMode;
    onDone: () => void;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [price, setPrice] = useState(String(mandate.askingPrice));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        const call =
            mode === 'renew'
                ? fetch(`/api/mandates/${mandate.id}/renew`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endDate }) })
                : mode === 'price'
                    ? fetch(`/api/mandates/${mandate.id}/price`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price, reason: reason || undefined }) })
                    : fetch(`/api/mandates/${mandate.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'terminated', terminationReason: reason || undefined }) });
        try {
            const res = await call;
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.mandates.errors.save')));
            onDone();
        } catch {
            setError(t('realEstate.mandates.errors.save'));
        } finally {
            setSaving(false);
        }
    };

    const title =
        mode === 'renew' ? t('realEstate.mandates.renewTitle')
        : mode === 'price' ? t('realEstate.mandates.price.reduce')
        : t('realEstate.mandates.terminateTitle');

    return (
        <Modal title={title} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}
                <p className="body-md text-on-surface-variant">{mandate.reference} · {mandate.property.title}</p>
                {mode === 'renew' && (
                    <Field label={t('realEstate.mandates.renewUntil')}>
                        <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
                    </Field>
                )}
                {mode === 'price' && (
                    <Field label={t('realEstate.mandates.price.newPrice')}>
                        <input type="number" min={0} step="any" required value={price} onChange={e => setPrice(e.target.value)} className={inputClass} />
                    </Field>
                )}
                {mode !== 'renew' && (
                    <Field label={mode === 'price' ? t('realEstate.mandates.price.reason') : t('realEstate.mandates.terminateReason')}>
                        <input value={reason} onChange={e => setReason(e.target.value)} className={inputClass} />
                    </Field>
                )}
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className={secondaryButton}>{t('common.cancel')}</button>
                    <button type="submit" disabled={saving} className={mode === 'terminate' ? dangerButton : primaryButton}>
                        {saving ? t('common.saving')
                            : mode === 'renew' ? t('realEstate.mandates.renew')
                            : mode === 'price' ? t('realEstate.mandates.price.save')
                            : t('realEstate.mandates.terminate')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

/** A property's mandates: the current one in full, its price history, the rest below. */
export default function MandatePanel({
    workspaceId,
    property,
    canWrite,
    onChanged,
}: {
    workspaceId: string;
    property: { id: string; title: string; price: number; currency?: string | null; vendor?: PickedContact | null };
    canWrite: boolean;
    onChanged: () => void;
}) {
    const { t, formatCurrency, formatDate } = useI18n();
    const info = useWorkspaceInfo(workspaceId);
    const [mandates, setMandates] = useState<MandateRecord[]>([]);
    const [current, setCurrent] = useState<MandateRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState<{ mandate: MandateRecord | null } | null>(null);
    const [action, setAction] = useState<{ mandate: MandateRecord; mode: ActionMode } | null>(null);
    const [error, setError] = useState('');
    const currency = property.currency || info.currency;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/mandates?workspaceId=${workspaceId}&propertyId=${property.id}`);
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.mandates.errors.load')));
            const data = await res.json();
            const list: MandateRecord[] = data.mandates;
            setMandates(list);
            // The one worth showing in full: the active one, else the newest.
            const focus = list.find(m => m.status === 'active') ?? list[0] ?? null;
            if (focus) {
                const detail = await fetch(`/api/mandates/${focus.id}`);
                setCurrent(detail.ok ? (await detail.json()).mandate : focus);
            } else {
                setCurrent(null);
            }
        } catch {
            setError(t('realEstate.mandates.errors.load'));
        } finally {
            setLoading(false);
        }
    }, [workspaceId, property.id, t]);

    useEffect(() => { load(); }, [load]);

    const changed = () => { setForm(null); setAction(null); load(); onChanged(); };

    /** Mint (or reuse) the vendor report link and copy it. */
    const shareReport = async (mandate: MandateRecord) => {
        const res = await fetch(`/api/mandates/${mandate.id}/share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.mandates.errors.save')));
        const { url } = await res.json();
        try {
            await navigator.clipboard.writeText(url);
            setError('');
            alert(t('realEstate.mandates.vendorLinkCopied'));
        } catch {
            prompt(t('realEstate.mandates.vendorLink'), url);
        }
    };

    const setStatus = async (mandate: MandateRecord, status: string) => {
        const res = await fetch(`/api/mandates/${mandate.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.mandates.errors.save')));
        changed();
    };

    if (loading) return <div className="skeleton h-40 rounded-lg" />;

    return (
        <div className="space-y-6">
            {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}

            {!current ? (
                <div className="bg-surface-container rounded-lg p-8 text-center space-y-3">
                    <p className="body-md text-on-surface-variant">{t('realEstate.mandates.emptyForProperty')}</p>
                    {canWrite && <button onClick={() => setForm({ mandate: null })} className={primaryButton}>{t('realEstate.mandates.new')}</button>}
                </div>
            ) : (
                <div className="bg-surface-container rounded-lg p-5 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="title-md text-on-surface">{current.reference}</p>
                            <p className="body-sm text-on-surface-variant">
                                {t(`realEstate.mandates.type.${current.mandateType}` as MessageKey)} · {contactName(current.lead)}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge tone={STATUS_TONE[current.status] ?? 'neutral'}>{t(`realEstate.mandates.status.${current.status}` as MessageKey)}</Badge>
                            <span className="body-sm"><ExpiryLabel days={current.status === 'active' || current.status === 'expired' ? current.daysToExpiry : null} /></span>
                        </div>
                    </div>

                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 body-sm">
                        <div><dt className="text-on-surface-variant">{t('realEstate.mandates.form.askingPrice')}</dt><dd className="text-on-surface font-medium">{formatCurrency(current.askingPrice, currency)}</dd></div>
                        <div><dt className="text-on-surface-variant">{t('realEstate.mandates.form.startDate')}</dt><dd className="text-on-surface">{current.startDate ? formatDate(current.startDate) : '—'}</dd></div>
                        <div><dt className="text-on-surface-variant">{t('realEstate.mandates.form.endDate')}</dt><dd className="text-on-surface">{current.endDate ? formatDate(current.endDate) : '—'}</dd></div>
                        <div>
                            <dt className="text-on-surface-variant">{current.feeType === 'percent' ? t('realEstate.mandates.form.commission') : t('realEstate.mandates.form.feeFixed')}</dt>
                            <dd className="text-on-surface">{current.feeType === 'percent' ? (current.commissionPercent != null ? `${current.commissionPercent}%` : '—') : current.feeFixed != null ? formatCurrency(current.feeFixed, currency) : '—'}</dd>
                        </div>
                    </dl>
                    {current.renewalTerms && <p className="body-sm text-on-surface-variant">{current.renewalTerms}</p>}

                    {canWrite && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            <button onClick={() => setForm({ mandate: current })} className={secondaryButton}>{t('realEstate.mandates.edit')}</button>
                            <button onClick={() => shareReport(current)} className={secondaryButton}>{t('realEstate.mandates.vendorLink')}</button>
                            {current.status === 'draft' && <button onClick={() => setStatus(current, 'active')} className={primaryButton}>{t('realEstate.mandates.activate')}</button>}
                            {(current.status === 'active' || current.status === 'expired') && (
                                <button onClick={() => setAction({ mandate: current, mode: 'renew' })} className={primaryButton}>{t('realEstate.mandates.renew')}</button>
                            )}
                            {current.status === 'active' && (
                                <>
                                    <button onClick={() => setAction({ mandate: current, mode: 'price' })} className={secondaryButton}>{t('realEstate.mandates.price.reduce')}</button>
                                    <button onClick={() => setStatus(current, 'expired')} className={secondaryButton}>{t('realEstate.mandates.markExpired')}</button>
                                </>
                            )}
                            {['draft', 'active', 'expired'].includes(current.status) && (
                                <button onClick={() => setAction({ mandate: current, mode: 'terminate' })} className={dangerButton}>{t('realEstate.mandates.terminate')}</button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {current && (
                <section>
                    <SectionTitle>{t('realEstate.mandates.price.title')}</SectionTitle>
                    {(current.priceChanges ?? []).length === 0 ? (
                        <p className="body-sm text-on-surface-variant">{t('realEstate.mandates.price.empty')}</p>
                    ) : (
                        <ul className="space-y-2">
                            {current.priceChanges!.map(c => {
                                const pct = c.fromPrice ? Math.abs(((c.toPrice - c.fromPrice) / c.fromPrice) * 100) : 0;
                                const drop = c.toPrice < c.fromPrice;
                                return (
                                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 bg-surface-container rounded px-4 py-2 body-sm">
                                        <span className="text-on-surface">{formatCurrency(c.fromPrice, currency)} → {formatCurrency(c.toPrice, currency)}</span>
                                        <span className={drop ? 'text-error' : 'text-on-surface-variant'}>
                                            {t(drop ? 'realEstate.mandates.price.drop' : 'realEstate.mandates.price.rise', { percent: pct.toFixed(1) })}
                                        </span>
                                        <span className="text-on-surface-variant">{formatDate(c.changedAt)}{c.reason ? ` · ${c.reason}` : ''}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            )}

            {mandates.length > 1 && (
                <section>
                    <SectionTitle>{t('realEstate.mandates.queue.all')}</SectionTitle>
                    <ul className="space-y-2">
                        {mandates.filter(m => m.id !== current?.id).map(m => (
                            <li key={m.id} className="flex items-center justify-between bg-surface-container rounded px-4 py-2 body-sm">
                                <span className="text-on-surface">{m.reference} · {contactName(m.lead)}</span>
                                <Badge tone={STATUS_TONE[m.status] ?? 'neutral'}>{t(`realEstate.mandates.status.${m.status}` as MessageKey)}</Badge>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {current && canWrite && !mandates.some(m => m.status === 'active') && (
                <button onClick={() => setForm({ mandate: null })} className={secondaryButton}>{t('realEstate.mandates.new')}</button>
            )}

            {form && (
                <MandateFormModal
                    workspaceId={workspaceId}
                    property={property}
                    mandate={form.mandate}
                    defaultVendor={property.vendor}
                    onSaved={changed}
                    onClose={() => setForm(null)}
                />
            )}
            {action && <MandateActionDialog mandate={action.mandate} mode={action.mode} onDone={changed} onClose={() => setAction(null)} />}
        </div>
    );
}
