'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, Loader2, X } from 'lucide-react';
import { Modal, Field, inputClass, primaryButton, secondaryButton, dangerButton } from '@/components/realestate/ui';
import { CALL_STATUS_LABEL, CALL_STATUS_TONE, Chip, tableClass, tdClass, thClass } from '@/components/developer/status';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { METHOD_RULES, fromCents, toCents, type PaymentMethod } from '@/lib/documents/payment-rules';

/** The methods offered for a call for funds. PayPal is for the generic invoices only. */
export const COLLECTION_METHODS: PaymentMethod[] = ['bank_transfer', 'check', 'cash', 'credit_card', 'other'];

export interface LedgerPayment {
    id: string;
    amount: number;
    kind: string;
    status: string;
    paymentDate: string;
    paymentMethod: string;
    referenceNumber: string | null;
    notes: string | null;
    receiptNumber: string | null;
    refundOfId: string | null;
    reversalReason: string | null;
    createdBy: { id: string; name: string | null } | null;
    callId: string;
    callNumber: string;
}

/** One line of the schedule: the unit's deposit, or a call for funds. */
export interface LedgerCall {
    type: 'deposit' | 'call';
    id: string;
    callNumber: string;
    title: string;
    percentage: number | null;
    amount: number;
    dueAt: string | null;
    status: string;
    daysLate: number;
    collected: number;
    pending: number;
    payable: number;
    hasInvoice: boolean;
}

export interface Ledger {
    currency: string | null;
    lot: {
        id: string;
        lotNumber: string;
        status: string;
        building: string | null;
        program: { id: string; name: string; reference: string | null };
        contractNumber: string | null;
    };
    buyer: { id: string; firstName: string; lastName: string | null; email: string | null; phone: string | null } | null;
    totals: {
        contract: number;
        /** The deposit asked, and (below) what was received of it. */
        depositAsked: number;
        deposit: number;
        called: number;
        collected: number;
        pending: number;
        outstanding: number;
        overdue: number;
        remainingOnContract: number;
    };
    nextCallId: string | null;
    calls: LedgerCall[];
    payments: LedgerPayment[];
}

