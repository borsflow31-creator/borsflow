'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import { DeltaChip } from '@/components/developer/DeveloperDashboard';
import { HBars } from '@/components/developer/charts/charts';
import { tableClass, tdClass, thClass } from '@/components/developer/status';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import type { DashboardPeriod } from '@/lib/services/developer/dashboard';
import type { TeamActivity } from '@/lib/services/developer/activity-board';

const PERIODS: { key: DashboardPeriod; label: MessageKey }[] = [
    { key: 'month', label: 'developerDashboard.periodMonth' },
    { key: 'quarter', label: 'developerDashboard.periodQuarter' },
    { key: 'year', label: 'developerDashboard.periodYear' },
];

const FUNNEL_LABEL: Record<string, MessageKey> = {
    leads: 'developerCrm.team.funnelLeads',
    visits: 'developerCrm.team.funnelVisits',
    reservations: 'developerCrm.team.funnelReservations',
    contracts: 'developerCrm.team.funnelContracts',
    paid: 'developerCrm.team.funnelPaid',
};

/** One metric cell: this period's count with its change against the last. */
function Metric({ value, previous }: { value: number; previous: number }) {
    return (
        <div className="flex flex-col items-end">
            <span className="font-semibold tabular-nums text-on-surface">{value}</span>
            <DeltaChip value={value} previous={previous} />
        </div>
    );
}

function TeamInner() {
    const { workspaceId, ready } = useWorkspaceParam();
    const { t, formatNumber } = useI18n();
    const [period, setPeriod] = useState<DashboardPeriod>('month');
    const [data, setData] = useState<TeamActivity | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        setFailed(false);
        try {
            const res = await fetch(`/api/developer/activity?workspaceId=${workspaceId}&period=${period}`);
            if (!res.ok) throw new Error('failed');
            setData((await res.json()).activity);
        } catch {
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, [workspaceId, period]);

    useEffect(() => { if (ready && workspaceId) load(); }, [ready, workspaceId, load]);

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <AppShell><NoWorkspace /></AppShell>;

    const funnelRows = (data?.funnel ?? []).map((step, i, all) => {
        const previous = i === 0 ? null : all[i - 1].count;
        return {
            key: step.key,
            label: t(FUNNEL_LABEL[step.key]),
            value: step.count,
            valueLabel: String(step.count),
            // Each step counts what happened in the period, not one cohort moving
            // through, so a step can outnumber the one before it (reservations from
            // last month's leads). A rate above 100% would mislead; show none.
            sub: previous && previous > 0 && step.count <= previous
                ? t('developerCrm.team.stepConversion', { percent: formatNumber((step.count / previous) * 100, { maximumFractionDigits: 0 }) })
                : undefined,
        };
    });

    return (
        <AppShell>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <PageHeader
                    icon={Users}
                    title={t('developerCrm.team.title')}
                    subtitle={t('developerCrm.team.subtitle')}
                    guide="team"
                    actions={
                        <>
                            <div role="tablist" className="inline-flex rounded-lg border border-outline-variant/30 p-0.5 bg-surface-container-low">
                                {PERIODS.map((p) => (
                                    <button
                                        key={p.key}
                                        role="tab"
                                        aria-selected={period === p.key}
                                        onClick={() => setPeriod(p.key)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                            period === p.key ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                                        }`}
                                    >
                                        {t(p.label)}
                                    </button>
                                ))}
                            </div>
                        </>
                    }
                />

                {failed && !data ? (
                    <p className="py-12 text-center text-sm text-on-surface-variant">
                        {t('developerCrm.team.loadFailed')}{' '}
                        <button onClick={load} className="text-secondary hover:underline">{t('developerDashboard.retry')}</button>
                    </p>
                ) : loading && !data ? (
                    <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" /></div>
                ) : data ? (
                    <div className={`space-y-6 ${loading ? 'opacity-60' : ''}`}>
                        {data.agents.length === 0 ? (
                            <p className="text-sm text-on-surface-variant">{t('developerCrm.team.empty')}</p>
                        ) : (
                            <div className="overflow-x-auto border border-outline-variant/20 rounded-xl">
                                <table className={tableClass}>
                                    <thead className="bg-surface-container-low">
                                        <tr>
                                            <th className={thClass}>{t('developerCrm.team.colAgent')}</th>
                                            {([
                                                'leadsAssigned', 'callsMade', 'callsAnswered', 'visitsScheduled', 'visitsAttended',
                                                'followUpsDone', 'followUpsOverdue', 'dealsCreated', 'dealsClosed',
                                            ] as const).map((k) => (
                                                <th key={k} className={`${thClass} text-end`}>{t(`developerCrm.team.${k}` as MessageKey)}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-outline-variant/15">
                                        {data.agents.map((a) => (
                                            <tr key={a.userId}>
                                                <td className={`${tdClass} font-medium text-on-surface whitespace-nowrap`}>{a.name}</td>
                                                <td className={`${tdClass} text-end`}><Metric {...a.leadsAssigned} /></td>
                                                <td className={`${tdClass} text-end`}><Metric {...a.callsMade} /></td>
                                                <td className={`${tdClass} text-end`}><Metric {...a.callsAnswered} /></td>
                                                <td className={`${tdClass} text-end`}><Metric {...a.visitsScheduled} /></td>
                                                <td className={`${tdClass} text-end`}><Metric {...a.visitsAttended} /></td>
                                                <td className={`${tdClass} text-end`}><Metric {...a.followUpsCompleted} /></td>
                                                <td className={`${tdClass} text-end tabular-nums ${a.followUpsOverdue > 0 ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>
                                                    {a.followUpsOverdue}
                                                </td>
                                                <td className={`${tdClass} text-end`}><Metric {...a.dealsCreated} /></td>
                                                <td className={`${tdClass} text-end`}><Metric {...a.dealsClosed} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <section className="border border-outline-variant/20 rounded-xl p-5 max-w-xl">
                            <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">{t('developerCrm.team.funnelTitle')}</h2>
                            <HBars rows={funnelRows} />
                        </section>

                        <p className="text-xs text-on-surface-variant/80">{t('developerCrm.team.note')}</p>
                    </div>
                ) : null}
            </div>
        </AppShell>
    );
}

export default function TeamPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <TeamInner />
        </Suspense>
    );
}
