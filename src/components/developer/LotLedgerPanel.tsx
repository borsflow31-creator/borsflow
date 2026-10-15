'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, FileText, Loader2, MoreHorizontal, Printer, X } from 'lucide-react';
import { Modal, Field, inputClass, primaryButton, secondaryButton, dangerButton } from '@/components/realestate/ui';
import { Chip, tableClass, tdClass, thClass } from '@/components/developer/status';
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

/**
 * Payment statuses read as plain text: only what went wrong (a bounced cheque, a
 * cancelled payment) stands out, and a cheque still clearing is set on a grey wash.
 */
export const PAYMENT_STATUS_TONE: Record<string, string> = {
    pending: 'bg-surface-container-high text-on-surface',
    confirmed: '!px-0 text-on-surface-variant',
    failed: '!px-0 text-error',
    reversed: '!px-0 text-error',
    refund: '!px-0 text-on-surface-variant',
};

export function paymentStatusKey(p: { kind: string; status: string }): string {
    if (p.kind === 'refund' && p.status === 'confirmed') return 'refund';
    return p.status;
}

export function receiptUrl(workspaceId: string, paymentId: string): string {
    return `/api/developer/payments/${paymentId}/receipt?workspaceId=${encodeURIComponent(workspaceId)}`;
}

type Action =
    | { kind: 'confirm' | 'fail' | 'reverse'; payment: LedgerPayment }
    | { kind: 'refund'; payment: LedgerPayment; refundable: number };

/** What was just recorded, shown in place of the form until the next payment. */
type Recorded = { id: string; receiptNumber: string | null; amount: number };

/**
 * Collecting from one sold unit, on one screen: three figures for where the buyer
 * stands, the schedule with a Collect button on what is still due, a short payment
 * form beside it, the receipt to print once it is saved, and the payments so far.
 */
