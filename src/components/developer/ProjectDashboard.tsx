'use client';

import { useMemo } from 'react';
import { Banknote, Building2, CheckCircle2, Clock, Tag, Wallet } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { PROJECT_STATUSES, projectProgress, summarizeUnits } from '@/lib/crm/projects';

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

    const tiles = [
        {
            key: 'total',
            label: t('realEstate.projects.stats.totalUnits'),
            value: String(totals.total),
            sub: formatCurrency(totals.totalValue, currency),
            icon: Building2,
            tone: 'text-on-surface',
        },
        {
            key: 'available',
            label: t('realEstate.projects.stats.available'),
            value: String(totals.available),
            sub: formatCurrency(totals.availableValue, currency),
            icon: Tag,
            tone: 'text-emerald-700',
        },
        {
            key: 'reserved',
            label: t('realEstate.projects.stats.reserved'),
            value: String(totals.reserved),
            sub: t('realEstate.projects.stats.reservedHint'),
            icon: Clock,
            tone: 'text-amber-700',
        },
        {
            key: 'sold',
            label: t('realEstate.projects.stats.sold'),
            value: String(totals.sold),
            sub: formatCurrency(totals.soldValue, currency),
            icon: CheckCircle2,
            tone: 'text-blue-700',
        },
    ];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {tiles.map((tile) => (
                    <div key={tile.key} className="p-4 bg-surface-container rounded-xl">
                        <div className="flex items-center justify-between gap-2">
                            <span className="body-xs text-on-surface-variant">{tile.label}</span>
                            <tile.icon className={`w-4 h-4 ${tile.tone}`} aria-hidden="true" />
                        </div>
                        <p className={`title-lg font-bold mt-1 ${tile.tone}`}>{tile.value}</p>
                        <p className="body-xs text-on-surface-variant truncate" title={tile.sub}>{tile.sub}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Sell-through: what share of the project is no longer on offer. */}
                <div className="p-4 bg-surface-container rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="body-sm text-on-surface flex items-center gap-1.5">
                            <Wallet className="w-4 h-4 text-on-surface-variant" aria-hidden="true" />
                            {t('realEstate.projects.stats.sellThrough')}
                        </span>
                        <span className="body-sm font-semibold text-on-surface">{sellThrough}%</span>
                    </div>
                    <div
                        className="h-2 rounded-full bg-surface-container-high overflow-hidden"
                        role="progressbar"
                        aria-valuenow={sellThrough}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={t('realEstate.projects.stats.sellThrough')}
                    >
                        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${sellThrough}%` }} />
                    </div>
                    <p className="body-xs text-on-surface-variant">
                        {t('realEstate.projects.stats.remainingInventory', {
                            value: formatCurrency(totals.availableValue, currency),
                        })}
                    </p>
                </div>

                {/* Lifecycle position, not a construction percentage. */}
                <div className="p-4 bg-surface-container rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="body-sm text-on-surface flex items-center gap-1.5">
                            <Banknote className="w-4 h-4 text-on-surface-variant" aria-hidden="true" />
                            {t('realEstate.projects.stats.stage')}
                        </span>
                        <span className="body-sm font-semibold text-on-surface">
                            {t(`realEstate.projects.status.${status}` as never)}
                        </span>
                    </div>
                    <ol className="flex items-center gap-1" aria-label={t('realEstate.projects.stats.stage')}>
                        {PROJECT_STATUSES.map((step, i) => {
                            const reached = PROJECT_STATUSES.indexOf(status as never) >= i;
                            return (
                                <li
                                    key={step}
                                    className={`h-2 flex-1 rounded-full ${reached ? 'bg-primary' : 'bg-surface-container-high'}`}
                                    title={t(`realEstate.projects.status.${step}` as never)}
                                />
                            );
                        })}
                    </ol>
                    <p className="body-xs text-on-surface-variant">
                        {t('realEstate.projects.stats.stageHint', { percent: String(progress) })}
                    </p>
                </div>
            </div>
        </div>
    );
}
