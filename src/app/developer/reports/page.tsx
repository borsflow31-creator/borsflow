'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, Loader2, Trash2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import Toast from '@/components/Toast';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { Field, inputClass, primaryButton } from '@/components/realestate/ui';
import { useWorkspaceCurrency } from '@/components/workspace/useWorkspaceCurrency';
import { LOT_STATUS_LABEL, tableClass, tdClass, thClass } from '@/components/developer/status';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { toCsv, type CsvCell } from '@/lib/export/csv';
import { LEAD_SOURCES } from '@/lib/crm/lifecycle';
import type { Cell, ColumnKind, Report, ReportName, ReportTable } from '@/lib/services/developer/reports';

const TABS: ReportName[] = ['sales', 'marketing', 'inventory', 'financial'];
/** The inventory report is a snapshot of today, so a date range means nothing to it. */
const RANGED: ReportName[] = ['sales', 'marketing', 'financial'];

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const isKnownSource = (v: string) => (LEAD_SOURCES as readonly string[]).includes(v);

interface SpendRow { id: string; source: string; campaign: string; month: string; amount: number }

function ReportsInner() {
    const { workspaceId, ready } = useWorkspaceParam();
    const { t, locale, formatNumber } = useI18n();
    const currency = useWorkspaceCurrency(workspaceId);

    const now = useMemo(() => new Date(), []);
    const [tab, setTab] = useState<ReportName>('sales');
    const [from, setFrom] = useState(isoDay(new Date(Date.UTC(now.getUTCFullYear(), 0, 1))));
    const [to, setTo] = useState(isoDay(now));
    const [groupBy, setGroupBy] = useState<'source' | 'campaign'>('source');
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [spend, setSpend] = useState<SpendRow[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        setFailed(false);
        try {
            const params = new URLSearchParams({ workspaceId });
            if (RANGED.includes(tab)) { params.set('from', from); params.set('to', to); }
            if (tab === 'marketing') params.set('groupBy', groupBy);
            const res = await fetch(`/api/developer/reports/${tab}?${params}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'failed');
            setReport(data.report);
        } catch (err: any) {
            setFailed(true);
            setToast({ message: err.message && err.message !== 'failed' ? err.message : t('developerSales.reports.loadFailed'), type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [workspaceId, tab, from, to, groupBy, t]);

    useEffect(() => { if (ready && workspaceId) load(); }, [ready, workspaceId, load]);

    const loadSpend = useCallback(async () => {
        if (!workspaceId) return;
        const res = await fetch(`/api/developer/marketing-spend?workspaceId=${workspaceId}`);
        if (res.ok) setSpend((await res.json()).spend ?? []);
    }, [workspaceId]);

    useEffect(() => { if (ready && workspaceId && tab === 'marketing') loadSpend(); }, [ready, workspaceId, tab, loadSpend]);

    /** One cell as the viewer reads it. */
    const display = (cell: Cell, kind: ColumnKind, column: string): string => {
        if (cell === null || cell === undefined || cell === '') return '–';
        if (kind === 'money') return formatNumber(Number(cell), { style: 'currency', currency, maximumFractionDigits: 0 });
        if (kind === 'int') return formatNumber(Number(cell));
        if (kind === 'percent') return `${formatNumber(Number(cell), { maximumFractionDigits: 1 })}%`;
        if (kind === 'decimal') return formatNumber(Number(cell), { maximumFractionDigits: 1 });
        if (kind === 'month') {
            return new Date(`${cell}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
        }
        if (kind === 'source') {
            const s = String(cell);
            return s === 'unknown' ? t('developerSales.reports.unknownSource') : isKnownSource(s) ? t(`developerCrm.sources.${s}` as MessageKey) : s;
        }
        const text = String(cell);
        if (column === 'status') {
            if (LOT_STATUS_LABEL[text]) return t(LOT_STATUS_LABEL[text]);
            if (['accrued', 'realized', 'paid'].includes(text)) return t(`developerSales.reports.commissionStatus_${text}` as MessageKey);
        }
        return text;
    };

    const label = (group: 'col' | 'sum' | 'table', key: string) => t(`developerSales.reports.${group}_${key}` as MessageKey);

    /** The CSV carries raw numbers (a spreadsheet can sum them) under headers in the viewer's language. */
    const exportCsv = () => {
        if (!report) return;
        const rows: CsvCell[][] = [];
        rows.push([t(`developerSales.reports.tab_${report.report}` as MessageKey), `${report.from.slice(0, 10)} – ${report.to.slice(0, 10)}`, report.currency]);
        rows.push([]);
        for (const s of report.summary) rows.push([label('sum', s.key), s.value]);
        for (const table of report.tables) {
            rows.push([]);
            rows.push([label('table', table.id)]);
            rows.push(table.columns.map((c) => label('col', c.key)));
            for (const r of table.rows) {
                rows.push(r.map((cell, i) => {
                    const kind = table.columns[i].kind;
                    return kind === 'source' || (kind === 'text' && table.columns[i].key === 'status') ? display(cell, kind, table.columns[i].key) : cell;
                }));
            }
        }
        const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.report}-report-${report.from.slice(0, 10)}-${report.to.slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <AppShell><NoWorkspace /></AppShell>;

    const renderTable = (table: ReportTable) => (
        <section key={table.id}>
            <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">{label('table', table.id)}</h2>
            <div className="overflow-x-auto border border-outline-variant/20 rounded-xl">
                <table className={tableClass}>
                    <thead className="bg-surface-container-low">
                        <tr>
                            {table.columns.map((c) => (
                                <th key={c.key} className={`${thClass} ${['text', 'source', 'month'].includes(c.kind) ? '' : 'text-end'}`}>{label('col', c.key)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/15">
                        {table.rows.length === 0 ? (
                            <tr><td colSpan={table.columns.length} className={`${tdClass} text-on-surface-variant`}>{t('developerSales.reports.empty')}</td></tr>
                        ) : table.rows.map((r, i) => (
                            <tr key={i}>
                                {r.map((cell, j) => {
                                    const c = table.columns[j];
                                    const left = ['text', 'source', 'month'].includes(c.kind);
                                    return (
                                        <td key={j} className={`${tdClass} ${left ? (j === 0 ? 'font-medium text-on-surface' : 'text-on-surface-variant') : 'text-end tabular-nums'}`}>
                                            {display(cell, c.kind, c.key)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );

    return (
        <AppShell>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <PageHeader
                    icon={BarChart3}
                    title={t('developerSales.reports.title')}
                    subtitle={t('developerSales.reports.subtitle')}
                    guide="reports"
                    actions={
                        <>
                            <button
                                onClick={exportCsv}
                                disabled={!report || loading}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-outline-variant/30 text-sm font-medium text-on-surface hover:bg-surface-container-high disabled:opacity-40 transition-colors"
                            >
                                <Download className="h-4 w-4" />
                                {t('developerSales.reports.exportCsv')}
                            </button>
                        </>
                    }
                />

                <div className="flex flex-wrap items-center gap-3">
                    <div role="tablist" className="inline-flex rounded-lg border border-outline-variant/30 p-0.5 bg-surface-container-low">
                        {TABS.map((k) => (
                            <button
                                key={k}
                                role="tab"
                                aria-selected={tab === k}
                                onClick={() => setTab(k)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                    tab === k ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                {t(`developerSales.reports.tab_${k}` as MessageKey)}
                            </button>
                        ))}
                    </div>
                    {RANGED.includes(tab) && (
                        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                            <input type="date" aria-label={t('developerSales.reports.from')} className="premium-input px-2 py-1.5 text-sm" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
                            <span aria-hidden>–</span>
                            <input type="date" aria-label={t('developerSales.reports.to')} className="premium-input px-2 py-1.5 text-sm" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
                        </div>
                    )}
                    {tab === 'marketing' && (
                        <div role="tablist" className="inline-flex rounded-lg border border-outline-variant/30 p-0.5 bg-surface-container-low">
                            {(['source', 'campaign'] as const).map((g) => (
                                <button
                                    key={g}
                                    role="tab"
                                    aria-selected={groupBy === g}
                                    onClick={() => setGroupBy(g)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        groupBy === g ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                                    }`}
                                >
                                    {t(`developerSales.reports.groupBy_${g}` as MessageKey)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {tab === 'marketing' && <p className="text-xs text-on-surface-variant max-w-2xl">{t('developerSales.reports.marketingNote')}</p>}

                {failed && !report ? (
                    <p className="py-12 text-center text-sm text-on-surface-variant">
                        {t('developerSales.reports.loadFailed')}{' '}
                        <button onClick={load} className="text-secondary hover:underline">{t('developerDashboard.retry')}</button>
                    </p>
                ) : loading && !report ? (
                    <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" /></div>
                ) : report && report.report === tab ? (
                    <div className={`space-y-6 ${loading ? 'opacity-60' : ''}`}>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-outline-variant/20 border border-outline-variant/20 rounded-xl overflow-hidden">
                            {report.summary.map((s) => (
                                <div key={s.key} className="p-4 bg-surface-container-lowest">
                                    <p className="text-xs text-on-surface-variant mb-1.5">{label('sum', s.key)}</p>
                                    <p className="text-xl font-semibold text-on-surface tabular-nums">{display(s.value, s.kind, s.key)}</p>
                                </div>
                            ))}
                        </div>
                        {report.tables.map(renderTable)}
                    </div>
                ) : null}

                {tab === 'marketing' && (
                    <SpendPanel
                        workspaceId={workspaceId}
                        currency={currency}
                        rows={spend}
                        onChanged={() => { loadSpend(); load(); }}
                        onError={(message) => setToast({ message, type: 'error' })}
                    />
                )}
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppShell>
    );
}

/** What was spent on each channel each month: the one number the product cannot know on its own. */
function SpendPanel({
    workspaceId, currency, rows, onChanged, onError,
}: {
    workspaceId: string;
    currency: string;
    rows: SpendRow[];
    onChanged: () => void;
    onError: (message: string) => void;
}) {
    const { t, formatNumber, locale } = useI18n();
    const thisMonth = new Date().toISOString().slice(0, 7);
    const [source, setSource] = useState<string>('facebook');
    const [campaign, setCampaign] = useState('');
    const [month, setMonth] = useState(thisMonth);
    const [amount, setAmount] = useState('');
    const [saving, setSaving] = useState(false);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/developer/marketing-spend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId, source, campaign: campaign.trim() || undefined, month, amount: Number(amount) }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || t('developerSales.reports.spendFailed'));
            setAmount('');
            onChanged();
        } catch (err: any) {
            onError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id: string) => {
        const res = await fetch(`/api/developer/marketing-spend/${id}?workspaceId=${workspaceId}`, { method: 'DELETE' });
        if (!res.ok) return onError(t('developerSales.reports.spendFailed'));
        onChanged();
    };

    return (
        <section className="border border-outline-variant/20 rounded-xl p-5 space-y-4">
            <div>
                <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{t('developerSales.reports.spendTitle')}</h2>
                <p className="text-xs text-on-surface-variant/80 mt-1">{t('developerSales.reports.spendHint')}</p>
            </div>

            <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                <Field label={t('developerCrm.lead.source')}>
                    <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value)}>
                        {LEAD_SOURCES.map((s) => <option key={s} value={s}>{t(`developerCrm.sources.${s}` as MessageKey)}</option>)}
                    </select>
                </Field>
                <Field label={t('developerCrm.lead.campaign')}>
                    <input className={inputClass} value={campaign} maxLength={120} onChange={(e) => setCampaign(e.target.value)} />
                </Field>
                <Field label={t('developerSales.reports.spendMonth')}>
                    <input type="month" required className={inputClass} value={month} onChange={(e) => setMonth(e.target.value)} />
                </Field>
                <Field label={t('developerSales.reports.spendAmount')}>
                    <input type="number" required min={0} step={10} className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
                </Field>
                <button type="submit" disabled={saving || amount === ''} className={`${primaryButton} inline-flex items-center justify-center gap-2`}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('developerCrm.tasks.save')}
                </button>
            </form>

            {rows.length > 0 && (
                <ul className="divide-y divide-outline-variant/15 border border-outline-variant/20 rounded-lg">
                    {rows.slice(0, 12).map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <span className="min-w-0 truncate text-on-surface">
                                {isKnownSource(r.source) ? t(`developerCrm.sources.${r.source}` as MessageKey) : r.source}
                                {r.campaign && <span className="text-on-surface-variant"> · {r.campaign}</span>}
                                <span className="text-on-surface-variant"> · {new Date(r.month).toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' })}</span>
                            </span>
                            <span className="flex items-center gap-3 flex-shrink-0">
                                <span className="tabular-nums font-medium">{formatNumber(r.amount, { style: 'currency', currency, maximumFractionDigits: 0 })}</span>
                                <button type="button" onClick={() => remove(r.id)} aria-label={t('developerCrm.tasks.remove')} className="text-on-surface-variant/60 hover:text-error transition-colors">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

export default function ReportsPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <ReportsInner />
        </Suspense>
    );
}
