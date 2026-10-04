'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import SelectRefined from '@/components/ui/SelectRefined';
import { Badge, Field, Modal, STATUS_TONE, contactName, errorFrom, inputClass, primaryButton, secondaryButton } from './ui';
import { FINANCING_TYPES, OFFER_CONDITION_TYPES } from '@/lib/crm/lifecycle';

export interface OfferRow {
    id: string;
    amount: number;
    currency?: string | null;
    status: string;
    offeredAt: string;
    expiresAt?: string | null;
    depositAmount?: number | null;
    financingType?: string | null;
    conditions: { type: string; note: string }[];
    competing: number;
    decisionReason?: string | null;
    publicToken?: string | null;
    lead: { id: string; firstName: string; lastName: string };
    property: { id: string; title: string; reference: string };
    interestId: string;
}

interface BuyerOption { id: string; lead: { firstName: string; lastName: string } }

/** Record an offer from one of the buyers already attached to the property. */
export function OfferFormModal({
    workspaceId,
    propertyId,
    interestId,
    onSaved,
    onClose,
}: {
    workspaceId: string;
    propertyId: string;
    interestId?: string;
    onSaved: () => void;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const [buyers, setBuyers] = useState<BuyerOption[]>([]);
    const [buyerId, setBuyerId] = useState(interestId ?? '');
    const [amount, setAmount] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [deposit, setDeposit] = useState('');
    const [financing, setFinancing] = useState('');
    const [conditions, setConditions] = useState<{ type: string; note: string }[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`/api/interests?workspaceId=${workspaceId}&propertyId=${propertyId}&status=active`)
            .then(res => (res.ok ? res.json() : { interests: [] }))
            .then(data => setBuyers(data.interests ?? []))
            .catch(() => {});
    }, [workspaceId, propertyId]);

    const buyerOptions = useMemo(
        () => [{ value: '', label: t('realEstate.interests.form.buyerPlaceholder') }, ...buyers.map(b => ({ value: b.id, label: contactName(b.lead) }))],
        [buyers, t]
    );
    const financingOptions = useMemo(
        () => [{ value: '', label: t('realEstate.offers.form.financingNone') }, ...FINANCING_TYPES.map(v => ({ value: v, label: t(`realEstate.offers.financing.${v}` as MessageKey) }))],
        [t]
    );
    const conditionOptions = useMemo(
        () => OFFER_CONDITION_TYPES.map(v => ({ value: v, label: t(`realEstate.offers.condition.${v}` as MessageKey) })),
        [t]
    );

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!buyerId) return setError(t('realEstate.offers.form.buyerRequired'));
        if (!amount || Number(amount) <= 0) return setError(t('realEstate.offers.form.amountRequired'));
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/offers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId,
                    interestId: buyerId,
                    amount,
                    expiresAt: expiresAt || undefined,
                    depositAmount: deposit || undefined,
                    financingType: financing || undefined,
                    conditions: conditions.filter(c => c.type),
                }),
            });
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.offers.errors.save')));
            onSaved();
        } catch {
            setError(t('realEstate.offers.errors.save'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={t('realEstate.offers.new')} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}
                <Field label={t('realEstate.offers.form.buyer')}>
                    <SelectRefined value={buyerId} options={buyerOptions} onChange={setBuyerId} variant="filled" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label={t('realEstate.offers.form.amount')}>
                        <input type="number" min={0} step="any" required value={amount} onChange={e => setAmount(e.target.value)} className={inputClass} />
                    </Field>
                    <Field label={t('realEstate.offers.form.expiresAt')}>
                        <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className={inputClass} />
                    </Field>
                    <Field label={t('realEstate.offers.form.deposit')}>
                        <input type="number" min={0} step="any" value={deposit} onChange={e => setDeposit(e.target.value)} className={inputClass} />
                    </Field>
                    <Field label={t('realEstate.offers.form.financing')}>
                        <SelectRefined value={financing} options={financingOptions} onChange={setFinancing} variant="filled" />
                    </Field>
                </div>

                <div className="space-y-2">
                    <p className="body-sm text-on-surface-variant">{t('realEstate.offers.form.conditions')}</p>
                    {conditions.map((c, i) => (
                        <div key={i} className="flex gap-2">
                            <div className="w-40 shrink-0">
                                <SelectRefined value={c.type} options={conditionOptions} onChange={v => setConditions(prev => prev.map((x, j) => (j === i ? { ...x, type: v } : x)))} variant="filled" size="sm" />
                            </div>
                            <input
                                value={c.note}
                                onChange={e => setConditions(prev => prev.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                                placeholder={t('realEstate.offers.form.conditionNote')}
                                className={inputClass}
                            />
                            <button type="button" onClick={() => setConditions(prev => prev.filter((_, j) => j !== i))} className="text-on-surface-variant hover:text-error px-2" aria-label={t('common.remove')}>×</button>
                        </div>
                    ))}
                    {conditions.length < 10 && (
                        <button type="button" onClick={() => setConditions(prev => [...prev, { type: 'finance', note: '' }])} className="body-sm text-primary hover:underline">
                            + {t('realEstate.offers.form.addCondition')}
                        </button>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className={secondaryButton}>{t('common.cancel')}</button>
                    <button type="submit" disabled={saving} className={primaryButton}>{saving ? t('common.saving') : t('realEstate.offers.form.create')}</button>
                </div>
            </form>
        </Modal>
    );
}

/** Offers, highest first, with the accept / reject / withdraw actions and the vendor link. */
export default function OffersPanel({
    workspaceId,
    propertyId,
    status,
    canWrite,
    currency,
    refreshKey = 0,
    onChanged,
    onRecord,
}: {
    workspaceId: string;
    propertyId?: string;
    status?: string;
    canWrite: boolean;
    currency: string;
    refreshKey?: number;
    onChanged: () => void;
    /** Opens the record-an-offer form; shown only when a property is fixed. */
    onRecord?: () => void;
}) {
    const { t, formatCurrency, formatDate } = useI18n();
    const [offers, setOffers] = useState<OfferRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [accepting, setAccepting] = useState<OfferRow | null>(null);
    const [acceptBusy, setAcceptBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const params = new URLSearchParams({ workspaceId });
            if (propertyId) params.set('propertyId', propertyId);
            if (status) params.set('status', status);
            const res = await fetch(`/api/offers?${params}`);
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.offers.errors.load')));
            setOffers((await res.json()).offers);
        } catch {
            setError(t('realEstate.offers.errors.load'));
        } finally {
            setLoading(false);
        }
    }, [workspaceId, propertyId, status, t]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const decide = async (offer: OfferRow, action: 'reject' | 'withdraw') => {
        const key = action === 'reject' ? 'realEstate.offers.reject.title' : 'realEstate.offers.withdraw.title';
        if (!confirm(t(key as MessageKey))) return;
        setError('');
        const res = await fetch(`/api/offers/${offer.id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.offers.errors.decide')));
        await load();
        onChanged();
    };

    const accept = async () => {
        if (!accepting) return;
        setAcceptBusy(true);
        setError('');
        try {
            const res = await fetch(`/api/offers/${accepting.id}/accept`, { method: 'POST' });
            if (!res.ok) setError(await errorFrom(res, t('realEstate.offers.errors.decide')));
            setAccepting(null);
            await load();
            onChanged();
        } finally {
            setAcceptBusy(false);
        }
    };

    const share = async (offer: OfferRow, rotate = false) => {
        const res = await fetch(`/api/offers/${offer.id}/share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rotate }) });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.offers.errors.decide')));
        const { url } = await res.json();
        try {
            await navigator.clipboard.writeText(url);
            setNotice(t('realEstate.offers.share.copied'));
        } catch {
            prompt(t('realEstate.offers.share.action'), url);
        }
        await load();
    };

    if (loading) return <div className="skeleton h-40 rounded-lg" />;

    const pending = offers.filter(o => o.status === 'pending');
    const highest = pending.reduce<number | null>((m, o) => (m === null || o.amount > m ? o.amount : m), null);

    return (
        <div className="space-y-4">
            {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}
            {notice && <p className="body-sm text-on-surface bg-surface-container rounded px-3 py-2" role="status">{notice}</p>}
            {canWrite && onRecord && (
                <div className="flex justify-end">
                    <button onClick={onRecord} className={primaryButton}>{t('realEstate.offers.new')}</button>
                </div>
            )}
            {pending.length > 1 && <p className="body-sm text-on-surface-variant">{t('realEstate.offers.competing', { count: pending.length })}</p>}

            {offers.length === 0 ? (
                <p className="body-md text-on-surface-variant text-center py-10">
                    {propertyId ? t('realEstate.offers.emptyForProperty') : t('realEstate.offers.empty')}
                </p>
            ) : (
                <ul className="space-y-3">
                    {offers.map(offer => (
                        <li key={offer.id} className="bg-surface-container rounded-lg p-4 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="headline-sm text-on-surface">{formatCurrency(offer.amount, offer.currency || currency)}</p>
                                    <p className="body-sm text-on-surface-variant">
                                        {contactName(offer.lead)}
                                        {!propertyId && (
                                            <> · <Link href={`/properties/${offer.property.id}?workspace=${workspaceId}&tab=offers`} className="text-primary hover:underline">{offer.property.title}</Link></>
                                        )}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {offer.status === 'pending' && offer.amount === highest && pending.length > 1 && <Badge tone="info">{t('realEstate.offers.highest')}</Badge>}
                                    <Badge tone={STATUS_TONE[offer.status] ?? 'neutral'}>{t(`realEstate.offers.status.${offer.status}` as MessageKey)}</Badge>
                                </div>
                            </div>

                            <p className="body-xs text-on-surface-variant">
                                {formatDate(offer.offeredAt)}
                                {offer.expiresAt && ` · ${t('realEstate.offers.validUntil', { date: formatDate(offer.expiresAt) })}`}
                                {offer.financingType && ` · ${t(`realEstate.offers.financing.${offer.financingType}` as MessageKey)}`}
                                {offer.depositAmount != null && ` · ${t('realEstate.offers.form.deposit')} ${formatCurrency(offer.depositAmount, offer.currency || currency)}`}
                            </p>
                            {offer.conditions.length > 0 && (
                                <ul className="flex flex-wrap gap-2">
                                    {offer.conditions.map((c, i) => (
                                        <li key={i}><Badge>{t(`realEstate.offers.condition.${c.type}` as MessageKey)}{c.note ? `: ${c.note}` : ''}</Badge></li>
                                    ))}
                                </ul>
                            )}
                            {offer.decisionReason && offer.status !== 'pending' && (
                                <p className="body-xs text-on-surface-variant">
                                    {t((`realEstate.offers.decisionReason.${offer.decisionReason}` as MessageKey), {}) }
                                </p>
                            )}

                            {canWrite && (
                                <div className="flex flex-wrap items-center gap-2">
                                    {offer.status === 'pending' && (
                                        <>
                                            <button onClick={() => setAccepting(offer)} className={primaryButton}>{t('realEstate.offers.accept.action')}</button>
                                            <button onClick={() => decide(offer, 'reject')} className={secondaryButton}>{t('realEstate.offers.reject.action')}</button>
                                            <button onClick={() => share(offer)} className={secondaryButton} title={t('realEstate.offers.share.hint')}>{t('realEstate.offers.share.action')}</button>
                                            {offer.publicToken && (
                                                <button onClick={() => share(offer, true)} className="body-xs text-on-surface-variant hover:underline">{t('realEstate.offers.share.rotate')}</button>
                                            )}
                                        </>
                                    )}
                                    {['pending', 'accepted'].includes(offer.status) && (
                                        <button onClick={() => decide(offer, 'withdraw')} className="body-sm text-error hover:underline ml-auto">{t('realEstate.offers.withdraw.action')}</button>
                                    )}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {accepting && (
                <Modal title={t('realEstate.offers.accept.title')} onClose={() => !acceptBusy && setAccepting(null)}>
                    <div className="space-y-4">
                        <p className="body-md text-on-surface">
                            {formatCurrency(accepting.amount, accepting.currency || currency)} · {contactName(accepting.lead)}
                        </p>
                        <p className="body-sm text-on-surface-variant">{t('realEstate.offers.accept.body')}</p>
                        {(() => {
                            const rivals = pending.filter(o => o.id !== accepting.id);
                            return rivals.length > 0 ? (
                                <div className="bg-error-container/40 rounded-lg p-3 space-y-2">
                                    <p className="body-sm text-on-surface">{t('realEstate.offers.accept.competing', { count: rivals.length })}</p>
                                    <ul className="space-y-1">
                                        {rivals.map(o => (
                                            <li key={o.id} className="body-sm text-on-surface-variant">
                                                {formatCurrency(o.amount, o.currency || currency)} · {contactName(o.lead)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null;
                        })()}
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setAccepting(null)} disabled={acceptBusy} className={secondaryButton}>{t('common.cancel')}</button>
                            <button onClick={accept} disabled={acceptBusy} className={primaryButton}>
                                {acceptBusy ? t('common.saving') : t('realEstate.offers.accept.confirm')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
