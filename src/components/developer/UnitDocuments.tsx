'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, FileText, Loader2, Lock, Send } from 'lucide-react';
import { Chip } from '@/components/developer/status';
import { useWorkspaceCurrency } from '@/components/developer/useWorkspaceCurrency';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { SALE_STAGES, saleStage } from '@/lib/crm/sale-stage';

interface DocRow {
    id: string;
    visibility?: 'team' | 'managers';
    kind: 'reservation' | 'contract';
    number: string;
    status: 'draft' | 'sent' | 'accepted' | 'void';
    title: string;
    sentAt: string | null;
    acceptedAt: string | null;
    acceptedName: string | null;
}

const STATUS_TONE: Record<string, string> = {
    draft: 'bg-surface-container-high text-on-surface-variant',
    sent: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    accepted: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    void: 'bg-surface-container-high text-on-surface-variant line-through',
};

/**
 * A sold unit's paperwork in one place: where the sale is, the deposit, and the
 * reservation form and contract with what has been done to each.
 *
 * The stage comes from the unit, its documents and its calls (lib/crm/sale-stage),
 * not from a stored field, so it can only ever agree with them.
 */
export default function UnitDocuments({
    workspaceId, lot, onChanged,
}: {
    workspaceId: string;
    /** The unit as the drawer holds it: status, deposit, and its calls for funds. */
    lot: any;
    onChanged: () => void;
}) {
    const { t, formatNumber, formatDate } = useI18n();
    const currency = useWorkspaceCurrency(workspaceId);
    const [docs, setDocs] = useState<DocRow[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);
    const [depositOpen, setDepositOpen] = useState(false);
    // Owners and admins see managers-only documents and can change who sees each.
    const [canManage, setCanManage] = useState(false);
    const [fee, setFee] = useState(lot.reservationFee ? String(lot.reservationFee) : '');
    const [paidOn, setPaidOn] = useState(lot.reservationFeePaidAt ? String(lot.reservationFeePaidAt).slice(0, 10) : '');

    const money = (n: number) => formatNumber(n, { style: 'currency', currency, maximumFractionDigits: 0 });

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/developer/lots/${lot.id}/documents?workspaceId=${workspaceId}`);
            if (res.ok) {
                const data = await res.json();
                setDocs(data.documents ?? []);
                setCanManage(!!data.canManage);
            }
        } catch {
            /* the panel degrades to empty */
        }
    }, [lot.id, workspaceId]);

    useEffect(() => { load(); }, [load]);

    const live = docs.filter((d) => d.status !== 'void');
    const stage = saleStage({ status: lot.status, documents: live, calls: lot.callsForFunds ?? [] });
    const accepted = (kind: string) => live.find((d) => d.kind === kind && d.status === 'accepted');

    const call = async (key: string, url: string, body: Record<string, unknown>, okText?: string) => {
        setBusy(key);
        setNotice(null);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId, ...body }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setNotice({ tone: 'error', text: data.error || t('developerSales.docs.failed') });
                return null;
            }
            if (okText) setNotice({ tone: 'ok', text: okText });
            return data;
        } catch {
            setNotice({ tone: 'error', text: t('developerSales.docs.failed') });
            return null;
        } finally {
            setBusy(null);
        }
    };

    const issue = async (kind: 'reservation' | 'contract') => {
        const data = await call(`issue-${kind}`, `/api/developer/lots/${lot.id}/documents`, { kind });
        if (!data) return;
        const warnings: string[] = data.warnings ?? [];
        if (warnings.length > 0) {
            setNotice({ tone: 'warn', text: t('developerSales.docs.missingFields', { fields: warnings.join(', ') }) });
        } else if (data.templateSource === 'default') {
            setNotice({ tone: 'warn', text: t('developerSales.docs.defaultTemplate') });
        }
        await load();
    };

    const send = async (id: string) => {
        const data = await call(`send-${id}`, `/api/developer/documents/${id}/send`, {}, t('developerSales.docs.sentOk'));
        if (data) await load();
    };

    const voidDoc = async (id: string) => {
        const data = await call(`void-${id}`, `/api/developer/documents/${id}/void`, {});
        if (data) await load();
    };

    const setVisibility = async (id: string, visibility: 'team' | 'managers') => {
        const data = await call(`visibility-${id}`, `/api/developer/documents/${id}/visibility`, { visibility });
        if (data) await load();
    };

    const saveDeposit = async () => {
        setBusy('deposit');
        setNotice(null);
        try {
            const res = await fetch(`/api/developer/lots/${lot.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId,
                    reservationFee: fee.trim() === '' ? null : Number(fee),
                    reservationFeePaidAt: paidOn || null,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setNotice({ tone: 'error', text: data.error || t('developerSales.docs.failed') });
                return;
            }
            setDepositOpen(false);
            onChanged();
        } finally {
            setBusy(null);
        }
    };

    if (!stage) return null;
    const stageIndex = SALE_STAGES.indexOf(stage);

    return (
        <section className="space-y-4">
            {/* Where the sale is */}
            <ol className="flex flex-wrap gap-x-1 gap-y-2" aria-label={t('developerSales.stage.title')}>
                {SALE_STAGES.map((s, i) => {
                    const done = i < stageIndex;
                    const current = i === stageIndex;
                    return (
                        <li key={s} className="flex items-center gap-1" aria-current={current ? 'step' : undefined}>
                            <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium ${
                                    current
                                        ? 'bg-secondary text-on-secondary'
                                        : done
                                            ? 'bg-secondary/10 text-secondary'
                                            : 'bg-surface-container-high text-on-surface-variant'
                                }`}
                            >
                                {done && <Check className="h-3 w-3" aria-hidden />}
                                {t(`developerSales.stage.${s}` as MessageKey)}
                            </span>
                            {i < SALE_STAGES.length - 1 && <span className="text-on-surface-variant/40" aria-hidden>›</span>}
                        </li>
                    );
                })}
            </ol>

            {/* Deposit */}
            <div className="text-sm">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-on-surface-variant">{t('developerSales.docs.deposit')}</span>
                    <span className="font-medium text-on-surface tabular-nums">
                        {lot.reservationFee ? money(lot.reservationFee) : '–'}
                        {lot.reservationFee ? (
                            <span className={`ml-2 text-xs ${lot.reservationFeePaidAt ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                                {lot.reservationFeePaidAt
                                    ? t('developerSales.docs.depositReceived', { date: formatDate(lot.reservationFeePaidAt) })
                                    : t('developerSales.docs.depositPending')}
                            </span>
                        ) : null}
                    </span>
                </div>
                {!depositOpen ? (
                    <button type="button" onClick={() => setDepositOpen(true)} className="mt-1 text-xs font-medium text-secondary hover:underline">
                        {t('developerSales.docs.editDeposit')}
                    </button>
                ) : (
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                        <label className="text-xs text-on-surface-variant">
                            {t('developerSales.reserve.fee')}
                            <input type="number" min={0} step={100} value={fee} onChange={(e) => setFee(e.target.value)} className="premium-input mt-1 block w-32 px-2 py-1.5 text-sm" />
                        </label>
                        <label className="text-xs text-on-surface-variant">
                            {t('developerSales.reserve.feeReceivedOn')}
                            <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="premium-input mt-1 block px-2 py-1.5 text-sm" />
                        </label>
                        <button type="button" onClick={saveDeposit} disabled={busy === 'deposit'} className="px-3 py-1.5 rounded bg-primary text-on-primary text-xs disabled:opacity-50">
                            {busy === 'deposit' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('developerCrm.tasks.save')}
                        </button>
                        <button type="button" onClick={() => setDepositOpen(false)} className="px-3 py-1.5 rounded bg-surface-container-high text-on-surface text-xs">
                            {t('common.cancel')}
                        </button>
                    </div>
                )}
            </div>

            {/* Documents */}
            <div>
                <div className="flex flex-wrap gap-2 mb-3">
                    {(['reservation', 'contract'] as const).map((kind) => (
                        <button
                            key={kind}
                            type="button"
                            onClick={() => issue(kind)}
                            disabled={!!accepted(kind) || busy === `issue-${kind}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {busy === `issue-${kind}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                            {t(kind === 'reservation' ? 'developerSales.docs.generateReservation' : 'developerSales.docs.generateContract')}
                        </button>
                    ))}
                </div>

                {notice && (
                    <p
                        role={notice.tone === 'error' ? 'alert' : 'status'}
                        className={`mb-3 text-xs ${notice.tone === 'error' ? 'text-error' : notice.tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}
                    >
                        {notice.text}
                    </p>
                )}

                {live.length === 0 ? (
                    <p className="text-xs text-on-surface-variant/70">{t('developerSales.docs.none')}</p>
                ) : (
                    <ul className="space-y-2">
                        {live.map((d) => (
                            <li key={d.id} className="border border-outline-variant/20 rounded-lg p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <a
                                        href={`/api/developer/documents/${d.id}/pdf?workspaceId=${workspaceId}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm font-medium text-on-surface hover:text-secondary transition-colors"
                                    >
                                        {d.number}
                                    </a>
                                    <span className="flex items-center gap-1.5">
                                        {d.visibility === 'managers' && (
                                            <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-label={t('developerAlerts.access.managers')} />
                                        )}
                                        <Chip tone={STATUS_TONE[d.status]}>{t(`developerSales.docs.status_${d.status}` as MessageKey)}</Chip>
                                    </span>
                                </div>
                                {canManage && (
                                    <label className="mt-1.5 flex items-center gap-2 text-xs text-on-surface-variant">
                                        {t('developerAlerts.access.who')}
                                        <select
                                            value={d.visibility ?? 'team'}
                                            onChange={(e) => setVisibility(d.id, e.target.value as 'team' | 'managers')}
                                            disabled={busy === `visibility-${d.id}`}
                                            className="rounded bg-surface-container-high px-2 py-1 text-xs text-on-surface focus:outline-none"
                                        >
                                            <option value="team">{t('developerAlerts.access.team')}</option>
                                            <option value="managers">{t('developerAlerts.access.managers')}</option>
                                        </select>
                                    </label>
                                )}
                                <p className="text-xs text-on-surface-variant mt-0.5">{d.title}</p>
                                {d.status === 'accepted' && d.acceptedAt && (
                                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                                        {t('developerSales.docs.acceptedBy', { name: d.acceptedName ?? '', date: formatDate(d.acceptedAt) })}
                                    </p>
                                )}
                                {(d.status === 'draft' || d.status === 'sent') && (
                                    <div className="mt-2 flex gap-3">
                                        <button type="button" onClick={() => send(d.id)} disabled={busy === `send-${d.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-secondary hover:underline disabled:opacity-50">
                                            {busy === `send-${d.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                                            {t(d.status === 'sent' ? 'developerSales.docs.resend' : 'developerSales.docs.send')}
                                        </button>
                                        <button type="button" onClick={() => voidDoc(d.id)} disabled={busy === `void-${d.id}`} className="text-xs font-medium text-on-surface-variant hover:text-error disabled:opacity-50">
                                            {t('developerSales.docs.void')}
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
