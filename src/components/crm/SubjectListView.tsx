'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { stageLabel } from '@/components/crm/labels';
import { SUBJECT_ENDPOINTS } from '@/lib/crm/subjects';
import { Badge, STATUS_TONE, contactName } from '@/components/realestate/ui';
import type { InterestCardData, PropertyBoardData } from '@/components/realestate/cards';

type Row = (InterestCardData | PropertyBoardData) & { stage?: string; updatedAt?: string; lastActivityAt?: string | null };
type SortKey = 'stage' | 'price' | 'updated';

/**
 * The list counterpart of the property and interest boards: the same cards as
 * rows, in stage order, so a long pipeline can be scanned and sorted without
 * scrolling across columns. Clicking a row opens it the way the board does.
 */
export default function SubjectListView({
    pipeline,
    subjectType,
    workspaceId,
    refreshKey,
    currency,
    onOpen,
}: {
    pipeline: { id: string; stages: string[]; workspaceId: string };
    subjectType: 'Interest' | 'Property';
    workspaceId?: string;
    refreshKey?: number;
    currency: string;
    onOpen: (row: any) => void;
}) {
    const { t, formatCurrency, formatDate } = useI18n();
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'stage', desc: false });

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetch(`${SUBJECT_ENDPOINTS[subjectType]}?workspaceId=${workspaceId ?? pipeline.workspaceId}&pipelineId=${pipeline.id}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (cancelled || !data) return;
                setRows(subjectType === 'Interest' ? data.interests ?? [] : data.properties ?? []);
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [pipeline.id, pipeline.workspaceId, subjectType, workspaceId, refreshKey]);

    const priceOf = (row: Row) => ('property' in row ? row.property.price : (row as PropertyBoardData).price) ?? 0;
    const updatedOf = (row: Row) => row.lastActivityAt ?? row.updatedAt ?? '';

    const sorted = useMemo(() => {
        const stageIndex = (s?: string) => {
            const i = s ? pipeline.stages.indexOf(s) : -1;
            return i === -1 ? Number.MAX_SAFE_INTEGER : i;
        };
        const cmp = (a: Row, b: Row) => {
            if (sort.key === 'price') return priceOf(a) - priceOf(b);
            if (sort.key === 'updated') return updatedOf(a).localeCompare(updatedOf(b));
            return stageIndex(a.stage) - stageIndex(b.stage);
        };
        return [...rows].sort((a, b) => (sort.desc ? -cmp(a, b) : cmp(a, b)));
    }, [rows, sort, pipeline.stages]);

    const toggleSort = (key: SortKey) =>
        setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key === 'updated' }));

    const SortHeader = ({ k, label, align = 'start' }: { k: SortKey; label: string; align?: 'start' | 'end' }) => (
        <th scope="col" className={`px-4 py-2.5 font-medium ${align === 'end' ? 'text-end' : 'text-start'}`} aria-sort={sort.key === k ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
            <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-on-surface">
                {label}
                {sort.key === k && (sort.desc ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />)}
            </button>
        </th>
    );

    if (loading && rows.length === 0) {
        return <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" /></div>;
    }
    if (rows.length === 0) {
        return <p className="py-16 text-center text-sm text-on-surface-variant">{t('crmList.empty')}</p>;
    }

    return (
        <div className="h-full overflow-auto border border-outline-variant/20 rounded-xl">
            <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-container-low text-xs text-on-surface-variant">
                    <tr className="text-start">
                        <th scope="col" className="px-4 py-2.5 font-medium text-start">
                            {t(subjectType === 'Interest' ? 'crmList.buyer' : 'crmList.property')}
                        </th>
                        <th scope="col" className="px-4 py-2.5 font-medium text-start">
                            {t(subjectType === 'Interest' ? 'crmList.property' : 'crmList.vendor')}
                        </th>
                        <SortHeader k="stage" label={t('crmList.stage')} />
                        <th scope="col" className="px-4 py-2.5 font-medium text-start">{t('crmList.status')}</th>
                        <SortHeader k="price" label={t('crmList.price')} align="end" />
                        <SortHeader k="updated" label={t('crmList.updated')} align="end" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/15">
                    {sorted.map((row) => {
                        const interest = subjectType === 'Interest' ? (row as InterestCardData) : null;
                        const property = subjectType === 'Property' ? (row as PropertyBoardData) : null;
                        const status = row.status;
                        const statusKey = (interest
                            ? `realEstate.interests.status.${status}`
                            : `realEstate.properties.status.${status}`) as MessageKey;
                        const updated = updatedOf(row);
                        return (
                            <tr
                                key={row.id}
                                onClick={() => onOpen(row)}
                                onKeyDown={(e) => { if (e.key === 'Enter') onOpen(row); }}
                                tabIndex={0}
                                className="cursor-pointer hover:bg-surface-container-high focus:bg-surface-container-high outline-none transition-colors"
                            >
                                <td className="px-4 py-3 font-medium text-on-surface">
                                    {interest ? contactName(interest.lead) : property?.title}
                                </td>
                                <td className="px-4 py-3 text-on-surface-variant">
                                    {interest
                                        ? [interest.property.title, interest.property.city].filter(Boolean).join(' · ')
                                        : [property?.vendor ? contactName(property.vendor) : null, property?.city, property?.reference].filter(Boolean).join(' · ')}
                                </td>
                                <td className="px-4 py-3 text-on-surface">{row.stage ? stageLabel(row.stage, t) : '–'}</td>
                                <td className="px-4 py-3">
                                    <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{t(statusKey)}</Badge>
                                </td>
                                <td className="px-4 py-3 text-end tabular-nums text-on-surface">
                                    {formatCurrency(priceOf(row), (interest?.property.currency ?? property?.currency) || currency)}
                                </td>
                                <td className="px-4 py-3 text-end text-on-surface-variant whitespace-nowrap">
                                    {updated ? formatDate(updated) : '–'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
