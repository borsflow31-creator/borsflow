'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Receipt } from 'lucide-react';
import { inputClass, secondaryButton } from '@/components/realestate/ui';
import { Chip, tableClass, tdClass, thClass } from '@/components/developer/status';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { COLLECTION_METHODS, PAYMENT_STATUS_TONE, localToday, paymentStatusKey, receiptUrl } from './LotLedgerPanel';

interface JournalRow {
    id: string;
    amount: number;
    kind: string;
    status: string;
    paymentDate: string;
    paymentMethod: string;
    referenceNumber: string | null;
    receiptNumber: string | null;
    createdBy: { id: string; name: string | null } | null;
    call: {
        type: 'deposit' | 'call';
        id: string;
        callNumber: string;
        lot: {
            id: string;
            lotNumber: string;
            program: { id: string; name: string };
            buyerLead: { firstName: string; lastName: string | null } | null;
        };
    } | null;
}

interface Journal {
    payments: JournalRow[];
    truncated: boolean;
    totals: { confirmed: number; pending: number; byMethod: Record<string, number> };
}

const STATUSES = ['confirmed', 'pending', 'failed', 'reversed', 'refund'] as const;

function monthStart(): string {
    const today = localToday();
    return `${today.slice(0, 8)}01`;
}

/**
 * Every payment taken on calls for funds, for the daily cash-up and for finding
 * one transaction again. Totals count confirmed money only; pending cheques are
 * shown apart, and failed or cancelled rows count for nothing.
 */
