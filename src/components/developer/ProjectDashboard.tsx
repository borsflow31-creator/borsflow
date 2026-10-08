'use client';

import { useMemo } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { PROJECT_STATUSES, projectProgress, summarizeUnits } from '@/lib/crm/projects';
import { Kpi, KpiGrid, Meter, Section } from './kpi';

/**
 * The numbers that answer "how is this project doing": how much stock is left,
 * how much is committed, how much has sold, and what each of those is worth.
 *
 * It derives everything from the units it is handed rather than reading the
 * denormalized counters on Program, so the tiles cannot disagree with the units
 * table on the same screen. The bucketing (an option counts as committed, a
 * signed deed counts as sold) is `summarizeUnits` in lib/crm/projects, shared
 * with anything else that reports on a project.
 */
export default function ProjectDashboard({
    lots,
    status,
    currency,
}: {
    lots: { status: string; totalPrice?: number | null; basePrice?: number | null }[];
    status: string;
    currency: string;
}) {
    const { t, formatCurrency } = useI18n();
    const totals = useMemo(() => summarizeUnits(lots), [lots]);
    const progress = projectProgress(status);

    const sellThrough = totals.total > 0 ? Math.round(((totals.reserved + totals.sold) / totals.total) * 100) : 0;

    return (
        <div className="space-y-4">
            <KpiGrid>
                <Kpi label={t('realEstate.projects.stats.totalUnits')} value={totals.total} sub={formatCurrency(totals.totalValue, currency)} />
                <Kpi label={t('realEstate.projects.stats.available')} value={totals.available} sub={formatCurrency(totals.availableValue, currency)} tone="text-emerald-700 dark:text-emerald-400" />
                <Kpi label={t('realEstate.projects.stats.reserved')} value={totals.reserved} sub={t('realEstate.projects.stats.reservedHint')} tone="text-amber-700 dark:text-amber-400" />
                <Kpi label={t('realEstate.projects.stats.sold')} value={totals.sold} sub={formatCurrency(totals.soldValue, currency)} tone="text-secondary" />
            </KpiGrid>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Sell-through: what share of the project is no longer on offer. */}
                <Section title={t('realEstate.projects.stats.sellThrough')} icon="trending_up">
                    <div className="flex items-baseline justify-between gap-2 mb-2">
                        <span className="text-2xl font-semibold text-on-surface tabular-nums">{sellThrough}%</span>
                        <span className="text-xs text-on-surface-variant tabular-nums">
                            {t('realEstate.projects.stats.remainingInventory', { value: formatCurrency(totals.availableValue, currency) })}
                        </span>
                    </div>
                    <Meter percent={sellThrough} label={t('realEstate.projects.stats.sellThrough')} />
                </Section>

                {/* Lifecycle position, not a construction percentage. */}
                <Section title={t('realEstate.projects.stats.stage')} icon="construction">
                    <div className="flex items-baseline justify-between gap-2 mb-2">
                        <span className="text-2xl font-semibold text-on-surface">{t(`realEstate.projects.status.${status}` as never)}</span>
                        <span className="text-xs text-on-surface-variant tabular-nums">
                            {t('realEstate.projects.stats.stageHint', { percent: String(progress) })}
                        </span>
                    </div>
                    <ol className="flex items-center gap-1" aria-label={t('realEstate.projects.stats.stage')}>
                        {PROJECT_STATUSES.map((step, i) => {
                            const reached = PROJECT_STATUSES.indexOf(status as never) >= i;
                            return (
                                <li
                                    key={step}
                                    className={`h-1.5 flex-1 rounded-full ${reached ? 'bg-secondary' : 'bg-surface-container-high'}`}
                                    title={t(`realEstate.projects.status.${step}` as never)}
                                />
                            );
                        })}
                    </ol>
                </Section>
            </div>
        </div>
    );
}
