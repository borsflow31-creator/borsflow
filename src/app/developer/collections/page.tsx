'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Wallet } from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import Toast from '@/components/Toast';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { inputClass } from '@/components/realestate/ui';
import { useWorkspaceCurrency } from '@/components/workspace/useWorkspaceCurrency';
import {
    CALL_STATUS_LABEL, CALL_STATUS_TONE, Chip, tableClass, tdClass, thClass,
} from '@/components/developer/status';
import CollectionTargetPicker from '@/components/developer/CollectionTargetPicker';
import LotLedgerPanel from '@/components/developer/LotLedgerPanel';
import PaymentJournal from '@/components/developer/PaymentJournal';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { callAmounts, effectiveCallStatus } from '@/lib/services/developer/call-balance';

const DAY_MS = 86_400_000;

interface CallRow {
    id: string;
    callNumber: string;
    amount: number;
    status: string;
    dueAt: string | null;
    paidAt: string | null;
    lot: {
        id: string;
        lotNumber: string;
        program: { id: string; name: string };
        buyerLead: { firstName: string; lastName: string } | null;
    };
    milestone: { title: string; targetPercentage: number };
    reminders?: { step: string; sentAt: string }[];
    invoice: { amountPaid: number } | null;
}

type Filter = 'all' | 'issued' | 'sent_to_bank' | 'partially_paid' | 'overdue' | 'paid';
const FILTERS: Filter[] = ['all', 'issued', 'sent_to_bank', 'partially_paid', 'overdue', 'paid'];
type Tab = 'calls' | 'journal';