export default function LotLedgerPanel({
    workspaceId, lotId, initialCallId, currency, hideBuyer, onBuyer, onClose, onChanged, notify,
}: {
    workspaceId: string;
    lotId: string;
    initialCallId?: string | null;
    currency: string;
    /** The buyer is already shown above (the client panel): name only the unit. */
    hideBuyer?: boolean;
    /** Told who the buyer is once the unit is loaded, so the page can open them. */
    onBuyer?: (buyerId: string) => void;
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
    const [recorded, setRecorded] = useState<Recorded | null>(null);

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

    useEffect(() => { setLedger(null); setRecorded(null); load(); }, [load]);

    // Reported once per buyer: the caller passes a fresh function on every render.
    const buyerId = ledger?.buyer?.id;
    const reportedBuyer = useRef<string | null>(null);
    useEffect(() => {
        if (!buyerId || !onBuyer || reportedBuyer.current === buyerId) return;
        reportedBuyer.current = buyerId;
        onBuyer(buyerId);
    }, [buyerId, onBuyer]);

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
            <section className="p-6 flex items-center justify-between gap-4" role="alert">
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
            <section className="p-10 flex justify-center" role="status" aria-label={t('developerSales.payments.loading')}>
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

    const unitLine = (
        <>
            <Link href={`/developer/programs/${ledger.lot.program.id}?workspace=${workspaceId}`} className="hover:underline">
                {ledger.lot.program.name}
            </Link>
            {' · '}{ledger.lot.lotNumber}
            {ledger.lot.building ? ` · ${ledger.lot.building}` : ''}
            {' · '}
            {ledger.lot.contractNumber
                ? t('developerSales.payments.contractNumber', { number: ledger.lot.contractNumber })
                : t('developerSales.payments.noContract')}
        </>
    );

    // What else the buyer should know, in one sentence each, only when it applies.
    const notes = [
        totals.overdue > 0 && { text: t('developerSales.payments.ofWhichOverdue', { amount: money(totals.overdue) }), late: true },
        totals.depositAsked > 0 && totals.deposit < totals.depositAsked && {
            text: t('developerSales.payments.depositLine', { paid: money(totals.deposit), asked: money(totals.depositAsked) }),
            late: false,
        },
        totals.pending > 0 && { text: t('developerSales.payments.pendingOnCall', { amount: money(totals.pending) }), late: false },
    ].filter(Boolean) as { text: string; late: boolean }[];

    const canCollect = (call: LedgerCall) => call.payable > 0 && rights.canWrite;

    return (
        <section aria-label={t('developerSales.payments.panelAria', { buyer: buyerName, unit: ledger.lot.lotNumber })}>
            {/* Who and what */}
            {hideBuyer ? (
                <p className="px-5 pt-4 text-sm text-on-surface-variant">{unitLine}</p>
            ) : (
                <header className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5">
                    <div className="min-w-0">
                        <h2 className="text-xl font-semibold text-on-surface">{buyerName}</h2>
                        <p className="text-sm text-on-surface-variant">{unitLine}</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high" aria-label={t('developerSales.payments.close')}>
                        <X className="h-5 w-5" />
                    </button>
                </header>
            )}

            {/* Where the buyer stands, in three figures */}
            <div className="px-5 pt-4 pb-5">
                {/* What is owed now leads; the rest of the price is not called yet. */}
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { key: 'contract', label: t('developerSales.payments.contract'), value: totals.contract },
                        { key: 'collected', label: t('developerSales.payments.collected'), value: totals.collected },
                        { key: 'due', label: t('developerSales.payments.outstanding'), value: totals.outstanding },
                        { key: 'remaining', label: t('developerSales.payments.remainingOnContract'), value: totals.remainingOnContract },
                    ].map((s) => (
                        <div key={s.key}>
                            <dt className={`text-xs ${s.key === 'due' ? 'text-on-surface font-medium' : 'text-on-surface-variant'}`}>{s.label}</dt>
                            <dd className={`tabular-nums ${s.key === 'due' ? 'text-xl font-semibold text-on-surface' : 'text-lg text-on-surface-variant'}`}>{money(s.value)}</dd>
                        </div>
                    ))}
                </dl>
                {notes.length > 0 && (
                    <p className="mt-2 text-sm">
                        {notes.map((n, i) => (
                            <span key={i} className={n.late ? 'text-error' : 'text-on-surface-variant'}>{i > 0 ? ' ' : ''}{n.text}</span>
                        ))}
                    </p>
                )}
            </div>

            <div className="grid lg:grid-cols-5 border-t border-outline-variant/20 lg:divide-x divide-outline-variant/20">
                {/* Schedule */}
                <div className="lg:col-span-3 p-5">
                    <h3 className="text-sm font-semibold text-on-surface mb-2">{t('developerSales.payments.schedule')}</h3>
                    {ledger.calls.length === 0 ? (
                        <p className="text-sm text-on-surface-variant py-6 text-center">{t('developerSales.payments.scheduleEmpty')}</p>
                    ) : (
                        <ul className="divide-y divide-outline-variant/20">
                            {ledger.calls.map((call) => {
                                const isSelected = call.id === callId && canCollect(call) && !recorded;
                                const paid = call.payable <= 0 && call.pending <= 0;
                                return (
                                    <li
                                        key={call.id}
                                        className={`flex items-center justify-between gap-3 py-3 ps-3 -ms-3 border-s-2 ${isSelected ? 'border-on-surface' : 'border-transparent'}`}
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm text-on-surface">
                                                <span className="font-medium">{rowTitle(call)}</span>
                                                {call.percentage !== null && <span className="text-on-surface-variant"> · {call.percentage}%</span>}
                                            </p>
                                            <p className="text-xs text-on-surface-variant tabular-nums">
                                                {call.dueAt ? t('developerSales.payments.dueOn', { date: formatDate(call.dueAt) }) : call.callNumber}
                                                {call.daysLate > 0 && call.payable > 0 && (
                                                    <span className="text-error"> · {t('developerDashboard.daysOverdue', { days: call.daysLate })}</span>
                                                )}
                                                {call.pending > 0 && <span> · {t('developerSales.payments.pendingOnCall', { amount: money(call.pending) })}</span>}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0">
                                            <span className="text-end text-sm tabular-nums">
                                                <span className="block text-on-surface">{money(call.amount)}</span>
                                                <span className="block text-xs text-on-surface-variant">
                                                    {paid
                                                        ? t('developerSales.payments.paidLabel')
                                                        : t('developerSales.payments.paidOf', { paid: money(call.collected), amount: money(call.amount) })}
                                                </span>
                                            </span>
                                            {canCollect(call) ? (
                                                <button
                                                    type="button"
                                                    onClick={() => { setCallId(call.id); setRecorded(null); }}
                                                    aria-pressed={isSelected}
                                                    className={`${isSelected ? primaryButton : secondaryButton} !px-3 !py-1.5 text-xs w-24`}
                                                >
                                                    {t('developerSales.payments.collect')}
                                                </button>
                                            ) : (
                                                <span className="w-24" aria-hidden="true" />
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Payment form, or the receipt of the payment just recorded */}
                <div className="lg:col-span-2 p-5 border-t lg:border-t-0 border-outline-variant/20">
                    {recorded ? (
                        <div className="space-y-4" role="status">
                            <div>
                                <p className="text-base font-semibold text-on-surface">
                                    {t(recorded.receiptNumber ? 'developerSales.payments.recordedTitle' : 'developerSales.payments.recordedPendingTitle', { amount: money(recorded.amount) })}
                                </p>
                                {recorded.receiptNumber
                                    ? <p className="text-sm text-on-surface-variant">{t('developerSales.payments.receiptNumber', { number: recorded.receiptNumber })}</p>
                                    : <p className="text-sm text-on-surface-variant">{t('developerSales.payments.recordedPending')}</p>}
                            </div>
                            {recorded.receiptNumber && (
                                <a
                                    href={receiptUrl(workspaceId, recorded.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`${primaryButton} w-full inline-flex items-center justify-center gap-2 !py-3`}
                                >
                                    <Printer className="h-4 w-4" aria-hidden="true" />
                                    {t('developerSales.payments.printReceipt')}
                                </a>
                            )}
                            {ledger.calls.some(canCollect) && (
                                <button type="button" onClick={() => setRecorded(null)} className={`${secondaryButton} w-full`}>
                                    {t('developerSales.payments.newPayment')}
                                </button>
                            )}
                        </div>
                    ) : !rights.canWrite ? (
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
                            onRecorded={(next, payment, amount) => {
                                applyLedger(next);
                                setRecorded({ id: payment.id, receiptNumber: payment.receiptNumber, amount });
                                notify(
                                    payment.receiptNumber
                                        ? t('developerSales.payments.recorded', { number: payment.receiptNumber })
                                        : t('developerSales.payments.recordedPending'),
                                    'success'
                                );
                            }}
                        />
                    ) : (
                        <p className="text-sm text-on-surface-variant">
                            {ledger.calls.length === 0 ? t('developerSales.payments.scheduleEmpty') : t('developerSales.payments.nothingDue')}
                        </p>
                    )}
                </div>
            </div>

            {/* History */}
            <div className="p-5 border-t border-outline-variant/20">
                <h3 className="text-sm font-semibold text-on-surface mb-2">{t('developerSales.payments.history')}</h3>
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
                                    <th className={thClass}><span className="sr-only">{t('developerSales.payments.actions')}</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/15">
                                {ledger.payments.map((p) => {
                                    const statusKey = paymentStatusKey(p);
                                    const dimmed = p.status === 'reversed' || p.status === 'failed';
                                    const refundable = fromCents(toCents(p.amount) - refundedOf(p.id));
                                    const menu: { label: string; danger?: boolean; run: () => void }[] = [
                                        ...(rights.canWrite && p.status === 'pending'
                                            ? [
                                                { label: t('developerSales.payments.confirm'), run: () => setAction({ kind: 'confirm', payment: p }) },
                                                { label: t('developerSales.payments.fail'), danger: true, run: () => setAction({ kind: 'fail', payment: p }) },
                                            ]
                                            : []),
                                        ...(rights.canModerate && p.status === 'confirmed' && p.kind === 'payment'
                                            ? [
                                                ...(refundable > 0 ? [{ label: t('developerSales.payments.refund'), run: () => setAction({ kind: 'refund', payment: p, refundable }) }] : []),
                                                { label: t('developerSales.payments.reverse'), danger: true, run: () => setAction({ kind: 'reverse', payment: p }) },
                                            ]
                                            : []),
                                    ];
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
                                                <div className="inline-flex items-center justify-end gap-2">
                                                    {p.receiptNumber && p.kind === 'payment' && (
                                                        <a
                                                            href={receiptUrl(workspaceId, p.id)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs font-medium text-on-surface hover:underline"
                                                        >
                                                            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                                                            {t('developerSales.payments.receipt')}
                                                        </a>
                                                    )}
                                                    {menu.length > 0 && <RowMenu label={t('developerSales.payments.actions')} items={menu} />}
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

/** The rare actions on a payment (cleared, bounced, refund, cancel), out of the way behind one button. */
function RowMenu({ label, items }: { label: string; items: { label: string; danger?: boolean; run: () => void }[] }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const id = useId();

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={`${id}-menu`}
                aria-label={label}
                onClick={() => setOpen((v) => !v)}
                className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            >
                <MoreHorizontal className="h-4 w-4" />
            </button>
            {open && (
                <ul id={`${id}-menu`} role="menu" className="absolute end-0 z-20 mt-1 min-w-[10rem] rounded-lg border border-outline-variant bg-surface-container py-1 shadow-lg text-start">
                    {items.map((item) => (
                        <li key={item.label} role="none">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => { setOpen(false); item.run(); }}
                                className={`w-full px-3 py-2 text-start text-sm hover:bg-surface-container-high ${item.danger ? 'text-error' : 'text-on-surface'}`}
                            >
                                {item.label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
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
    onRecorded: (ledger: Ledger, payment: { id: string; receiptNumber: string | null }, amount: number) => void;
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
    const [moreOpen, setMoreOpen] = useState(false);
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
    const saving = submit.state === 'saving';

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
            onRecorded(data.ledger, data.payment, fromCents(amountCents));
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
            aria-describedby={`${id}-after`}
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
                <div role="alert" className="p-3 border border-outline-variant text-on-surface text-sm rounded space-y-2">
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
                    className={`${inputClass} tabular-nums !text-lg !py-2.5 font-semibold`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    aria-invalid={Boolean(amountError)}
                    aria-describedby={`${id}-amount-hint`}
                    disabled={saving}
                />
                <p id={`${id}-amount-hint`} className={`body-xs mt-1 ${amountError && amount ? 'text-error' : 'text-on-surface-variant'}`}>
                    {amountError && amount ? amountError : t('developerSales.payments.amountHint', { amount: money(call.payable) })}
                </p>
            </div>

            <fieldset>
                <legend className="block body-sm text-on-surface-variant mb-2">{t('developerSales.collections.paymentMethod')}</legend>
                <div className="flex flex-wrap gap-1.5">
                    {COLLECTION_METHODS.map((m) => (
                        <button
                            key={m}
                            type="button"
                            aria-pressed={method === m}
                            onClick={() => setMethod(m)}
                            disabled={saving}
                            className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                                method === m
                                    ? 'border-on-surface bg-on-surface text-surface'
                                    : 'border-outline-variant/50 text-on-surface hover:border-outline-variant'
                            }`}
                        >
                            {t(`developerSales.collections.method_${m}` as MessageKey)}
                        </button>
                    ))}
                </div>
            </fieldset>

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
                        disabled={saving}
                    />
                </div>
            )}

            <div>
                <button
                    type="button"
                    onClick={() => setMoreOpen((v) => !v)}
                    aria-expanded={moreOpen}
                    aria-controls={`${id}-more`}
                    className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface"
                >
                    <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    {t('developerSales.payments.moreOptions')}
                    {!moreOpen && paidAt !== today && <span className="tabular-nums"> · {formatDate(paidAt)}</span>}
                </button>
                {moreOpen && (
                    <div id={`${id}-more`} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <Field label={t('developerSales.collections.paymentDate')}>
                            <input type="date" required max={today} className={inputClass} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} disabled={saving} />
                        </Field>
                        <Field label={t('developerSales.payments.notes')}>
                            <input type="text" maxLength={500} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
                        </Field>
                    </div>
                )}
            </div>

            <div className="space-y-2 pt-1">
                <p id={`${id}-after`} className="text-sm text-on-surface-variant tabular-nums" aria-live="polite">
                    {t('developerSales.payments.afterThisPayment', { amount: !amountError ? money(fromCents(afterCents)) : '–' })}
                </p>
                {rule.startsPending && (
                    <p className="text-xs text-on-surface-variant">{t('developerSales.payments.recapPending')}</p>
                )}
                <button type="submit" className={`${primaryButton} w-full inline-flex items-center justify-center gap-2 !py-3`} disabled={!canSubmit}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {saving
                        ? t('developerSales.payments.saving')
                        : amountCents && !amountError
                            ? t(rule.startsPending ? 'developerSales.payments.submitCheque' : 'developerSales.payments.submit', { amount: money(fromCents(amountCents)) })
                            : t('developerSales.collections.recordPayment')}
                </button>
            </div>
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