export default function PaymentJournal({
    workspaceId, currency, programs, onOpenLot,
}: {
    workspaceId: string;
    currency: string;
    programs: { id: string; name: string }[];
    onOpenLot: (lotId: string) => void;
}) {
    const { t, formatNumber, formatDate } = useI18n();
    const money = (n: number) => formatNumber(n, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const [from, setFrom] = useState(monthStart());
    const [to, setTo] = useState(localToday());
    const [method, setMethod] = useState('');
    const [status, setStatus] = useState('');
    const [programId, setProgramId] = useState('');
    const [q, setQ] = useState('');
    const [journal, setJournal] = useState<Journal | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

    const load = useCallback(async (signal?: AbortSignal) => {
        setState('loading');
        const params = new URLSearchParams({ workspaceId });
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (method) params.set('method', method);
        if (status) params.set('status', status);
        if (programId) params.set('programId', programId);
        if (q.trim()) params.set('q', q.trim());
        try {
            const res = await fetch(`/api/developer/payments?${params}`, { signal });
            if (!res.ok) throw new Error(String(res.status));
            setJournal(await res.json());
            setState('ready');
        } catch (e) {
            if ((e as { name?: string }).name !== 'AbortError') setState('error');
        }
    }, [workspaceId, from, to, method, status, programId, q]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => load(controller.signal), q ? 300 : 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [load, q]);

    const todayOnly = () => { const d = localToday(); setFrom(d); setTo(d); };
    const thisMonth = () => { setFrom(monthStart()); setTo(localToday()); };

    const filterClass = `${inputClass} !py-2`;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                <label className="block">
                    <span className="block body-xs text-on-surface-variant mb-1">{t('developerSales.payments.from')}</span>
                    <input type="date" className={filterClass} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                </label>
                <label className="block">
                    <span className="block body-xs text-on-surface-variant mb-1">{t('developerSales.payments.to')}</span>
                    <input type="date" className={filterClass} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
                </label>
                <label className="block">
                    <span className="block body-xs text-on-surface-variant mb-1">{t('developerSales.collections.paymentMethod')}</span>
                    <select className={filterClass} value={method} onChange={(e) => setMethod(e.target.value)}>
                        <option value="">{t('developerSales.payments.allMethods')}</option>
                        {COLLECTION_METHODS.map((m) => (
                            <option key={m} value={m}>{t(`developerSales.collections.method_${m}` as MessageKey)}</option>
                        ))}
                    </select>
                </label>
                <label className="block">
                    <span className="block body-xs text-on-surface-variant mb-1">{t('developerSales.payments.colStatus')}</span>
                    <select className={filterClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="">{t('developerSales.payments.allStatuses')}</option>
                        {STATUSES.map((s) => (
                            <option key={s} value={s}>{t(`developerSales.payments.status_${s}` as MessageKey)}</option>
                        ))}
                    </select>
                </label>
                <label className="block">
                    <span className="block body-xs text-on-surface-variant mb-1">{t('developerSales.payments.program')}</span>
                    <select className={filterClass} value={programId} onChange={(e) => setProgramId(e.target.value)}>
                        <option value="">{t('developerSales.payments.allPrograms')}</option>
                        {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </label>
                <label className="block">
                    <span className="block body-xs text-on-surface-variant mb-1">{t('developerSales.payments.search')}</span>
                    <input type="search" className={filterClass} value={q} maxLength={60} placeholder={t('developerSales.payments.searchJournalPlaceholder')} onChange={(e) => setQ(e.target.value)} />
                </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-container-high text-on-surface-variant hover:text-on-surface" onClick={todayOnly}>
                    {t('developerSales.payments.today')}
                </button>
                <button type="button" className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-container-high text-on-surface-variant hover:text-on-surface" onClick={thisMonth}>
                    {t('developerSales.payments.thisMonth')}
                </button>
            </div>

            {journal && (
                <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-outline-variant/20 border border-outline-variant/20 rounded-xl overflow-hidden">
                    <div className="p-4 bg-surface-container-lowest">
                        <dt className="text-xs text-on-surface-variant mb-1">{t('developerSales.payments.totalConfirmed')}</dt>
                        <dd className="text-xl font-semibold tabular-nums text-on-surface">{money(journal.totals.confirmed)}</dd>
                    </div>
                    <div className="p-4 bg-surface-container-lowest">
                        <dt className="text-xs text-on-surface-variant mb-1">{t('developerSales.payments.totalPending')}</dt>
                        <dd className="text-xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">{money(journal.totals.pending)}</dd>
                    </div>
                    <div className="col-span-2 p-4 bg-surface-container-lowest">
                        <dt className="text-xs text-on-surface-variant mb-1">{t('developerSales.payments.byMethod')}</dt>
                        <dd className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-on-surface">
                            {Object.keys(journal.totals.byMethod).length === 0
                                ? '–'
                                : Object.entries(journal.totals.byMethod).map(([m, v]) => (
                                    <span key={m}>
                                        <span className="text-on-surface-variant">{t(`developerSales.collections.method_${m}` as MessageKey)}</span> {money(v)}
                                    </span>
                                ))}
                        </dd>
                    </div>
                </dl>
            )}

            {state === 'error' ? (
                <div className="p-6 border border-outline-variant/30 rounded-xl flex items-center justify-between gap-4" role="alert">
                    <p className="text-sm text-error">{t('developer.loadFailed')}</p>
                    <button type="button" className={secondaryButton} onClick={() => load()}>{t('developerSales.payments.retry')}</button>
                </div>
            ) : state === 'loading' && !journal ? (
                <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" /></div>
            ) : journal && journal.payments.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-outline-variant/40 rounded-xl">
                    <Receipt className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-3" />
                    <p className="text-sm text-on-surface-variant">{t('developerSales.payments.journalEmpty')}</p>
                </div>
            ) : journal ? (
                <div className={`overflow-x-auto border border-outline-variant/20 rounded-xl ${state === 'loading' ? 'opacity-60' : ''}`} aria-busy={state === 'loading'}>
                    <table className={tableClass}>
                        <thead className="bg-surface-container-low">
                            <tr>
                                <th className={thClass}>{t('developerSales.payments.colDate')}</th>
                                <th className={thClass}>{t('developerSales.payments.colReceipt')}</th>
                                <th className={thClass}>{t('developer.colBuyer')}</th>
                                <th className={thClass}>{t('developer.colProjectUnit')}</th>
                                <th className={thClass}>{t('developerSales.payments.colMethod')}</th>
                                <th className={`${thClass} text-end`}>{t('developerSales.payments.colAmount')}</th>
                                <th className={thClass}>{t('developerSales.payments.colStatus')}</th>
                                <th className={thClass}>{t('developerSales.payments.colBy')}</th>
                                <th className={thClass} />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/15">
                            {journal.payments.map((p) => {
                                const key = paymentStatusKey(p);
                                const dimmed = p.status === 'reversed' || p.status === 'failed';
                                const buyer = p.call?.lot.buyerLead;
                                return (
                                    <tr key={p.id} className="hover:bg-surface-container-low/60 transition-colors">
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{formatDate(p.paymentDate)}</td>
                                        <td className={`${tdClass} font-mono text-xs`}>
                                            {p.receiptNumber ?? '–'}
                                            {p.call && (
                                                <span className="block text-on-surface-variant">
                                                    {p.call.type === 'deposit' ? `${t('developerSales.payments.depositRow')} · ` : ''}{p.call.callNumber}
                                                </span>
                                            )}
                                        </td>
                                        <td className={tdClass}>{buyer ? `${buyer.firstName} ${buyer.lastName ?? ''}`.trim() : '–'}</td>
                                        <td className={tdClass}>
                                            {p.call ? (
                                                <button type="button" className="text-on-surface hover:text-secondary text-start" onClick={() => onOpenLot(p.call!.lot.id)}>
                                                    {p.call.lot.program.name} · {p.call.lot.lotNumber}
                                                </button>
                                            ) : '–'}
                                        </td>
                                        <td className={tdClass}>
                                            {t(`developerSales.collections.method_${p.paymentMethod}` as MessageKey)}
                                            {p.referenceNumber && <span className="block text-xs text-on-surface-variant">{p.referenceNumber}</span>}
                                        </td>
                                        <td className={`${tdClass} text-end font-semibold tabular-nums ${dimmed ? 'line-through text-on-surface-variant' : ''}`}>
                                            {p.kind === 'refund' ? '−' : ''}{money(p.amount)}
                                        </td>
                                        <td className={tdClass}>
                                            <Chip tone={PAYMENT_STATUS_TONE[key] ?? PAYMENT_STATUS_TONE.reversed}>
                                                {t(`developerSales.payments.status_${key}` as MessageKey)}
                                            </Chip>
                                        </td>
                                        <td className={`${tdClass} text-xs text-on-surface-variant`}>{p.createdBy?.name ?? '–'}</td>
                                        <td className={`${tdClass} text-end`}>
                                            {p.receiptNumber && p.kind === 'payment' && (
                                                <a href={receiptUrl(workspaceId, p.id)} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-secondary hover:underline">
                                                    {t('developerSales.payments.receipt')}
                                                </a>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {journal.truncated && (
                        <p className="px-4 py-3 text-xs text-on-surface-variant border-t border-outline-variant/20">{t('developerSales.payments.truncated')}</p>
                    )}
                </div>
            ) : null}
        </div>
    );
}
