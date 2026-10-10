'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { stageLabel } from '@/components/crm/labels';
import SelectRefined from '@/components/ui/SelectRefined';
import InterestModal from './InterestModal';
import { Badge, STATUS_TONE, contactName, errorFrom, primaryButton, secondaryButton } from './ui';

export interface InterestRow {
    id: string;
    stage: string;
    status: string;
    source?: string | null;
    notes?: string | null;
    lostReason?: string | null;
    lead: { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null };
    owner?: { id: string; name?: string | null } | null;
    offers?: { id: string; amount: number; currency?: string | null }[];
}

/**
 * The buyers attached to one property, each with their own stage. This is the
 * point of the Interest model: the stage here belongs to this buyer on this
 * property, not to the buyer as a whole.
 */
export default function InterestsPanel({
    workspaceId,
    property,
    canWrite,
    currency,
    onChanged,
    onBookViewing,
    onMakeOffer,
}: {
    workspaceId: string;
    property: { id: string; title: string; reference: string; city: string };
    canWrite: boolean;
    currency: string;
    onChanged: () => void;
    onBookViewing: (interest: InterestRow) => void;
    onMakeOffer: (interest: InterestRow) => void;
}) {
    const { t, formatCurrency } = useI18n();
    const [rows, setRows] = useState<InterestRow[]>([]);
    const [stages, setStages] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const [interests, pipelines] = await Promise.all([
                fetch(`/api/interests?workspaceId=${workspaceId}&propertyId=${property.id}`),
                fetch(`/api/pipelines?workspaceId=${workspaceId}`),
            ]);
            if (!interests.ok) return setError(await errorFrom(interests, t('realEstate.interests.errors.load')));
            setRows((await interests.json()).interests);
            if (pipelines.ok) {
                const list: { subjectType?: string; stages: string[] }[] = await pipelines.json();
                setStages(list.find(p => p.subjectType === 'Interest')?.stages ?? []);
            }
        } catch {
            setError(t('realEstate.interests.errors.load'));
        } finally {
            setLoading(false);
        }
    }, [workspaceId, property.id, t]);

    useEffect(() => { load(); }, [load]);

    const patch = async (id: string, body: Record<string, unknown>) => {
        setError('');
        const res = await fetch(`/api/interests/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.interests.errors.save')));
        await load();
        onChanged();
    };

    const remove = async (row: InterestRow) => {
        if (!confirm(t('realEstate.interests.removeConfirm'))) return;
        const res = await fetch(`/api/interests/${row.id}`, { method: 'DELETE' });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.interests.errors.delete')));
        await load();
        onChanged();
    };

    const markLost = (row: InterestRow) => {
        const reason = prompt(t('realEstate.interests.lostReason'));
        if (reason === null) return;
        patch(row.id, { status: 'lost', lostReason: reason || undefined });
    };

    if (loading) return <div className="skeleton h-40 rounded-lg" />;

    const stageOptions = (current: string) => Array.from(new Set([...stages, current])).map(s => ({ value: s, label: stageLabel(s, t) }));

    return (
        <div className="space-y-4">
            {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}
            {canWrite && (
                <div className="flex justify-end">
                    <button onClick={() => setAdding(true)} className={primaryButton}>{t('realEstate.interests.new')}</button>
                </div>
            )}

            {rows.length === 0 ? (
                <p className="body-md text-on-surface-variant text-center py-10">{t('realEstate.interests.empty')}</p>
            ) : (
                <ul className="space-y-3">
                    {rows.map(row => {
                        const best = (row.offers ?? []).reduce<number | null>((m, o) => (m === null || o.amount > m ? o.amount : m), null);
                        return (
                            <li key={row.id} className="bg-surface-container rounded-lg p-4 space-y-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="title-md text-on-surface">{contactName(row.lead)}</p>
                                        <p className="body-sm text-on-surface-variant">
                                            {[row.lead.email, row.lead.phone].filter(Boolean).join(' · ')}
                                        </p>
                                        {row.source && <p className="body-xs text-on-surface-variant">{t(`realEstate.interests.source.${row.source}` as MessageKey)}</p>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{t(`realEstate.interests.status.${row.status}` as MessageKey)}</Badge>
                                        {best !== null && <Badge tone="info">{formatCurrency(best, row.offers?.[0]?.currency || currency)}</Badge>}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="w-56">
                                        <SelectRefined
                                            value={row.stage}
                                            options={stageOptions(row.stage)}
                                            onChange={v => v !== row.stage && patch(row.id, { stage: v })}
                                            disabled={!canWrite}
                                            variant="filled"
                                            size="sm"
                                        />
                                    </div>
                                    {canWrite && row.status === 'active' && (
                                        <>
                                            <button onClick={() => onBookViewing(row)} className={secondaryButton}>{t('realEstate.viewings.new')}</button>
                                            <button onClick={() => onMakeOffer(row)} className={secondaryButton}>{t('realEstate.offers.new')}</button>
                                            <button onClick={() => patch(row.id, { status: 'won' })} className="body-sm text-primary hover:underline">{t('realEstate.interests.markWon')}</button>
                                            <button onClick={() => markLost(row)} className="body-sm text-error hover:underline">{t('realEstate.interests.markLost')}</button>
                                        </>
                                    )}
                                    {canWrite && row.status !== 'active' && (
                                        <button onClick={() => patch(row.id, { status: 'active' })} className="body-sm text-primary hover:underline">{t('realEstate.interests.reopen')}</button>
                                    )}
                                    {canWrite && <button onClick={() => remove(row)} className="body-sm text-on-surface-variant hover:text-error ml-auto">{t('realEstate.interests.remove')}</button>}
                                </div>
                                {row.status === 'lost' && row.lostReason && <p className="body-xs text-on-surface-variant">{row.lostReason}</p>}
                            </li>
                        );
                    })}
                </ul>
            )}

            {adding && (
                <InterestModal
                    workspaceId={workspaceId}
                    property={property}
                    onClose={() => setAdding(false)}
                    onSaved={() => { setAdding(false); load(); onChanged(); }}
                />
            )}
        </div>
    );
}
