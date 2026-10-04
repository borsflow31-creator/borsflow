'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import InterestModal from './InterestModal';
import { Badge, STATUS_TONE, errorFrom, primaryButton, useWorkspaceInfo } from './ui';
import BriefsPanel from './BriefsPanel';

interface Row {
    id: string;
    stage: string;
    status: string;
    property: { id: string; title: string; reference: string; city: string; price: number; currency?: string | null };
    offers?: { id: string; amount: number }[];
}

/**
 * The properties one contact is chasing, each with its own stage. A buyer can be
 * at "offer" on one and "viewing booked" on another, which is why the stage lives
 * on the interest and not on the lead.
 */
export default function LeadInterests({
    workspaceId,
    lead,
}: {
    workspaceId: string;
    lead: { id: string; firstName: string; lastName: string; email?: string | null };
}) {
    const { t, formatCurrency } = useI18n();
    const info = useWorkspaceInfo(workspaceId);
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [adding, setAdding] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/interests?workspaceId=${workspaceId}&leadId=${lead.id}`);
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.interests.errors.load')));
            setRows((await res.json()).interests);
        } catch {
            setError(t('realEstate.interests.errors.load'));
        } finally {
            setLoading(false);
        }
    }, [workspaceId, lead.id, t]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="skeleton h-32 rounded-lg" />;

    return (
        <div className="space-y-4">
            {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}
            <div className="flex justify-end">
                <button onClick={() => setAdding(true)} className={primaryButton}>{t('realEstate.interests.attachProperty')}</button>
            </div>
            {rows.length === 0 ? (
                <p className="body-md text-on-surface-variant text-center py-8">{t('realEstate.interests.emptyForLead')}</p>
            ) : (
                <ul className="space-y-3">
                    {rows.map(row => (
                        <li key={row.id} className="bg-surface-container rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <Link href={`/properties/${row.property.id}?workspace=${workspaceId}&tab=interests`} className="title-md text-primary hover:underline">
                                    {row.property.title}
                                </Link>
                                <p className="body-sm text-on-surface-variant">
                                    {row.property.city} · {formatCurrency(row.property.price, row.property.currency || info.currency)}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge>{row.stage}</Badge>
                                {row.status !== 'active' && (
                                    <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{t(`realEstate.interests.status.${row.status}` as MessageKey)}</Badge>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <div className="border-t border-outline-variant/20 pt-6">
                <BriefsPanel workspaceId={workspaceId} lead={lead} />
            </div>

            {adding && (
                <InterestModal
                    workspaceId={workspaceId}
                    lead={lead}
                    onClose={() => setAdding(false)}
                    onSaved={() => { setAdding(false); load(); }}
                />
            )}
        </div>
    );
}
