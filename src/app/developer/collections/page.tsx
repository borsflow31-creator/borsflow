'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Wallet } from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import Toast from '@/components/Toast';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { Modal, Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';
import { useWorkspaceCurrency } from '@/components/workspace/useWorkspaceCurrency';
import {
    CALL_STATUS_LABEL, CALL_STATUS_TONE, Chip, tableClass, tdClass, thClass,
} from '@/components/developer/status';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';

const PAYMENT_METHODS = ['bank_transfer', 'check', 'cash', 'credit_card', 'other'] as const;

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
}

type Filter = 'all' | 'issued' | 'sent_to_bank' | 'overdue' | 'paid';
const FILTERS: Filter[] = ['all', 'issued', 'sent_to_bank', 'overdue', 'paid'];

/**
 * A call is overdue when it is unpaid and past its due date, whether or not
 * something has flipped its stored status yet. Nothing runs that flip on a
 * schedule, so trusting the stored status alone would hide late payments.
 */
function effectiveStatus(call: CallRow, now: number): string {
    if (call.status === 'paid' || call.status === 'draft') return call.status;
    if (call.status === 'overdue') return 'overdue';
    if (call.dueAt && new Date(call.dueAt).getTime() < now) return 'overdue';
    return call.status;
}

function CollectionsInner() {
    const { workspaceId, ready } = useWorkspaceParam();
    const { t, formatNumber, formatDate } = useI18n();
    const currency = useWorkspaceCurrency(workspaceId);

    const [calls, setCalls] = useState<CallRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>('all');
    const [paying, setPaying] = useState<CallRow | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
            const status = effectiveStatus(call, now);
            if (status === 'draft') continue;
            if (status === 'paid') { collected += call.amount; continue; }
            outstanding += call.amount;
            const due = call.dueAt ? new Date(call.dueAt).getTime() : null;
            if (due !== null && due >= monthStart.getTime() && due < monthEnd.getTime()) dueThisMonth += call.amount;
            if (status === 'overdue') {
                overdue += call.amount;
                const days = due === null ? 0 : Math.floor((now - due) / DAY_MS);
                if (days <= 30) aging.a += call.amount;
                else if (days <= 60) aging.b += call.amount;
                else aging.c += call.amount;
            }
        }
        return { dueThisMonth, collected, outstanding, overdue, aging };
    }, [calls, now]);

    const visible = useMemo(
        () => calls.filter((c) => filter === 'all' || effectiveStatus(c, now) === filter),
        [calls, filter, now]
    );

    /** Record the payment with how and when it arrived, then refresh. Throws so the dialog can show why. */
    const recordPayment = async (call: CallRow, payment: { paidAt: string; method: string; reference: string }) => {
        const res = await fetch(`/api/developer/calls-for-funds/${call.id}/paid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workspaceId,
                paidAt: payment.paidAt,
                method: payment.method,
                reference: payment.reference.trim() || undefined,
            }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || t('developer.markPaidFailed'));
        }
        setPaying(null);
        await load();
    };

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

                {/* Filters */}
                <div role="tablist" className="flex flex-wrap gap-1.5">
                    {FILTERS.map((f) => (
                        <button
                            key={f}
                            role="tab"
                            aria-selected={filter === f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                filter === f ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            {f === 'all' ? t('developer.filterAllStatuses') : t(CALL_STATUS_LABEL[f])}
                        </button>
                    ))}
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
                                    const status = effectiveStatus(call, now);
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
                                            <td className={`${tdClass} text-end font-semibold tabular-nums`}>{money(call.amount)}</td>
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
                                                {status !== 'paid' && status !== 'draft' && (
                                                    <button
                                                        onClick={() => setPaying(call)}
                                                        className="text-xs font-medium text-secondary hover:underline"
                                                    >
                                                        {t('developer.markPaid')}
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
            </div>
            {paying && (
                <PaymentDialog
                    call={paying}
                    amountLabel={money(paying.amount)}
                    onClose={() => setPaying(null)}
                    onSubmit={(payment) => recordPayment(paying, payment)}
                />
            )}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppShell>
    );
}

/** How and when the money arrived: it becomes a payment on the call's invoice. */
function PaymentDialog({
    call, amountLabel, onClose, onSubmit,
}: {
    call: CallRow;
    amountLabel: string;
    onClose: () => void;
    onSubmit: (payment: { paidAt: string; method: string; reference: string }) => Promise<void>;
}) {
    const { t } = useI18n();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const [paidAt, setPaidAt] = useState(today);
    const [method, setMethod] = useState<string>('bank_transfer');
    const [reference, setReference] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            await onSubmit({ paidAt, method, reference });
        } catch (err: any) {
            setError(err.message || t('developer.markPaidFailed'));
            setSaving(false);
        }
    };

    return (
        <Modal title={t('developerSales.collections.paymentTitle')} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                {error && <p role="alert" className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">{error}</p>}
                <p className="text-sm text-on-surface-variant">
                    {call.callNumber} · <strong className="text-on-surface tabular-nums">{amountLabel}</strong>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label={t('developerSales.collections.paymentDate')}>
                        <input type="date" required max={today} className={inputClass} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                    </Field>
                    <Field label={t('developerSales.collections.paymentMethod')}>
                        <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
                            {PAYMENT_METHODS.map((m) => (
                                <option key={m} value={m}>{t(`developerSales.collections.method_${m}` as MessageKey)}</option>
                            ))}
                        </select>
                    </Field>
                </div>
                <Field label={t('developerSales.collections.paymentReference')}>
                    <input type="text" maxLength={100} className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} />
                </Field>
                <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={onClose} className={secondaryButton} disabled={saving}>{t('common.cancel')}</button>
                    <button type="submit" className={`${primaryButton} inline-flex items-center gap-2`} disabled={saving}>
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {t('developerSales.collections.recordPayment')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

export default function CollectionsPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <CollectionsInner />
        </Suspense>
    );
}
