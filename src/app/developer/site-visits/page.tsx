'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Loader2, Plus } from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import Toast from '@/components/Toast';
import { SiteVisitModal, SiteVisitOutcomeModal } from '@/components/developer/lead-actions';
import { Chip } from '@/components/developer/status';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { primaryButton } from '@/components/realestate/ui';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';

type When = 'upcoming' | 'needs_outcome' | 'past';
const TABS: { key: When; label: MessageKey }[] = [
    { key: 'upcoming', label: 'developerCrm.visits.tabUpcoming' },
    { key: 'needs_outcome', label: 'developerCrm.visits.tabNeedsOutcome' },
    { key: 'past', label: 'developerCrm.visits.tabPast' },
];

const STATUS_LABEL: Record<string, MessageKey> = {
    scheduled: 'developerCrm.visits.statusScheduled',
    in_progress: 'developerCrm.visits.statusScheduled',
    completed: 'developerCrm.visits.statusCompleted',
    no_show: 'developerCrm.visits.statusNoShow',
    cancelled: 'developerCrm.visits.statusCancelled',
};
const STATUS_TONE: Record<string, string> = {
    scheduled: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    in_progress: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    no_show: 'bg-red-500/10 text-red-700 dark:text-red-400',
    cancelled: 'bg-surface-container-high text-on-surface-variant',
};

function VisitsInner() {
    const { workspaceId, ready } = useWorkspaceParam();
    const { t, formatDateTime } = useI18n();

    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [when, setWhen] = useState<When>('upcoming');
    const [booking, setBooking] = useState(false);
    const [recording, setRecording] = useState<any | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/developer/site-visits?workspaceId=${workspaceId}&when=${when}`);
            if (!res.ok) throw new Error('failed');
            setVisits((await res.json()).visits ?? []);
        } catch {
            setToast({ message: t('developerCrm.visits.loadFailed'), type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [workspaceId, when, t]);

    useEffect(() => { if (ready && workspaceId) load(); }, [ready, workspaceId, load]);

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <AppShell><NoWorkspace /></AppShell>;

    const buyerName = (v: any) => (v.lead ? `${v.lead.firstName} ${v.lead.lastName}`.trim() : '–');

    return (
        <AppShell>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <PageHeader
                    icon={CalendarDays}
                    title={t('developerCrm.visits.title')}
                    subtitle={t('developerCrm.visits.subtitle')}
                    guide="siteVisits"
                    actions={
                        <button onClick={() => setBooking(true)} className={`${primaryButton} inline-flex items-center gap-2`}>
                            <Plus className="w-4 h-4" />
                            {t('developerCrm.visits.schedule')}
                        </button>
                    }
                />

                <div role="tablist" className="flex gap-1.5">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            role="tab"
                            aria-selected={when === tab.key}
                            onClick={() => setWhen(tab.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                when === tab.key ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            {t(tab.label)}
                        </button>
                    ))}
                </div>

                {loading && visits.length === 0 ? (
                    <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" /></div>
                ) : visits.length === 0 ? (
                    <div className="p-12 text-center border border-dashed border-outline-variant/40 rounded-xl">
                        <CalendarDays className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-3" />
                        <p className="text-sm text-on-surface-variant">{t('developerCrm.visits.empty')}</p>
                    </div>
                ) : (
                    <ul className={`divide-y divide-outline-variant/15 border border-outline-variant/20 rounded-xl ${loading ? 'opacity-60' : ''}`}>
                        {visits.map((v) => {
                            const open = v.status === 'scheduled' || v.status === 'in_progress';
                            const started = new Date(v.startTime).getTime() < Date.now();
                            return (
                                <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                                    <div className="w-44 flex-shrink-0">
                                        <p className="text-sm font-medium text-on-surface tabular-nums">{formatDateTime(v.startTime)}</p>
                                        <p className="text-xs text-on-surface-variant">{v.duration} min</p>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <Link
                                            href={`/crm?workspace=${workspaceId}&lead=${v.lead?.id}&tab=customer`}
                                            className="text-sm text-on-surface hover:text-secondary transition-colors font-medium"
                                        >
                                            {buyerName(v)}
                                        </Link>
                                        <p className="text-xs text-on-surface-variant truncate">
                                            {v.program?.name}{v.lot ? ` · ${v.lot.lotNumber}` : ''}
                                            {v.user && ` · ${v.user.name || v.user.email}`}
                                        </p>
                                    </div>
                                    <span className="flex items-center gap-2">
                                        <Chip tone={STATUS_TONE[v.status] ?? STATUS_TONE.scheduled}>{t(STATUS_LABEL[v.status] ?? STATUS_LABEL.scheduled)}</Chip>
                                        {v.outcome && (
                                            <span className="text-xs text-on-surface-variant">{t(`developerCrm.visits.outcome_${v.outcome}` as MessageKey)}</span>
                                        )}
                                    </span>
                                    {open && started && (
                                        <button onClick={() => setRecording(v)} className="text-xs font-medium text-secondary hover:underline whitespace-nowrap">
                                            {t('developerCrm.visits.recordOutcome')}
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {booking && (
                <SiteVisitModal
                    workspaceId={workspaceId}
                    onClose={() => setBooking(false)}
                    onDone={() => { setBooking(false); load(); }}
                />
            )}
            {recording && (
                <SiteVisitOutcomeModal
                    workspaceId={workspaceId}
                    visitId={recording.id}
                    buyerName={buyerName(recording)}
                    onClose={() => setRecording(null)}
                    onDone={() => { setRecording(null); load(); }}
                />
            )}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppShell>
    );
}

export default function SiteVisitsPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <VisitsInner />
        </Suspense>
    );
}