/** Today in the user's own time zone, as the date input wants it. */
export function localToday(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "1 234,50" or "1234.5" typed by a person, as cents; null when it is not a number. */
export function parseAmountCents(value: string): number | null {
    const cleaned = value.replace(/[\s  ]/g, '').replace(',', '.');
    if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
    return toCents(Number(cleaned));
}

function newRequestKey(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** How long to wait before treating a payment request as of unknown outcome. */
const SUBMIT_TIMEOUT_MS = 20_000;

export const PAYMENT_STATUS_TONE: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    confirmed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    failed: 'bg-red-500/10 text-red-700 dark:text-red-400',
    reversed: 'bg-surface-container-high text-on-surface-variant',
    refund: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
};

export function paymentStatusKey(p: { kind: string; status: string }): string {
    if (p.kind === 'refund' && p.status === 'confirmed') return 'refund';
    return p.status;
}

export function receiptUrl(workspaceId: string, paymentId: string): string {
    return `/api/developer/payments/${paymentId}/receipt?workspaceId=${encodeURIComponent(workspaceId)}`;
}

/** How far the last summary tile spans on the four-column grid, by how many tiles the last row holds. */
const LAST_TILE_SPAN: Record<number, string> = { 0: '', 1: 'sm:col-span-4', 2: 'sm:col-span-3', 3: 'sm:col-span-2' };

type Action =
    | { kind: 'confirm' | 'fail' | 'reverse'; payment: LedgerPayment }
    | { kind: 'refund'; payment: LedgerPayment; refundable: number };

/**
 * Everything about collecting from one sold unit, on one screen: who owes what,
 * the schedule, a payment form prefilled from the selected call, a live recap of
 * the effect, and every payment with its receipt and the actions it allows.
 */
export default function LotLedgerPanel({
    workspaceId, lotId, initialCallId, currency, onClose, onChanged, notify,
}: {
    workspaceId: string;
    lotId: string;
    initialCallId?: string | null;
    currency: string;
    onClose: () => void;
    /** Something was recorded: the caller refreshes its own lists. */
    onChanged: () => void;
    notify: (message: string, type: 'success' | 'error') => void;
}) {
    const { t, formatNumber, formatDate } = useI18n();
    const money = useCallback(
        (n: number) => formatNumber(n, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        [formatNumber, currency]
    );

    const rowTitle = (row: LedgerCall) => (row.type === 'deposit' ? t('developerSales.payments.depositRow') : row.title);

    const [ledger, setLedger] = useState<Ledger | null>(null);
    const [rights, setRights] = useState({ canWrite: false, canModerate: false });
    const [loadError, setLoadError] = useState(false);
    const [callId, setCallId] = useState<string | null>(initialCallId ?? null);
    const [action, setAction] = useState<Action | null>(null);
    const [lastReceipt, setLastReceipt] = useState<{ id: string; number: string } | null>(null);

    const load = useCallback(async () => {
        setLoadError(false);
        try {
            const res = await fetch(`/api/developer/lots/${lotId}/ledger?workspaceId=${encodeURIComponent(workspaceId)}`);
            if (!res.ok) throw new Error(String(res.status));
            const data = await res.json();
            setLedger(data.ledger);
            setRights({ canWrite: Boolean(data.canWrite), canModerate: Boolean(data.canModerate) });
        } catch {
            setLoadError(true);
        }
    }, [lotId, workspaceId]);

    useEffect(() => { setLedger(null); setLastReceipt(null); load(); }, [load]);

    // The selected call: the one asked for, else the oldest overdue or next due.
    useEffect(() => {
        if (!ledger) return;
        setCallId((current) => {
            const still = current && ledger.calls.find((c) => c.id === current && c.payable > 0);
            return still ? current : ledger.nextCallId;
        });
    }, [ledger]);

    const applyLedger = (next: Ledger | null) => {
        if (next) setLedger(next);
        onChanged();
    };

    if (loadError) {
        return (
            <section className="border border-outline-variant/30 rounded-xl p-6 flex items-center justify-between gap-4" role="alert">
                <p className="text-sm text-error">{t('developerSales.payments.loadFailed')}</p>
                <div className="flex gap-2">
                    <button type="button" onClick={load} className={secondaryButton}>{t('developerSales.payments.retry')}</button>
                    <button type="button" onClick={onClose} className={secondaryButton}>{t('developerSales.payments.close')}</button>
                </div>
            </section>
        );
    }

    if (!ledger) {
        return (
            <section className="border border-outline-variant/30 rounded-xl p-10 flex justify-center" role="status" aria-label={t('developerSales.payments.loading')}>
                <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
            </section>
        );
    }

    const selected = ledger.calls.find((c) => c.id === callId) ?? null;
    const buyerName = ledger.buyer ? `${ledger.buyer.firstName} ${ledger.buyer.lastName ?? ''}`.trim() : '–';
    const totals = ledger.totals;
    const refundedOf = (paymentId: string) =>
        ledger.payments
            .filter((p) => p.kind === 'refund' && p.status === 'confirmed' && p.refundOfId === paymentId)
            .reduce((sum, p) => sum + toCents(p.amount), 0);

    const summary: { key: string; label: string; value: number; tone?: string; sub?: string }[] = [
        { key: 'contract', label: t('developerSales.payments.contract'), value: totals.contract },
        ...(totals.depositAsked > 0
            ? [{
                key: 'deposit',
                label: t('developerSales.payments.deposit'),
                value: totals.deposit,
                sub: totals.deposit < totals.depositAsked ? t('developerSales.payments.ofAsked', { amount: money(totals.depositAsked) }) : undefined,
            }]
            : []),
        { key: 'called', label: t('developerSales.payments.called'), value: totals.called },
        { key: 'collected', label: t('developerSales.payments.collected'), value: totals.collected, tone: 'text-emerald-700 dark:text-emerald-400' },
        ...(totals.pending > 0 ? [{ key: 'pending', label: t('developerSales.payments.pending'), value: totals.pending, tone: 'text-amber-700 dark:text-amber-400' }] : []),
        { key: 'outstanding', label: t('developerSales.payments.outstanding'), value: totals.outstanding },
        { key: 'overdue', label: t('developerSales.payments.overdue'), value: totals.overdue, tone: totals.overdue > 0 ? 'text-error' : undefined },
        { key: 'remaining', label: t('developerSales.payments.remainingOnContract'), value: totals.remainingOnContract },
    ];

    return (
        <section className="border border-outline-variant/30 rounded-xl overflow-hidden" aria-label={t('developerSales.payments.panelAria', { buyer: buyerName, unit: ledger.lot.lotNumber })}>
            {/* Who and what */}
            <header className="flex flex-wrap items-start justify-between gap-4 p-5 bg-surface-container-low">
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-on-surface">{buyerName}</h2>
                    <p className="text-sm text-on-surface-variant">
                        <Link href={`/developer/programs/${ledger.lot.program.id}?workspace=${workspaceId}`} className="hover:text-secondary">
                            {ledger.lot.program.name}
                        </Link>
                        {' · '}{ledger.lot.lotNumber}
                        {ledger.lot.building ? ` · ${ledger.lot.building}` : ''}
                        {' · '}
                        {ledger.lot.contractNumber
                            ? t('developerSales.payments.contractNumber', { number: ledger.lot.contractNumber })
                            : t('developerSales.payments.noContract')}
                    </p>
                    {(ledger.buyer?.phone || ledger.buyer?.email) && (
                        <p className="text-xs text-on-surface-variant mt-1">
                            {[ledger.buyer?.phone, ledger.buyer?.email].filter(Boolean).join(' · ')}
                        </p>
                    )}
                </div>
                <button type="button" onClick={onClose} className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label={t('developerSales.payments.close')}>
                    <X className="h-5 w-5" />
                </button>
            </header>

            {/* Totals */}
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-outline-variant/20 border-y border-outline-variant/20">
                {summary.map((s, i) => (
                    // The last tile widens to close the row, so no empty cell shows through.
                    <div key={s.key} className={`px-4 py-3 bg-surface-container-lowest ${i === summary.length - 1 ? LAST_TILE_SPAN[summary.length % 4] : ''} ${i === summary.length - 1 && summary.length % 2 === 1 ? 'col-span-2' : ''}`}>
                        <dt className="text-xs text-on-surface-variant mb-1">{s.label}</dt>
                        <dd className={`text-base font-semibold tabular-nums ${s.tone ?? 'text-on-surface'}`}>
                            {money(s.value)}
                            {s.sub && <span className="block text-xs font-normal text-on-surface-variant">{s.sub}</span>}
                        </dd>
                    </div>
                ))}
            </dl>

            <div className="grid lg:grid-cols-5 gap-0 lg:divide-x divide-outline-variant/20">
                {/* Schedule */}
                <div className="lg:col-span-3 p-5 space-y-3">
                    <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{t('developerSales.payments.schedule')}</h3>
                    {ledger.calls.length === 0 ? (
                        <p className="text-sm text-on-surface-variant py-6 text-center">{t('developerSales.payments.scheduleEmpty')}</p>
                    ) : (
                        <ul className="space-y-2" role="radiogroup" aria-label={t('developerSales.payments.schedule')}>
                            {ledger.calls.map((call) => {
                                const isSelected = call.id === callId;
                                const selectable = call.payable > 0 && rights.canWrite;
                                const share = call.amount > 0 ? Math.min(100, (call.collected / call.amount) * 100) : 0;
                                return (
                                    <li key={call.id}>
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={isSelected}
                                            disabled={!selectable}
                                            onClick={() => setCallId(call.id)}
                                            className={`w-full text-start rounded-lg border px-3 py-2.5 transition-colors ${
                                                isSelected
                                                    ? 'border-secondary bg-secondary/5'
                                                    : 'border-outline-variant/30 hover:border-outline-variant disabled:hover:border-outline-variant/30'
                                            } disabled:cursor-default`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="min-w-0 text-sm">
                                                    <span className="font-medium text-on-surface">{rowTitle(call)}</span>
                                                    <span className="text-on-surface-variant"> · {call.percentage !== null ? `${call.percentage}% · ` : ''}</span>
                                                    <span className="font-mono text-xs text-on-surface-variant">{call.callNumber}</span>
                                                </span>
                                                <Chip tone={CALL_STATUS_TONE[call.status] ?? CALL_STATUS_TONE.draft}>
                                                    {t(CALL_STATUS_LABEL[call.status] ?? CALL_STATUS_LABEL.draft)}
                                                </Chip>
                                            </div>
                                            <div className="mt-2 h-1.5 rounded-full bg-surface-container-high overflow-hidden" aria-hidden="true">
                                                <div className="h-full bg-emerald-500" style={{ width: `${share}%` }} />
                                            </div>
                                            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 text-xs text-on-surface-variant tabular-nums">
                                                <span>{t('developerSales.payments.paidOf', { paid: money(call.collected), amount: money(call.amount) })}</span>
                                                <span>
                                                    {call.dueAt ? t('developerSales.payments.dueOn', { date: formatDate(call.dueAt) }) : ''}
                                                    {call.daysLate > 0 && (
                                                        <span className="text-error"> · {t('developerDashboard.daysOverdue', { days: call.daysLate })}</span>
                                                    )}
                                                </span>
                                            </div>
                                            {call.pending > 0 && (
                                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                                    {t('developerSales.payments.pendingOnCall', { amount: money(call.pending) })}
                                                </p>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Payment form */}
                <div className="lg:col-span-2 p-5 border-t lg:border-t-0 border-outline-variant/20">
                    {!rights.canWrite ? (
                        <p className="text-sm text-on-surface-variant">{t('developerSales.payments.readOnly')}</p>
                    ) : selected && selected.payable > 0 ? (
                        <PaymentForm
                            // A new payable amount (after a part payment) is a fresh form.
                            key={`${selected.id}-${selected.payable}`}
                            workspaceId={workspaceId}
                            lotId={lotId}
                            title={rowTitle(selected)}
                            call={selected}
                            money={money}
                            onRecorded={(next, payment) => {
                                applyLedger(next);
                                if (payment.receiptNumber) {
                                    setLastReceipt({ id: payment.id, number: payment.receiptNumber });
                                    notify(t('developerSales.payments.recorded', { number: payment.receiptNumber }), 'success');
                                } else {
                                    setLastReceipt(null);
                                    notify(t('developerSales.payments.recordedPending'), 'success');
                                }
                            }}
                        />
                    ) : (
                        <p className="text-sm text-on-surface-variant">
                            {ledger.calls.length === 0 ? t('developerSales.payments.scheduleEmpty') : t('developerSales.payments.nothingDue')}
                        </p>
                    )}
                    {lastReceipt && (
                        <a
                            href={receiptUrl(workspaceId, lastReceipt.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-secondary hover:underline"
                        >
                            <FileText className="h-4 w-4" aria-hidden="true" />
                            {t('developerSales.payments.openReceiptNumber', { number: lastReceipt.number })}
                        </a>
                    )}
                </div>
            </div>

            {/* History */}
            <div className="p-5 border-t border-outline-variant/20">
                <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">{t('developerSales.payments.history')}</h3>
                {ledger.payments.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">{t('developerSales.payments.historyEmpty')}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className={tableClass}>
                            <thead>
                                <tr>
                                    <th className={thClass}>{t('developerSales.payments.colDate')}</th>
                                    <th className={thClass}>{t('developerSales.payments.colCall')}</th>
                                    <th className={thClass}>{t('developerSales.payments.colMethod')}</th>
                                    <th className={`${thClass} text-end`}>{t('developerSales.payments.colAmount')}</th>
                                    <th className={thClass}>{t('developerSales.payments.colStatus')}</th>
                                    <th className={thClass}>{t('developerSales.payments.colBy')}</th>
                                    <th className={thClass} />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/15">
                                {ledger.payments.map((p) => {
                                    const statusKey = paymentStatusKey(p);
                                    const dimmed = p.status === 'reversed' || p.status === 'failed';
                                    const refundable = fromCents(toCents(p.amount) - refundedOf(p.id));
                                    return (
                                        <tr key={p.id}>
                                            <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{formatDate(p.paymentDate)}</td>
                                            <td className={`${tdClass} font-mono text-xs`}>{p.receiptNumber ?? p.callNumber}</td>
                                            <td className={tdClass}>
                                                {t(`developerSales.collections.method_${p.paymentMethod}` as MessageKey)}
                                                {p.referenceNumber && <span className="block text-xs text-on-surface-variant">{p.referenceNumber}</span>}
                                            </td>
                                            <td className={`${tdClass} text-end font-semibold tabular-nums ${dimmed ? 'line-through text-on-surface-variant' : ''}`}>
                                                {p.kind === 'refund' ? '−' : ''}{money(p.amount)}
                                            </td>
                                            <td className={tdClass}>
                                                <Chip tone={PAYMENT_STATUS_TONE[statusKey] ?? PAYMENT_STATUS_TONE.reversed}>
                                                    {t(`developerSales.payments.status_${statusKey}` as MessageKey)}
                                                </Chip>
                                                {p.reversalReason && p.kind !== 'refund' && (
                                                    <span className="block text-xs text-on-surface-variant mt-1">{p.reversalReason}</span>
                                                )}
                                            </td>
                                            <td className={`${tdClass} text-xs text-on-surface-variant`}>{p.createdBy?.name ?? '–'}</td>
                                            <td className={`${tdClass} text-end whitespace-nowrap`}>
                                                <div className="inline-flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs font-medium">
                                                    {p.receiptNumber && p.kind === 'payment' && (
                                                        <a href={receiptUrl(workspaceId, p.id)} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">
                                                            {t('developerSales.payments.receipt')}
                                                        </a>
                                                    )}
                                                    {rights.canWrite && p.status === 'pending' && (
                                                        <>
                                                            <button type="button" className="text-secondary hover:underline" onClick={() => setAction({ kind: 'confirm', payment: p })}>
                                                                {t('developerSales.payments.confirm')}
                                                            </button>
                                                            <button type="button" className="text-error hover:underline" onClick={() => setAction({ kind: 'fail', payment: p })}>
                                                                {t('developerSales.payments.fail')}
                                                            </button>
                                                        </>
                                                    )}
                                                    {rights.canModerate && p.status === 'confirmed' && p.kind === 'payment' && (
                                                        <>
                                                            {refundable > 0 && (
                                                                <button type="button" className="text-on-surface-variant hover:text-on-surface hover:underline" onClick={() => setAction({ kind: 'refund', payment: p, refundable })}>
                                                                    {t('developerSales.payments.refund')}
                                                                </button>
                                                            )}
                                                            <button type="button" className="text-error hover:underline" onClick={() => setAction({ kind: 'reverse', payment: p })}>
                                                                {t('developerSales.payments.reverse')}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {action && (
                <PaymentActionDialog
                    workspaceId={workspaceId}
                    action={action}
                    money={money}
                    onClose={() => setAction(null)}
                    onDone={(next, message) => {
                        setAction(null);
                        applyLedger(next);
                        notify(message, 'success');
                    }}
                />
            )}
        </section>
    );
}

// ---------------------------------------------------------------------------

type Submit = { state: 'idle' } | { state: 'saving' } | { state: 'error'; message: string } | { state: 'uncertain' };

function PaymentForm({
    workspaceId, lotId, title, call, money, onRecorded,
}: {
    workspaceId: string;
    lotId: string;
    /** The row's name as shown in the schedule. */
    title: string;
    call: LedgerCall;
    money: (n: number) => string;
    onRecorded: (ledger: Ledger, payment: { id: string; receiptNumber: string | null }) => void;
}) {
    const { t, formatDate } = useI18n();
    const id = useId();
    const today = localToday();
    const payableCents = toCents(call.payable);
    const [amount, setAmount] = useState(call.payable.toFixed(2));
    const [paidAt, setPaidAt] = useState(today);
    const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [submit, setSubmit] = useState<Submit>({ state: 'idle' });
    // One key per payment being entered: every retry of it sends the same key, so
    // the server can tell a retry from a second payment.
    const requestKey = useRef(newRequestKey());

    const rule = METHOD_RULES[method];
    const amountCents = parseAmountCents(amount);
    const amountError = amountCents === null || amountCents <= 0
        ? t('developerSales.payments.amountInvalid')
        : amountCents > payableCents
            ? t('developerSales.payments.amountTooHigh', { amount: money(call.payable) })
            : null;
    const referenceMissing = rule.reference === 'required' && !reference.trim();
    const canSubmit = !amountError && !referenceMissing && submit.state !== 'saving';
    const afterCents = payableCents - (amountCents ?? 0);

    const referenceLabel = method === 'check'
        ? t('developerSales.payments.chequeNumber')
        : method === 'bank_transfer'
            ? t('developerSales.payments.transferReference')
            : t('developerSales.payments.reference');

    const send = async () => {
        if (!canSubmit || amountCents === null) return;
        setSubmit({ state: 'saving' });
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
        try {
            // A deposit is paid on the unit; a call, on itself.
            const url = call.type === 'deposit'
                ? `/api/developer/lots/${lotId}/deposit/payments`
                : `/api/developer/calls-for-funds/${call.id}/payments`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    workspaceId,
                    amount: fromCents(amountCents),
                    paidAt,
                    method,
                    reference: rule.reference === 'none' ? undefined : reference.trim() || undefined,
                    notes: notes.trim() || undefined,
                    clientRequestId: requestKey.current,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.status >= 500) {
                // The server may or may not have saved it; only a retry with the same key can tell.
                setSubmit({ state: 'uncertain' });
                return;
            }
            if (!res.ok) {
                setSubmit({ state: 'error', message: data.error || t('developerSales.payments.actionFailed') });
                return;
            }
            setSubmit({ state: 'idle' });
            requestKey.current = newRequestKey();
            onRecorded(data.ledger, data.payment);
        } catch {
            setSubmit({ state: 'uncertain' });
        } finally {
            clearTimeout(timer);
        }
    };

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="space-y-4"
            aria-describedby={`${id}-recap`}
            noValidate
        >
            <div>
                <h3 className="text-sm font-semibold text-on-surface">{t('developerSales.payments.formTitle')}</h3>
                <p className="text-xs text-on-surface-variant">{t('developerSales.payments.formFor', { call: `${title} · ${call.callNumber}` })}</p>
            </div>

            {submit.state === 'error' && (
                <p role="alert" className="p-3 bg-error-container text-error text-sm rounded">{submit.message}</p>
            )}
            {submit.state === 'uncertain' && (
                <div role="alert" className="p-3 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-sm rounded space-y-2">
                    <p>{t('developerSales.payments.uncertain')}</p>
                    <button type="button" onClick={send} className="font-medium underline">{t('developerSales.payments.retrySubmit')}</button>
                </div>
            )}

            <div>
                <label htmlFor={`${id}-amount`} className="block body-sm text-on-surface-variant mb-2">{t('developerSales.payments.amount')}</label>
                <input
                    id={`${id}-amount`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className={`${inputClass} tabular-nums`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    aria-invalid={Boolean(amountError)}
                    aria-describedby={`${id}-amount-hint`}
                    disabled={submit.state === 'saving'}
                />
                <p id={`${id}-amount-hint`} className={`body-xs mt-1 ${amountError && amount ? 'text-error' : 'text-on-surface-variant'}`}>
                    {amountError && amount ? amountError : t('developerSales.payments.amountHint', { amount: money(call.payable) })}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Field label={t('developerSales.collections.paymentDate')}>
                    <input type="date" required max={today} className={inputClass} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} disabled={submit.state === 'saving'} />
                </Field>
                <Field label={t('developerSales.collections.paymentMethod')}>
                    <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} disabled={submit.state === 'saving'}>
                        {COLLECTION_METHODS.map((m) => (
                            <option key={m} value={m}>{t(`developerSales.collections.method_${m}` as MessageKey)}</option>
                        ))}
                    </select>
                </Field>
            </div>

            {rule.reference !== 'none' && (
                <div>
                    <label htmlFor={`${id}-ref`} className="block body-sm text-on-surface-variant mb-2">
                        {referenceLabel}{rule.reference === 'required' ? ' *' : ''}
                    </label>
                    <input
                        id={`${id}-ref`}
                        type="text"
                        maxLength={100}
                        className={inputClass}
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        aria-required={rule.reference === 'required'}
                        aria-invalid={referenceMissing && reference !== ''}
                        disabled={submit.state === 'saving'}
                    />
                </div>
            )}

            <Field label={t('developerSales.payments.notes')}>
                <input type="text" maxLength={500} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={submit.state === 'saving'} />
            </Field>

            {/* The review step, in place: the effect of this payment, updated as it is typed. */}
            <dl id={`${id}-recap`} className="rounded-lg bg-surface-container-low p-3 text-sm space-y-1 tabular-nums" aria-live="polite">
                <div className="flex justify-between gap-3"><dt className="text-on-surface-variant">{t('developerSales.payments.recapBefore')}</dt><dd>{money(call.payable)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-on-surface-variant">{t('developerSales.payments.recapNow')}</dt><dd className="font-semibold">{amountCents && !amountError ? money(fromCents(amountCents)) : '–'}</dd></div>
                <div className="flex justify-between gap-3 border-t border-outline-variant/30 pt-1"><dt className="text-on-surface-variant">{t('developerSales.payments.recapAfter')}</dt><dd className="font-semibold">{!amountError ? money(fromCents(afterCents)) : '–'}</dd></div>
                <div className="flex justify-between gap-3 text-xs text-on-surface-variant pt-1">
                    <dt className="sr-only">{t('developerSales.collections.paymentMethod')}</dt>
                    <dd>{t(`developerSales.collections.method_${method}` as MessageKey)} · {paidAt ? formatDate(paidAt) : '–'}</dd>
                </div>
                {rule.startsPending && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 pt-1">{t('developerSales.payments.recapPending')}</p>
                )}
            </dl>

            <button type="submit" className={`${primaryButton} w-full inline-flex items-center justify-center gap-2`} disabled={!canSubmit}>
                {submit.state === 'saving' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {submit.state === 'saving'
                    ? t('developerSales.payments.saving')
                    : amountCents && !amountError
                        ? t(rule.startsPending ? 'developerSales.payments.submitCheque' : 'developerSales.payments.submit', { amount: money(fromCents(amountCents)) })
                        : t('developerSales.collections.recordPayment')}
            </button>
        </form>
    );
}

// ---------------------------------------------------------------------------

function PaymentActionDialog({
    workspaceId, action, money, onClose, onDone,
}: {
    workspaceId: string;
    action: Action;
    money: (n: number) => string;
    onClose: () => void;
    onDone: (ledger: Ledger | null, message: string) => void;
}) {
    const { t } = useI18n();
    const p = action.payment;
    const needsReason = action.kind !== 'confirm';
    const [reason, setReason] = useState('');
    const [amount, setAmount] = useState(action.kind === 'refund' ? action.refundable.toFixed(2) : '');
    const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
    const [paidAt, setPaidAt] = useState(localToday());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requestKey = useRef(newRequestKey());

    const refundCents = action.kind === 'refund' ? parseAmountCents(amount) : null;
    const refundError = action.kind === 'refund'
        ? refundCents === null || refundCents <= 0
            ? t('developerSales.payments.amountInvalid')
            : refundCents > toCents(action.refundable)
                ? t('developerSales.payments.amountTooHigh', { amount: money(action.refundable) })
                : null
        : null;

    const copy = useMemo(() => {
        const number = p.receiptNumber ?? p.callNumber;
        switch (action.kind) {
            case 'confirm': return { title: t('developerSales.payments.confirmTitle'), body: t('developerSales.payments.confirmBody', { amount: money(p.amount) }), done: t('developerSales.payments.confirmed') };
            case 'fail': return { title: t('developerSales.payments.failTitle'), body: t('developerSales.payments.failBody', { amount: money(p.amount) }), done: t('developerSales.payments.failed') };
            case 'reverse': return { title: t('developerSales.payments.reverseTitle'), body: t('developerSales.payments.reverseBody', { amount: money(p.amount), number }), done: t('developerSales.payments.reversed') };
            case 'refund': return { title: t('developerSales.payments.refundTitle'), body: t('developerSales.payments.refundBody', { amount: money(action.refundable), number }), done: t('developerSales.payments.refunded') };
        }
    }, [action, money, p, t]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (needsReason && !reason.trim()) { setError(t('developerSales.payments.reasonRequired')); return; }
        if (refundError) { setError(refundError); return; }
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/developer/payments/${p.id}/${action.kind}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId,
                    reason: reason.trim() || undefined,
                    ...(action.kind === 'refund' && {
                        amount: fromCents(refundCents ?? 0),
                        method,
                        paidAt,
                        clientRequestId: requestKey.current,
                    }),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || t('developerSales.payments.actionFailed'));
            onDone(data.ledger ?? null, copy.done);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('developerSales.payments.actionFailed'));
            setSaving(false);
        }
    };

    const destructive = action.kind === 'reverse' || action.kind === 'fail';

    return (
        <Modal title={copy.title} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                {error && <p role="alert" className="p-3 bg-error-container text-error text-sm rounded">{error}</p>}
                <p className="text-sm text-on-surface-variant">{copy.body}</p>
                {action.kind === 'refund' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Field label={t('developerSales.payments.refundAmount')}>
                            <input type="text" inputMode="decimal" className={`${inputClass} tabular-nums`} value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={Boolean(refundError)} />
                        </Field>
                        <Field label={t('developerSales.collections.paymentMethod')}>
                            <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                                {COLLECTION_METHODS.map((m) => (
                                    <option key={m} value={m}>{t(`developerSales.collections.method_${m}` as MessageKey)}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label={t('developerSales.collections.paymentDate')}>
                            <input type="date" max={localToday()} className={inputClass} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                        </Field>
                    </div>
                )}
                {needsReason && (
                    <Field label={`${t('developerSales.payments.reasonLabel')} *`}>
                        <textarea className={inputClass} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} required />
                    </Field>
                )}
                <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={onClose} className={secondaryButton} disabled={saving}>{t('common.cancel')}</button>
                    <button type="submit" className={`${destructive ? dangerButton : primaryButton} inline-flex items-center gap-2`} disabled={saving}>
                        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {t('developerSales.payments.apply')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