function CollectionsInner() {
    const { workspaceId, ready } = useWorkspaceParam();
    const { t, formatNumber, formatDate } = useI18n();
    const currency = useWorkspaceCurrency(workspaceId);

    const [calls, setCalls] = useState<CallRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>('all');
    const [search, setSearch] = useState('');
    const [programId, setProgramId] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // The open unit lives in the URL (?lot=…&call=…), so a contract's payments can
    // be linked to from anywhere and are still open after a reload.
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const openLotId = searchParams.get('lot');
    const openCallId = searchParams.get('call');
    const tab: Tab = searchParams.get('tab') === 'journal' ? 'journal' : 'calls';

    const setQuery = useCallback((changes: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(changes)) {
            if (value) params.set(key, value);
            else params.delete(key);
        }
        if (workspaceId && !params.get('workspace')) params.set('workspace', workspaceId);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [router, pathname, searchParams, workspaceId]);

    const openLot = (lotId: string, callId?: string) => {
        setQuery({ lot: lotId, call: callId ?? null });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const money = (n: number) => formatNumber(n, { style: 'currency', currency, maximumFractionDigits: 0 });
    const moneyCompact = (n: number) =>
        formatNumber(n, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/developer/calls-for-funds?workspaceId=${workspaceId}`);
            if (!res.ok) throw new Error('failed');
            const data = await res.json();
            setCalls(data.calls ?? []);
        } catch {
            setToast({ message: t('developer.loadFailed'), type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [workspaceId, t]);

    useEffect(() => { if (ready && workspaceId) load(); }, [ready, workspaceId, load]);

    const now = Date.now();

    const summary = useMemo(() => {
        const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(monthStart); monthEnd.setMonth(monthEnd.getMonth() + 1);
        let dueThisMonth = 0, collected = 0, outstanding = 0, overdue = 0;
        const aging = { a: 0, b: 0, c: 0 };
        for (const call of calls) {
            // Part payments count for what was received and what is left.
            const owed = callAmounts(call, now);
            collected += owed.collected;
            if (owed.outstanding <= 0) continue;
            outstanding += owed.outstanding;
            const due = call.dueAt ? new Date(call.dueAt).getTime() : null;
            if (due !== null && due >= monthStart.getTime() && due < monthEnd.getTime()) dueThisMonth += owed.outstanding;
            if (owed.overdue > 0) {
                overdue += owed.overdue;
                const days = due === null ? 0 : Math.floor((now - due) / DAY_MS);
                if (days <= 30) aging.a += owed.overdue;
                else if (days <= 60) aging.b += owed.overdue;
                else aging.c += owed.overdue;
            }
        }
        return { dueThisMonth, collected, outstanding, overdue, aging };
    }, [calls, now]);

    const programs = useMemo(() => {
        const seen = new Map<string, string>();
        for (const c of calls) seen.set(c.lot.program.id, c.lot.program.name);
        return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [calls]);

    const visible = useMemo(() => {
        const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
        return calls.filter((c) => {
            if (filter !== 'all' && effectiveCallStatus(c, now) !== filter) return false;
            if (programId && c.lot.program.id !== programId) return false;
            if (words.length === 0) return true;
            const haystack = [c.callNumber, c.lot.lotNumber, c.lot.program.name, c.lot.buyerLead?.firstName, c.lot.buyerLead?.lastName]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return words.every((w) => haystack.includes(w));
        });
    }, [calls, filter, programId, search, now]);

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <AppShell><NoWorkspace /></AppShell>;

    const agingTotal = summary.aging.a + summary.aging.b + summary.aging.c;
    const agingRows = [
        { key: 'a', label: t('developer.aging030'), value: summary.aging.a },
        { key: 'b', label: t('developer.aging3160'), value: summary.aging.b },
        { key: 'c', label: t('developer.aging60'), value: summary.aging.c },
    ];

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <PageHeader
                    icon={Wallet}
                    title={t('developer.collectionsTitle')}
                    subtitle={t('developer.collectionsSubtitle')}
                    guide="collections"
                />

                <div className="max-w-xl">
                    <CollectionTargetPicker workspaceId={workspaceId} currency={currency} onPick={(target) => openLot(target.id)} />
                </div>

                {openLotId && (
                    <LotLedgerPanel
                        workspaceId={workspaceId}
                        lotId={openLotId}
                        initialCallId={openCallId}
                        currency={currency}
                        onClose={() => setQuery({ lot: null, call: null })}
                        onChanged={load}
                        notify={(message, type) => setToast({ message, type })}
                    />
                )}

                {/* Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-outline-variant/20 border border-outline-variant/20 rounded-xl overflow-hidden">
                    {[
                        { label: t('developer.dueThisMonth'), value: summary.dueThisMonth, tone: '' },
                        { label: t('developer.collected'), value: summary.collected, tone: '' },
                        { label: t('developer.outstanding'), value: summary.outstanding, tone: '' },
                        { label: t('developer.overdue'), value: summary.overdue, tone: summary.overdue > 0 ? 'text-error' : '' },
                    ].map((k) => (
                        <div key={k.label} className="p-4 bg-surface-container-lowest">
                            <p className="text-xs text-on-surface-variant mb-1.5">{k.label}</p>
                            <p className={`text-xl font-semibold tabular-nums ${k.tone || 'text-on-surface'}`}>{moneyCompact(k.value)}</p>
                        </div>
                    ))}
                </div>

                {/* Overdue ageing */}
                {summary.overdue > 0 && (
                    <section className="border border-outline-variant/20 rounded-xl p-5">
                        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">{t('developer.agingTitle')}</h2>
                        <div className="flex h-3 gap-0.5 rounded overflow-hidden mb-3" role="img" aria-label={agingRows.map((r) => `${r.label}: ${money(r.value)}`).join(', ')}>
                            {agingRows.filter((r) => r.value > 0).map((r, i) => (
                                <div key={r.key} style={{ width: `${(r.value / agingTotal) * 100}%`, opacity: 0.45 + i * 0.275 }} className="h-full bg-error" />
                            ))}
                        </div>
                        <ul className="grid grid-cols-3 gap-3">
                            {agingRows.map((r) => (
                                <li key={r.key}>
                                    <p className="text-xs text-on-surface-variant">{r.label}</p>
                                    <p className="text-sm font-semibold text-on-surface tabular-nums">{money(r.value)}</p>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <div role="tablist" aria-label={t('developer.collectionsTitle')} className="flex gap-6 border-b border-outline-variant/30">
                    {(['calls', 'journal'] as Tab[]).map((key) => (
                        <button
                            key={key}
                            role="tab"
                            aria-selected={tab === key}
                            onClick={() => setQuery({ tab: key === 'calls' ? null : key })}
                            className={`-mb-px pb-2.5 text-sm font-medium border-b-2 transition-colors ${
                                tab === key ? 'border-secondary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            {t(key === 'calls' ? 'developerSales.payments.tabSchedule' : 'developerSales.payments.tabJournal')}
                        </button>
                    ))}
                </div>

                {tab === 'journal' ? (
                    <PaymentJournal workspaceId={workspaceId} currency={currency} programs={programs} onOpenLot={(lotId) => openLot(lotId)} />
                ) : (
                    <>
                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-3">
                            <input
                                type="search"
                                className={`${inputClass} !py-2 max-w-xs`}
                                value={search}
                                maxLength={60}
                                placeholder={t('developerSales.payments.searchCalls')}
                                aria-label={t('developerSales.payments.searchCalls')}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {programs.length > 1 && (
                                <select
                                    className={`${inputClass} !py-2 max-w-xs`}
                                    value={programId}
                                    aria-label={t('developerSales.payments.program')}
                                    onChange={(e) => setProgramId(e.target.value)}
                                >
                                    <option value="">{t('developerSales.payments.allPrograms')}</option>
                                    {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            )}
                            <div role="group" aria-label={t('developer.colStatus')} className="flex flex-wrap gap-1.5">
                                {FILTERS.map((f) => (
                                    <button
                                        key={f}
                                        aria-pressed={filter === f}
                                        onClick={() => setFilter(f)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                            filter === f ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                                        }`}
                                    >
                                        {f === 'all' ? t('developer.filterAllStatuses') : t(CALL_STATUS_LABEL[f])}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table */}
                        {loading && calls.length === 0 ? (
                            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" /></div>
                        ) : visible.length === 0 ? (
                            <div className="p-12 text-center border border-dashed border-outline-variant/40 rounded-xl">
                                <Wallet className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-3" />
                                <p className="text-sm text-on-surface-variant max-w-md mx-auto">{t('developer.collectionsEmpty')}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto border border-outline-variant/20 rounded-xl">
                                <table className={tableClass}>
                                    <thead className="bg-surface-container-low">
                                        <tr>
                                            <th className={thClass}>{t('developer.colCallNumber')}</th>
                                            <th className={thClass}>{t('developer.colProjectUnit')}</th>
                                            <th className={thClass}>{t('developer.colBuyer')}</th>
                                            <th className={thClass}>{t('developer.colMilestone')}</th>
                                            <th className={`${thClass} text-end`}>{t('developer.colAmount')}</th>
                                            <th className={thClass}>{t('developer.colDueDate')}</th>
                                            <th className={thClass}>{t('developer.colStatus')}</th>
                                            <th className={thClass}>{t('developerSales.collections.reminders')}</th>
                                            <th className={thClass} />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-outline-variant/15">
                                        {visible.map((call) => {
                                            const status = effectiveCallStatus(call, now);
                                            const owed = callAmounts(call, now);
                                            const daysLate = status === 'overdue' && call.dueAt
                                                ? Math.floor((now - new Date(call.dueAt).getTime()) / DAY_MS)
                                                : 0;
                                            const buyer = call.lot.buyerLead
                                                ? `${call.lot.buyerLead.firstName} ${call.lot.buyerLead.lastName}`.trim()
                                                : '–';
                                            return (
                                                <tr key={call.id} className="hover:bg-surface-container-low/60 transition-colors">
                                                    <td className={`${tdClass} font-mono text-xs`}>{call.callNumber}</td>
                                                    <td className={tdClass}>
                                                        <Link
                                                            href={`/developer/programs/${call.lot.program.id}?workspace=${workspaceId}`}
                                                            className="text-on-surface hover:text-secondary transition-colors"
                                                        >
                                                            {call.lot.program.name} · {call.lot.lotNumber}
                                                        </Link>
                                                    </td>
                                                    <td className={tdClass}>{buyer}</td>
                                                    <td className={`${tdClass} text-on-surface-variant`}>
                                                        {call.milestone.title} ({call.milestone.targetPercentage}%)
                                                    </td>
                                                    <td className={`${tdClass} text-end font-semibold tabular-nums`}>
                                                        {money(call.amount)}
                                                        {owed.collected > 0 && owed.outstanding > 0 && (
                                                            <span className="block text-[11px] font-normal text-on-surface-variant">
                                                                {t('developerSales.payments.leftToPay', { amount: money(owed.outstanding) })}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                                                        {call.dueAt ? formatDate(call.dueAt) : '–'}
                                                        {daysLate > 0 && (
                                                            <span className="block text-[11px] text-error">{t('developerDashboard.daysOverdue', { days: daysLate })}</span>
                                                        )}
                                                    </td>
                                                    <td className={tdClass}>
                                                        <Chip tone={CALL_STATUS_TONE[status] ?? CALL_STATUS_TONE.draft}>
                                                            {t(CALL_STATUS_LABEL[status] ?? CALL_STATUS_LABEL.draft)}
                                                        </Chip>
                                                    </td>
                                                    <td className={`${tdClass} text-xs text-on-surface-variant whitespace-nowrap`}>
                                                        {call.reminders && call.reminders.length > 0 ? (
                                                            <>
                                                                {t(`developerSales.collections.step_${call.reminders[call.reminders.length - 1].step}` as MessageKey)}
                                                                <span className="block tabular-nums">{formatDate(call.reminders[call.reminders.length - 1].sentAt)}</span>
                                                            </>
                                                        ) : (
                                                            '–'
                                                        )}
                                                    </td>
                                                    <td className={`${tdClass} text-end`}>
                                                        {status !== 'draft' && (
                                                            <button
                                                                onClick={() => openLot(call.lot.id, owed.outstanding > 0 ? call.id : undefined)}
                                                                className="text-xs font-medium text-secondary hover:underline"
                                                            >
                                                                {owed.outstanding > 0 ? t('developerSales.payments.collect') : t('developerSales.payments.viewPayments')}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppShell>
    );
}

export default function CollectionsPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <CollectionsInner />
        </Suspense>
    );
}
