'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { AlertCircle, ArrowDownRight, ArrowUpRight, ArrowRight, Building, Loader2, Minus, Plus } from 'lucide-react';
import { StandaloneGuide } from '@/components/ui/PageHeader';
import { Kpi, KpiGrid, Section } from '@/components/developer/kpi';
import { useI18n } from '@/i18n/I18nProvider';
import { stageLabel } from '@/components/crm/labels';
import type { DashboardPeriod, DeveloperDashboard as DashboardData } from '@/lib/services/developer/dashboard';
import ProgramFormModal from '@/components/developer/ProgramFormModal';
import { useWorkspaceCurrency } from '@/components/developer/useWorkspaceCurrency';
import { groupTasks } from '@/components/developer/task-groups';
import {
    ColumnChart, HBars, LineChart, SERIES, StackedBar, TargetBar,
} from '@/components/developer/charts/charts';

const PERIODS: DashboardPeriod[] = ['month', 'quarter', 'year'];

/* ─── Small pieces ────────────────────────────────────────── */

/**
 * What a new developer sees before their first project: the four steps that get
 * them selling, in the same order as the sidebar, each linking to its page.
 */
function GetStarted({ qs, onNewProject }: { qs: string; onNewProject: () => void }) {
    const { t } = useI18n();
    const steps = [
        { title: t('developerGuide.start.step1'), body: t('developerGuide.start.step1Body'), action: onNewProject },
        { title: t('developerGuide.start.step2'), body: t('developerGuide.start.step2Body'), href: `/developer/inventory${qs}` },
        { title: t('developerGuide.start.step3'), body: t('developerGuide.start.step3Body'), href: `/developer/templates${qs}` },
        { title: t('developerGuide.start.step4'), body: t('developerGuide.start.step4Body'), href: `/crm${qs}` },
    ];
    const rowClass = 'group w-full flex items-center gap-4 p-4 text-start hover:bg-surface-container-high transition-colors';
    return (
        <section className="border border-outline-variant/30 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-outline-variant/20 bg-surface-container-low">
                <Building className="h-7 w-7 text-primary mb-3" />
                <h2 className="text-lg font-semibold text-on-surface mb-1">{t('developerGuide.start.title')}</h2>
                <p className="text-sm text-on-surface-variant">{t('developerGuide.start.body')}</p>
            </div>
            <ol className="divide-y divide-outline-variant/20">
                {steps.map((step, i) => {
                    const content = (
                        <>
                            <span className={`flex-none w-8 h-8 rounded-full text-sm font-semibold flex items-center justify-center ${
                                i === 0 ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant'
                            }`}>
                                {i + 1}
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-sm font-medium text-on-surface">{step.title}</span>
                                <span className="block text-xs text-on-surface-variant mt-0.5">{step.body}</span>
                            </span>
                            <ArrowRight className="h-4 w-4 text-on-surface-variant group-hover:text-on-surface rtl:rotate-180 transition-colors" />
                        </>
                    );
                    return (
                        <li key={i}>
                            {step.href
                                ? <Link href={step.href} className={rowClass}>{content}</Link>
                                : <button type="button" onClick={step.action} className={rowClass}>{content}</button>}
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}

/**
 * Change against the previous period. Direction is shown by an arrow and a sign,
 * never by colour alone. `invert` is for measures where up is bad (cancellations).
 * A zero baseline has no meaningful percentage, so it shows nothing rather than
 * "+∞%".
 */
export function DeltaChip({
    value, previous, kind = 'percent', invert = false,
}: {
    value: number | null;
    previous: number | null;
    kind?: 'percent' | 'points';
    invert?: boolean;
}) {
    if (value === null || previous === null) return null;
    let change: number;
    if (kind === 'points') {
        change = value - previous;
    } else {
        if (previous === 0) return null;
        change = ((value - previous) / previous) * 100;
    }
    const rounded = Math.round(change * 10) / 10;
    const flat = rounded === 0;
    const good = invert ? rounded < 0 : rounded > 0;
    const Icon = flat ? Minus : rounded > 0 ? ArrowUpRight : ArrowDownRight;
    const tone = flat ? 'text-on-surface-variant' : good ? 'text-emerald-600 dark:text-emerald-400' : 'text-error';
    return (
        <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${tone}`}>
            <Icon className="h-3 w-3" aria-hidden />
            {rounded > 0 ? '+' : ''}{rounded}{kind === 'points' ? ' pt' : '%'}
        </span>
    );
}

function timeLeft(iso: string, now: number, t: (k: any, v?: any) => string): string {
    const ms = new Date(iso).getTime() - now;
    if (ms <= 0) return t('developerDashboard.expired');
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return t('developerDashboard.expiresIn', { time: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m` });
}

/**
 * The signed-in salesperson's follow-ups at a glance: how many are late, due
 * today, and coming. Each count carries its word, so the state is never colour
 * alone, and the whole block links to the full list.
 */
function FollowUpsWidget({ workspaceId }: { workspaceId: string }) {
    const { t } = useI18n();
    const [tasks, setTasks] = useState<{ dueAt: string; completedAt: string | null }[] | null>(null);

    useEffect(() => {
        if (!workspaceId) return;
        let cancelled = false;
        fetch(`/api/developer/tasks?workspaceId=${workspaceId}&scope=mine&status=open`)
            .then((r) => (r.ok ? r.json() : { tasks: [] }))
            .then((d) => { if (!cancelled) setTasks(d.tasks ?? []); })
            .catch(() => { if (!cancelled) setTasks([]); });
        return () => { cancelled = true; };
    }, [workspaceId]);

    if (tasks === null) return null;
    const g = groupTasks(tasks);
    const cells = [
        { key: 'overdue', label: t('developerCrm.tasks.groupOverdue'), count: g.overdue.length, tone: 'text-error' },
        { key: 'today', label: t('developerCrm.tasks.groupToday'), count: g.today.length, tone: 'text-amber-600 dark:text-amber-400' },
        { key: 'upcoming', label: t('developerCrm.tasks.groupUpcoming'), count: g.upcoming.length, tone: 'text-emerald-600 dark:text-emerald-400' },
    ];

    return (
        <div>
            <h3 className="text-xs font-medium text-on-surface mb-2 flex items-center justify-between">
                {t('developerCrm.tasks.widgetTitle')}
                <Link href={`/developer/tasks?workspace=${workspaceId}`} className="text-[11px] text-secondary hover:underline">
                    {t('developerCrm.tasks.openAll')}
                </Link>
            </h3>
            {tasks.length === 0 ? (
                <p className="text-xs text-on-surface-variant/70">{t('developerCrm.tasks.widgetAllClear')}</p>
            ) : (
                <ul className="grid grid-cols-3 gap-2">
                    {cells.map((c) => (
                        <li key={c.key} className="rounded-lg border border-outline-variant/20 px-3 py-2">
                            <p className={`text-xl font-semibold tabular-nums ${c.count > 0 ? c.tone : 'text-on-surface-variant'}`}>{c.count}</p>
                            <p className="text-[11px] text-on-surface-variant">{c.label}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/* ─── Dashboard ───────────────────────────────────────────── */

export default function DeveloperDashboard({ workspaceId }: { workspaceId: string }) {
    const { t, locale, formatNumber } = useI18n();
    const { data: session } = useSession();
    const currency = useWorkspaceCurrency(workspaceId);

    const [period, setPeriod] = useState<DashboardPeriod>('month');
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [showNewProject, setShowNewProject] = useState(false);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        setFailed(false);
        try {
            const res = await fetch(`/api/developer/dashboard?workspaceId=${workspaceId}&period=${period}`);
            if (!res.ok) throw new Error('failed');
            const json = await res.json();
            setData(json.dashboard);
        } catch {
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, [workspaceId, period]);

    useEffect(() => { load(); }, [load]);

    const money = (n: number) =>
        formatNumber(n, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });
    const moneyFull = (n: number) =>
        formatNumber(n, { style: 'currency', currency, maximumFractionDigits: 0 });
    const pct = (n: number | null) => (n === null ? '–' : `${formatNumber(n, { maximumFractionDigits: 1 })}%`);

    const periodNoun = t(
        period === 'month' ? 'developerDashboard.periodNounMonth'
            : period === 'quarter' ? 'developerDashboard.periodNounQuarter'
                : 'developerDashboard.periodNounYear'
    );

    const firstName = session?.user?.name?.split(' ')[0];
    const qs = workspaceId ? `?workspace=${workspaceId}` : '';
    const now = Date.now();

    return (
        <div className="max-w-6xl mx-auto px-6 py-10 pb-24">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                <div>
                    <p className="text-sm text-on-surface-variant mb-1">
                        {firstName ? t('dashboard.greeting', { name: firstName }) : t('dashboard.greetingNoName')}
                    </p>
                    <h1 className="text-3xl font-bold text-on-surface">{t('developerDashboard.title')}</h1>
                    <p className="text-sm text-on-surface-variant mt-1">{t('developerGuide.pages.dashboard.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div role="tablist" aria-label={t('developerDashboard.title')} className="inline-flex rounded-lg border border-outline-variant/30 p-0.5 bg-surface-container-low">
                        {PERIODS.map((p) => (
                            <button
                                key={p}
                                role="tab"
                                aria-selected={period === p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                    period === p
                                        ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                                        : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                {t(p === 'month' ? 'developerDashboard.periodMonth' : p === 'quarter' ? 'developerDashboard.periodQuarter' : 'developerDashboard.periodYear')}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowNewProject(true)}
                        disabled={!workspaceId}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                        <Plus className="h-4 w-4" />
                        {t('developerDashboard.newProject')}
                    </button>
                </div>
            </div>

            {/* States */}
            {!workspaceId || (loading && !data) ? (
                <div className="py-24 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" /></div>
            ) : failed && !data ? (
                <div className="py-16 text-center">
                    <AlertCircle className="h-6 w-6 text-error mx-auto mb-2" />
                    <p className="text-sm text-on-surface-variant mb-3">{t('developerDashboard.loadFailed')}</p>
                    <button onClick={load} className="text-sm font-medium text-secondary hover:underline">{t('developerDashboard.retry')}</button>
                </div>
            ) : data && !data.hasProjects ? (
                <GetStarted qs={qs} onNewProject={() => setShowNewProject(true)} />
            ) : data ? (
                <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                    <div className="mb-6"><StandaloneGuide id="dashboard" /></div>
                    {/* KPI grid */}
                    <KpiGrid className="mb-6">
                        <Kpi
                            label={t('developerDashboard.kpiTotalSalesValue')}
                            value={money(data.kpis.totalSalesValue)}
                            sub={`${data.kpis.units.sold} / ${data.kpis.units.total}`}
                        />
                        <Kpi
                            label={t('developerDashboard.kpiUnits')}
                            value={`${data.kpis.units.sold} / ${data.kpis.units.reserved} / ${data.kpis.units.available}`}
                        />
                        <Kpi
                            label={t('developerDashboard.kpiSalesInPeriod', { period: periodNoun })}
                            value={money(data.kpis.salesValue.value)}
                            sub={`${data.kpis.salesCount.value}`}
                            delta={<DeltaChip value={data.kpis.salesValue.value} previous={data.kpis.salesValue.previous} />}
                        />
                        <Kpi
                            label={t('developerDashboard.kpiAverageDealValue')}
                            value={money(data.kpis.averageDealValue.value)}
                            delta={<DeltaChip value={data.kpis.averageDealValue.value} previous={data.kpis.averageDealValue.previous} />}
                        />
                        <Kpi
                            label={t('developerDashboard.kpiCollected')}
                            value={money(data.kpis.collected)}
                            sub={t('developerDashboard.kpiCollectedOf', { called: money(data.kpis.called) })}
                        />
                        <Kpi
                            label={t('developerDashboard.kpiOutstanding')}
                            value={money(data.kpis.outstanding)}
                            sub={data.kpis.overdueAmount > 0 ? `${money(data.kpis.overdueAmount)} ${t('developer.overdue').toLowerCase()}` : undefined}
                        />
                        <Kpi
                            label={t('developerDashboard.kpiNewLeads')}
                            value={data.kpis.newLeads.value}
                            delta={<DeltaChip value={data.kpis.newLeads.value} previous={data.kpis.newLeads.previous} />}
                        />
                        <Kpi
                            label={t('developerDashboard.kpiQualifiedLeads')}
                            value={data.kpis.qualifiedLeads.value}
                            delta={<DeltaChip value={data.kpis.qualifiedLeads.value} previous={data.kpis.qualifiedLeads.previous} />}
                        />
                        <Kpi
                            label={t('developerDashboard.kpiConversionRate')}
                            value={pct(data.kpis.conversionRate.value)}
                            delta={<DeltaChip kind="points" value={data.kpis.conversionRate.value} previous={data.kpis.conversionRate.previous} />}
                        />
                        <Kpi
                            label={t('developerDashboard.kpiPipelineValue')}
                            value={money(data.kpis.pipelineValue)}
                        />
                        <Kpi
                            label={t('developerDashboard.kpiCancellationRate')}
                            value={pct(data.kpis.cancellationRate.value)}
                            delta={<DeltaChip kind="points" invert value={data.kpis.cancellationRate.value} previous={data.kpis.cancellationRate.previous} />}
                        />
                        <Kpi
                            label={t('developerDashboard.kpiTargetAchievement')}
                            value={pct(data.kpis.target.percent)}
                            sub={data.kpis.target.revenueTarget > 0 ? `${money(data.kpis.target.achieved)} / ${money(data.kpis.target.revenueTarget)}` : undefined}
                        />
                    </KpiGrid>

                    {/* Charts + attention */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Section title={t('developerDashboard.chartSalesTrend')} icon="show_chart" className="md:col-span-2">
                                <LineChart
                                    formatValue={money}
                                    data={data.series.salesTrend.map((m) => {
                                        const d = new Date(`${m.month}-01T00:00:00Z`);
                                        return {
                                            label: d.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }),
                                            value: m.value,
                                            tipTitle: d.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
                                            tipLines: [moneyFull(m.value), t('developer.unitsCount', { count: m.count })],
                                        };
                                    })}
                                />
                            </Section>

                            <Section title={t('developerDashboard.chartSalesByProject')} icon="apartment">
                                <HBars
                                    rows={data.series.salesByProject.map((p) => ({
                                        key: p.id, label: p.name, value: p.value, valueLabel: money(p.value),
                                        sub: t('developer.unitsCount', { count: p.count }),
                                    }))}
                                    empty="–"
                                />
                            </Section>

                            <Section title={t('developerDashboard.chartSalesByAgent')} icon="groups">
                                <HBars
                                    rows={data.series.salesByAgent.map((a) => ({
                                        key: a.id ?? 'none', label: a.name ?? t('developerDashboard.unassigned'),
                                        value: a.value, valueLabel: money(a.value),
                                        sub: t('developer.unitsCount', { count: a.count }),
                                    }))}
                                    empty={t('developerDashboard.noAgentData')}
                                />
                            </Section>

                            <Section title={t('developerDashboard.chartLeadFunnel')} icon="filter_alt">
                                <HBars
                                    rows={data.series.leadFunnel.map((s) => ({
                                        key: s.stage, label: stageLabel(s.stage, t), value: s.count, valueLabel: String(s.count),
                                        sub: s.value > 0 ? money(s.value) : undefined,
                                    }))}
                                    empty={t('developerDashboard.noLeadData')}
                                />
                            </Section>

                            <Section title={t('developerDashboard.chartRevenueVsTarget')} icon="flag">
                                {data.series.revenueVsTarget.length === 0 ? (
                                    <p className="text-sm text-on-surface-variant/70 py-4">{t('developerDashboard.target')}: –</p>
                                ) : (
                                    <ul className="space-y-3">
                                        {data.series.revenueVsTarget.map((p) => (
                                            <TargetBar
                                                key={p.id}
                                                label={p.name}
                                                achieved={p.sold}
                                                target={p.target}
                                                achievedLabel={money(p.sold)}
                                                targetLabel={money(p.target)}
                                                percentLabel={`${Math.round((p.sold / p.target) * 100)}%`}
                                            />
                                        ))}
                                    </ul>
                                )}
                            </Section>

                            <Section title={t('developerDashboard.chartInventoryStatus')} icon="inventory_2">
                                <StackedBar
                                    total={data.kpis.units.total}
                                    segments={[
                                        { key: 'sold', label: t('developer.statusDeedSigned'), count: data.series.inventory.sold.count, valueLabel: money(data.series.inventory.sold.value), color: SERIES.one },
                                        { key: 'reserved', label: t('developer.statusReserved'), count: data.series.inventory.reserved.count, valueLabel: money(data.series.inventory.reserved.value), color: SERIES.two },
                                        { key: 'available', label: t('developer.statusAvailable'), count: data.series.inventory.available.count, valueLabel: money(data.series.inventory.available.value), color: SERIES.three },
                                    ]}
                                />
                            </Section>

                            <Section title={t('developerDashboard.chartCollectionsForecast')} icon="payments">
                                <ColumnChart
                                    formatValue={money}
                                    data={data.series.collectionsForecast.map((m) => {
                                        const d = new Date(`${m.month}-01T00:00:00Z`);
                                        return {
                                            label: d.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }),
                                            tipTitle: d.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
                                            value: m.due,
                                        };
                                    })}
                                />
                                <p className="text-[11px] text-on-surface-variant/70 mt-3 tabular-nums">
                                    {t('developerDashboard.uncalledBalance')}: {money(data.series.uncalledBalance)}
                                </p>
                            </Section>
                        </div>

                        {/* Needs attention */}
                        <div className="space-y-6">
                            <Section title={t('developerDashboard.needsAttention')} icon="notification_important">
                                <div className="space-y-6">
                                    <FollowUpsWidget workspaceId={workspaceId} />

                                    <div>
                                        <h3 className="text-xs font-medium text-on-surface mb-2">{t('developerDashboard.expiringOptions')}</h3>
                                        {data.attention.expiringOptions.length === 0 ? (
                                            <p className="text-xs text-on-surface-variant/70">{t('developerDashboard.noExpiringOptions')}</p>
                                        ) : (
                                            <ul className="space-y-1">
                                                {data.attention.expiringOptions.map((o) => (
                                                    <li key={o.lotId}>
                                                        <Link href={`/developer/programs/${o.programId}${qs}`} className="flex items-center justify-between gap-3 py-1.5 px-2 -mx-2 rounded-lg hover:bg-surface-container-low transition-colors">
                                                            <span className="min-w-0">
                                                                <span className="block text-sm text-on-surface truncate">{o.programName} · {o.lotNumber}</span>
                                                                {o.holder && <span className="block text-[11px] text-on-surface-variant/70 truncate">{o.holder}</span>}
                                                            </span>
                                                            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex-shrink-0 tabular-nums">{timeLeft(o.expiresAt, now, t)}</span>
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-medium text-on-surface mb-2 flex items-center justify-between">
                                            {t('developerDashboard.overdueCalls')}
                                            {data.attention.overdueCallsTotal > 0 && (
                                                <Link href={`/developer/collections${qs}`} className="text-[11px] text-secondary hover:underline">{data.attention.overdueCallsTotal}</Link>
                                            )}
                                        </h3>
                                        {data.attention.overdueCalls.length === 0 ? (
                                            <p className="text-xs text-on-surface-variant/70">{t('developerDashboard.noOverdueCalls')}</p>
                                        ) : (
                                            <ul className="space-y-1">
                                                {data.attention.overdueCalls.map((c) => (
                                                    <li key={c.id}>
                                                        <Link href={`/developer/collections${qs}`} className="flex items-center justify-between gap-3 py-1.5 px-2 -mx-2 rounded-lg hover:bg-surface-container-low transition-colors">
                                                            <span className="min-w-0">
                                                                <span className="block text-sm text-on-surface truncate">{c.buyer ?? c.callNumber}</span>
                                                                <span className="block text-[11px] text-on-surface-variant/70 truncate">{c.programName} · {c.lotNumber} · {t('developerDashboard.daysOverdue', { days: c.daysOverdue })}</span>
                                                            </span>
                                                            <span className="text-sm font-semibold text-error flex-shrink-0 tabular-nums">{money(c.amount)}</span>
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-medium text-on-surface mb-2 flex items-center justify-between">
                                            {t('developerDashboard.pendingModifications')}
                                            {data.attention.pendingModificationsTotal > 0 && (
                                                <Link href={`/developer/modifications${qs}`} className="text-[11px] text-secondary hover:underline">{data.attention.pendingModificationsTotal}</Link>
                                            )}
                                        </h3>
                                        {data.attention.pendingModifications.length === 0 ? (
                                            <p className="text-xs text-on-surface-variant/70">{t('developerDashboard.noPendingModifications')}</p>
                                        ) : (
                                            <ul className="space-y-1">
                                                {data.attention.pendingModifications.map((m) => (
                                                    <li key={m.id}>
                                                        <Link href={`/developer/modifications${qs}`} className="flex items-center justify-between gap-3 py-1.5 px-2 -mx-2 rounded-lg hover:bg-surface-container-low transition-colors">
                                                            <span className="min-w-0">
                                                                <span className="block text-sm text-on-surface truncate">{m.title}</span>
                                                                <span className="block text-[11px] text-on-surface-variant/70 truncate">{m.programName} · {m.lotNumber}</span>
                                                            </span>
                                                            <span className="text-[11px] text-on-surface-variant flex-shrink-0">
                                                                {t(m.status === 'requested' ? 'developer.tmaStatusRequested' : 'developer.tmaStatusFeasibilityApproved')}
                                                            </span>
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </Section>
                        </div>
                    </div>
                </div>
            ) : null}

            {showNewProject && workspaceId && (
                <ProgramFormModal
                    workspaceId={workspaceId}
                    onClose={() => setShowNewProject(false)}
                    onSuccess={() => { setShowNewProject(false); load(); }}
                />
            )}
        </div>
    );
}
