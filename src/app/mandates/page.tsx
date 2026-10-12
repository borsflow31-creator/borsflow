'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { ExpiryLabel, MandateActionDialog, type MandateRecord } from '@/components/realestate/MandatePanel';
import { Badge, STATUS_TONE, contactName, errorFrom, primaryButton, secondaryButton, useWorkspaceInfo } from '@/components/realestate/ui';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { StandaloneGuide } from '@/components/ui/PageHeader';

const QUEUES = ['expiring', 'active', 'expired', 'all'] as const;
type Queue = (typeof QUEUES)[number];

type Row = MandateRecord & { property: MandateRecord['property'] & { city?: string } };

/**
 * The renewal work queue. A mandate is time-bounded authority to sell, so its
 * expiry is a list of calls to make: "expiring" is what to ring about today,
 * "expired" is what has come off the market.
 */
function MandatesPageInner() {
    const { t, formatCurrency } = useI18n();
    const { workspaceId, ready } = useWorkspaceParam();
    const info = useWorkspaceInfo(workspaceId);
    const [queue, setQueue] = useState<Queue>('expiring');
    const [rows, setRows] = useState<Row[]>([]);
    const [counts, setCounts] = useState({ expiring: 0, active: 0, expired: 0 });
    const [windowDays, setWindowDays] = useState(30);
    const [canWrite, setCanWrite] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [renewing, setRenewing] = useState<Row | null>(null);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/mandates?workspaceId=${workspaceId}&queue=${queue}`);
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.mandates.errors.load')));
            const data = await res.json();
            setRows(data.mandates);
            setCounts(data.counts);
            setWindowDays(data.windowDays);
            setCanWrite(Boolean(data.canWrite));
            setError('');
        } catch {
            setError(t('realEstate.mandates.errors.load'));
        } finally {
            setLoading(false);
        }
    }, [workspaceId, queue, t]);

    useEffect(() => { load(); }, [load]);

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <NoWorkspace />;

    return (
        <AppShell
            workspace={{ id: workspaceId, name: info.name || t('crm.page.workspaceFallback') }}
            currentPage={undefined}
            breadcrumbs={[
                { label: t('nav.dashboard'), href: '/dashboard' },
                { label: t('realEstate.nav.mandates'), href: `/mandates?workspace=${workspaceId}` },
            ]}
        >
            <div className="p-4 sm:p-6 max-w-6xl mx-auto">
                <div className="mb-6">
                    <h1 className="display-md text-on-surface">{t('realEstate.mandates.title')}</h1>
                    <p className="body-md text-on-surface-variant">{t('realEstate.mandates.subtitle')}</p>
                </div>
                <div className="mb-5">
                    <StandaloneGuide id="mandates" />
                </div>

                <div className="mb-4 flex flex-wrap gap-2" role="tablist">
                    {QUEUES.map(q => (
                        <button
                            key={q}
                            role="tab"
                            aria-selected={queue === q}
                            onClick={() => setQueue(q)}
                            className={`px-4 py-2 rounded-lg body-md transition-colors ${queue === q ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}
                        >
                            {t(`realEstate.mandates.queue.${q}` as MessageKey)}
                            {q !== 'all' && <span className="ml-2 opacity-80">{counts[q]}</span>}
                        </button>
                    ))}
                </div>
                {queue === 'expiring' && <p className="body-sm text-on-surface-variant mb-4">{t('realEstate.mandates.queueHint', { days: windowDays })}</p>}
                {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2 mb-4" role="alert">{error}</p>}

                {loading ? (
                    <div className="skeleton h-48 rounded-lg" />
                ) : rows.length === 0 ? (
                    <p className="body-md text-on-surface-variant text-center py-16">{t('realEstate.mandates.empty')}</p>
                ) : (
                    <ul className="space-y-3">
                        {rows.map(m => (
                            <li key={m.id} className="bg-surface-container rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="title-md text-on-surface">
                                        <Link href={`/properties/${m.property.id}?workspace=${workspaceId}&tab=mandate`} className="hover:underline">{m.property.title}</Link>
                                    </p>
                                    <p className="body-sm text-on-surface-variant">
                                        {m.reference} · {t(`realEstate.mandates.type.${m.mandateType}` as MessageKey)} · {formatCurrency(m.askingPrice, m.property.currency || info.currency)}
                                    </p>
                                    <p className="body-sm text-on-surface-variant">
                                        {contactName(m.lead)}{[m.lead.email, (m.lead as { phone?: string | null }).phone].filter(Boolean).map(v => ` · ${v}`).join('')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="body-sm"><ExpiryLabel days={m.daysToExpiry} /></span>
                                    <Badge tone={STATUS_TONE[m.status] ?? 'neutral'}>{t(`realEstate.mandates.status.${m.status}` as MessageKey)}</Badge>
                                    {canWrite && ['active', 'expired'].includes(m.status) && (
                                        <button onClick={() => setRenewing(m)} className={m.status === 'active' ? primaryButton : secondaryButton}>
                                            {t('realEstate.mandates.renew')}
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {renewing && (
                    <MandateActionDialog mandate={renewing} mode="renew" onClose={() => setRenewing(null)} onDone={() => { setRenewing(null); load(); }} />
                )}
            </div>
        </AppShell>
    );
}

export default function MandatesPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <MandatesPageInner />
        </Suspense>
    );
}
