'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Loader2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import Toast from '@/components/Toast';
import TMAReviewModal from '@/components/developer/TMAReviewModal';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { useWorkspaceCurrency } from '@/components/developer/useWorkspaceCurrency';
import {
    Chip, TMA_STATUS_LABEL, TMA_STATUS_TONE, tableClass, tdClass, thClass,
} from '@/components/developer/status';
import { useI18n } from '@/i18n/I18nProvider';

type Filter = 'all' | 'requested' | 'feasibility_approved' | 'quote_sent' | 'accepted' | 'rejected' | 'completed';
const FILTERS: Filter[] = ['all', 'requested', 'feasibility_approved', 'quote_sent', 'accepted', 'rejected', 'completed'];

/** Requests that are waiting on the developer, as opposed to the buyer. */
const NEEDS_ACTION = new Set(['requested', 'feasibility_approved']);

function ModificationsInner() {
    const { workspaceId, ready } = useWorkspaceParam();
    const { t, formatNumber, formatDate } = useI18n();
    const currency = useWorkspaceCurrency(workspaceId);

    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>('all');
    const [selected, setSelected] = useState<any | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const money = (n: number) => formatNumber(n, { style: 'currency', currency, maximumFractionDigits: 0 });

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/developer/tma?workspaceId=${workspaceId}`);
            if (!res.ok) throw new Error('failed');
            const data = await res.json();
            setRequests(data.requests ?? []);
        } catch {
            setToast({ message: t('developer.loadFailed'), type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [workspaceId, t]);

    useEffect(() => { if (ready && workspaceId) load(); }, [ready, workspaceId, load]);

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: requests.length };
        for (const r of requests) c[r.status] = (c[r.status] ?? 0) + 1;
        return c;
    }, [requests]);

    const visible = useMemo(
        () => requests.filter((r) => filter === 'all' || r.status === filter),
        [requests, filter]
    );

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <AppShell><NoWorkspace /></AppShell>;

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-2 bg-primary/10 text-primary rounded-lg"><ClipboardList className="w-6 h-6" /></span>
                        <h1 className="text-2xl font-bold text-on-surface">{t('developer.modificationsTitle')}</h1>
                    </div>
                    <p className="text-sm text-on-surface-variant mt-1">{t('developer.modificationsSubtitle')}</p>
                </div>

                <div role="tablist" className="flex flex-wrap gap-1.5">
                    {FILTERS.map((f) => (
                        <button
                            key={f}
                            role="tab"
                            aria-selected={filter === f}
                            onClick={() => setFilter(f)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                filter === f ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            {f === 'all' ? t('developer.filterAllStatuses') : t(TMA_STATUS_LABEL[f])}
                            <span className="tabular-nums opacity-70">{counts[f] ?? 0}</span>
                        </button>
                    ))}
                </div>

                {loading && requests.length === 0 ? (
                    <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" /></div>
                ) : visible.length === 0 ? (
                    <div className="p-12 text-center border border-dashed border-outline-variant/40 rounded-xl">
                        <ClipboardList className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-3" />
                        <p className="text-sm text-on-surface-variant">{t('developer.modificationsEmpty')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-outline-variant/20 rounded-xl">
                        <table className={tableClass}>
                            <thead className="bg-surface-container-low">
                                <tr>
                                    <th className={thClass}>{t('developer.colReference')}</th>
                                    <th className={thClass}>{t('developer.colRequest')}</th>
                                    <th className={thClass}>{t('developer.colProjectUnit')}</th>
                                    <th className={thClass}>{t('developer.colBuyer')}</th>
                                    <th className={thClass}>{t('developer.colCategory')}</th>
                                    <th className={`${thClass} text-end`}>{t('developer.colQuote')}</th>
                                    <th className={thClass}>{t('developer.colRequested')}</th>
                                    <th className={thClass}>{t('developer.colStatus')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/15">
                                {visible.map((req) => {
                                    const buyer = req.buyerLead
                                        ? `${req.buyerLead.firstName} ${req.buyerLead.lastName}`.trim()
                                        : '–';
                                    return (
                                        <tr
                                            key={req.id}
                                            tabIndex={0}
                                            onClick={() => setSelected(req)}
                                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(req)}
                                            className="cursor-pointer hover:bg-surface-container-low/60 focus:bg-surface-container-low/60 focus:outline-none transition-colors"
                                        >
                                            <td className={`${tdClass} font-mono text-xs`}>{req.reference}</td>
                                            <td className={`${tdClass} max-w-xs`}>
                                                <span className="block text-on-surface font-medium truncate">{req.title}</span>
                                                {NEEDS_ACTION.has(req.status) && (
                                                    <span className="block text-[11px] text-amber-700 dark:text-amber-400">{t('developerDashboard.needsAttention')}</span>
                                                )}
                                            </td>
                                            <td className={tdClass}>{req.lot.program.name} · {req.lot.lotNumber}</td>
                                            <td className={tdClass}>{buyer}</td>
                                            <td className={`${tdClass} capitalize text-on-surface-variant`}>{req.category}</td>
                                            <td className={`${tdClass} text-end tabular-nums`}>
                                                {req.priceQuote > 0 ? money(req.priceQuote) : '–'}
                                            </td>
                                            <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{formatDate(req.createdAt)}</td>
                                            <td className={tdClass}>
                                                <Chip tone={TMA_STATUS_TONE[req.status] ?? TMA_STATUS_TONE.completed}>
                                                    {t(TMA_STATUS_LABEL[req.status] ?? TMA_STATUS_LABEL.completed)}
                                                </Chip>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selected && (
                <TMAReviewModal
                    workspaceId={workspaceId}
                    tma={selected}
                    onClose={() => setSelected(null)}
                    onSuccess={() => { setSelected(null); load(); }}
                />
            )}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppShell>
    );
}

export default function ModificationsPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <ModificationsInner />
        </Suspense>
    );
}
