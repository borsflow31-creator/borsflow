'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import AppShell from '@/components/AppShell';
import { StandaloneGuide } from '@/components/ui/PageHeader';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import SelectRefined from '@/components/ui/SelectRefined';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { Badge, Field, Modal, errorFrom, inputClass, primaryButton, secondaryButton, useWorkspaceInfo } from '@/components/realestate/ui';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { SPLIT_ROLES } from '@/lib/services/commissions';

interface Split {
    id: string;
    userId: string | null;
    role: string;
    sharePercent: number;
    amount: number;
    status: string;
    note?: string | null;
    user?: { id: string; name?: string | null; email?: string | null } | null;
}

interface CommissionRow {
    id: string;
    status: string;
    basis: number;
    grossAmount: number;
    feeType: string;
    feePercent?: number | null;
    currency?: string | null;
    // An agency commission is on a listing; a developer's is on a unit of a project.
    property: { id: string; title: string; reference: string; city: string } | null;
    lot?: { id: string; lotNumber: string } | null;
    program?: { id: string; name: string } | null;
    splits: Split[];
}

/** What the commission is for, whichever kind of sale it came from. */
function commissionTitle(c: Pick<CommissionRow, 'property' | 'lot' | 'program'>): string {
    if (c.property) return c.property.title;
    return [c.program?.name, c.lot?.lotNumber].filter(Boolean).join(' · ');
}

interface Earning { userId: string | null; name: string; accrued: number; realized: number; paid: number }
interface ForecastRow { userId: string | null; potential: number; weighted: number; listings: number }

const TABS = ['forecast', 'accrued', 'realized', 'paid'] as const;
type Tab = (typeof TABS)[number];

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'good' | 'bad' | 'warn'> = {
    accrued: 'warn', realized: 'info', paid: 'good', cancelled: 'bad',
};

/** The shares of one commission, editable by an owner or admin until anything is paid. */
function SplitEditor({
    commission,
    agents,
    onSaved,
    onClose,
    isDeveloper,
}: {
    isDeveloper: boolean;
    commission: CommissionRow;
    agents: { id: string; name: string }[];
    onSaved: () => void;
    onClose: () => void;
}) {
    const { t, formatCurrency } = useI18n();
    const [rows, setRows] = useState(commission.splits.map(s => ({ userId: s.userId ?? '', role: s.role, sharePercent: String(s.sharePercent), note: s.note ?? '' })));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const total = rows.reduce((sum, r) => sum + (Number(r.sharePercent) || 0), 0);
    const over = total > 100 + 1e-9;
    const roleOptions = SPLIT_ROLES.map(r => ({ value: r, label: t(`realEstate.commissions.roles.${r}` as MessageKey) }));
    const agentOptions = [{ value: '', label: t(isDeveloper ? 'developerCommissions.company' : 'realEstate.commissions.shares.agency') }, ...agents.map(a => ({ value: a.id, label: a.name }))];
    const currency = commission.currency || 'USD';

    const save = async () => {
        if (over) return setError(t('realEstate.commissions.shares.over', { total: total.toFixed(1) }));
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`/api/commissions/${commission.id}/splits`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ splits: rows.map(r => ({ ...r, userId: r.userId || null, sharePercent: Number(r.sharePercent) || 0 })) }),
            });
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.commissions.errors.save')));
            onSaved();
        } catch {
            setError(t('realEstate.commissions.errors.save'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={t('realEstate.commissions.shares.title')} onClose={onClose} wide>
            <div className="space-y-4">
                {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}
                <p className="body-md text-on-surface-variant">{commissionTitle(commission)} · {formatCurrency(commission.grossAmount, currency)}</p>
                <ul className="space-y-3">
                    {rows.map((r, i) => (
                        <li key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                            <div className="sm:col-span-4"><Field label={t('realEstate.commissions.shares.role')}>
                                <SelectRefined value={r.role} options={roleOptions} onChange={v => setRows(p => p.map((x, j) => (j === i ? { ...x, role: v, userId: v === 'agency' ? '' : x.userId } : x)))} variant="filled" size="sm" />
                            </Field></div>
                            <div className="sm:col-span-4"><Field label={t('realEstate.commissions.shares.member')}>
                                <SelectRefined value={r.userId} options={agentOptions} onChange={v => setRows(p => p.map((x, j) => (j === i ? { ...x, userId: v } : x)))} disabled={r.role === 'agency'} variant="filled" size="sm" />
                            </Field></div>
                            <div className="sm:col-span-3"><Field label={t('realEstate.commissions.shares.percent')}>
                                <input type="number" min={0} max={100} step="any" value={r.sharePercent} onChange={e => setRows(p => p.map((x, j) => (j === i ? { ...x, sharePercent: e.target.value } : x)))} className={inputClass} />
                            </Field></div>
                            <button type="button" onClick={() => setRows(p => p.filter((_, j) => j !== i))} disabled={rows.length === 1} className="sm:col-span-1 text-on-surface-variant hover:text-error pb-3" aria-label={t('common.remove')}>×</button>
                        </li>
                    ))}
                </ul>
                <div className="flex items-center justify-between">
                    <button type="button" onClick={() => setRows(p => [...p, { userId: '', role: 'introducer', sharePercent: '0', note: '' }])} className="body-sm text-primary hover:underline">
                        + {t('realEstate.commissions.shares.add')}
                    </button>
                    <p className={`body-sm ${over ? 'text-error' : 'text-on-surface-variant'}`}>{t('realEstate.commissions.shares.total', { total: total.toFixed(1) })}</p>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className={secondaryButton}>{t('common.cancel')}</button>
                    <button onClick={save} disabled={saving || over} className={primaryButton}>{saving ? t('common.saving') : t('realEstate.commissions.shares.save')}</button>
                </div>
            </div>
        </Modal>
    );
}

/**
 * What the agency earns on sales, and who gets what.
 *
 * Revenue here is a percentage of a sale price, shared between listing agent, selling
 * agent and agency, and realized at closing -- not an invoice. The forecast is a number
 * to plan with; the other tabs are money that has accrued, been earned, or been paid.
 */
function CommissionsPageInner() {
    const { t, formatCurrency } = useI18n();
    const { workspaceId, ready } = useWorkspaceParam();
    const { data: session } = useSession();
    const isDeveloper = session?.user?.businessType === 'DEVELOPER';
    const info = useWorkspaceInfo(workspaceId);
    const [tab, setTab] = useState<Tab>('forecast');
    // The forecast is built from an agency's mandates on the market; a developer
    // has none, so it would always read zero. Developers start on what is accrued.
    const tabs = isDeveloper ? TABS.filter(name => name !== 'forecast') : TABS;
    useEffect(() => {
        if (isDeveloper && tab === 'forecast') setTab('accrued');
    }, [isDeveloper, tab]);
    const [mine, setMine] = useState(false);
    const [rows, setRows] = useState<CommissionRow[]>([]);
    const [earnings, setEarnings] = useState<Earning[]>([]);
    const [forecast, setForecast] = useState<{ rows: ForecastRow[]; potential: number; weighted: number } | null>(null);
    const [canModerate, setCanModerate] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState<CommissionRow | null>(null);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            if (tab === 'forecast') {
                const [f, all] = await Promise.all([
                    fetch(`/api/commissions/forecast?workspaceId=${workspaceId}`),
                    fetch(`/api/commissions?workspaceId=${workspaceId}${mine ? '&mine=1' : ''}`),
                ]);
                if (!f.ok) return setError(await errorFrom(f, t('realEstate.commissions.errors.load')));
                setForecast(await f.json());
                if (all.ok) { const d = await all.json(); setEarnings(d.earnings); setCanModerate(d.canModerate); }
            } else {
                const res = await fetch(`/api/commissions?workspaceId=${workspaceId}&status=${tab}${mine ? '&mine=1' : ''}`);
                if (!res.ok) return setError(await errorFrom(res, t('realEstate.commissions.errors.load')));
                const d = await res.json();
                setRows(d.commissions);
                setEarnings(d.earnings);
                setCanModerate(d.canModerate);
            }
            setError('');
        } catch {
            setError(t('realEstate.commissions.errors.load'));
        } finally {
            setLoading(false);
        }
    }, [workspaceId, tab, mine, t]);

    useEffect(() => { load(); }, [load]);

    const pay = async (c: CommissionRow) => {
        if (!confirm(t('realEstate.commissions.markPaidConfirm'))) return;
        const res = await fetch(`/api/commissions/${c.id}/pay`, { method: 'POST' });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.commissions.errors.save')));
        load();
    };

    const currency = info.currency;
    const totalOf = useMemo(() => earnings.reduce((acc, e) => ({ accrued: acc.accrued + e.accrued, realized: acc.realized + e.realized, paid: acc.paid + e.paid }), { accrued: 0, realized: 0, paid: 0 }), [earnings]);

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <NoWorkspace />;

    return (
        <AppShell
            workspace={{ id: workspaceId, name: info.name || t('crm.page.workspaceFallback') }}
            currentPage={undefined}
            breadcrumbs={[
                { label: t('nav.dashboard'), href: '/dashboard' },
                { label: t('realEstate.nav.commissions'), href: `/commissions?workspace=${workspaceId}` },
            ]}
        >
            <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div>
                        <h1 className="display-md text-on-surface">{t('realEstate.commissions.title')}</h1>
                        <p className="body-md text-on-surface-variant">{isDeveloper ? t('developerGuide.desc.commissions') : t('realEstate.commissions.subtitle')}</p>
                    </div>
                    {canModerate && (
                        <label className="flex items-center gap-2 body-sm text-on-surface">
                            <input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} />
                            {t('realEstate.commissions.mine')}
                        </label>
                    )}
                </div>

                {isDeveloper && <StandaloneGuide id="commissions" />}

                <section aria-label={t('realEstate.commissions.earnings.title')} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {([['accrued', totalOf.accrued], ['realized', totalOf.realized], ['paid', totalOf.paid]] as const).map(([key, value]) => (
                        <div key={key} className="bg-surface-container rounded-lg p-4">
                            <p className="body-sm text-on-surface-variant">{t(`${isDeveloper ? 'developerCommissions' : 'realEstate.commissions.earnings'}.${key}` as MessageKey)}</p>
                            <p className="headline-md text-on-surface">{formatCurrency(value, currency)}</p>
                        </div>
                    ))}
                </section>

                <div className="flex flex-wrap gap-2" role="tablist">
                    {tabs.map(name => (
                        <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}
                            className={`px-4 py-2 rounded-lg body-md transition-colors ${tab === name ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}>
                            {t(`realEstate.commissions.tabs.${name}` as MessageKey)}
                        </button>
                    ))}
                </div>
                {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}

                {loading ? <div className="skeleton h-48 rounded-lg" /> : tab === 'forecast' ? (
                    <section className="space-y-4">
                        <p className="body-sm text-on-surface-variant">{t('realEstate.commissions.forecast.hint')}</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-surface-container rounded-lg p-4"><p className="body-sm text-on-surface-variant">{t('realEstate.commissions.forecast.potential')}</p><p className="headline-md text-on-surface">{formatCurrency(forecast?.potential ?? 0, currency)}</p></div>
                            <div className="bg-surface-container rounded-lg p-4"><p className="body-sm text-on-surface-variant">{t('realEstate.commissions.forecast.weighted')}</p><p className="headline-md text-on-surface">{formatCurrency(forecast?.weighted ?? 0, currency)}</p></div>
                        </div>
                        {(forecast?.rows.length ?? 0) === 0 ? (
                            <p className="body-md text-on-surface-variant text-center py-8">{t('realEstate.commissions.forecast.empty')}</p>
                        ) : (
                            <ul className="space-y-2">
                                {forecast!.rows.map(r => (
                                    <li key={r.userId ?? 'none'} className="flex flex-wrap items-center justify-between gap-2 bg-surface-container rounded-lg px-4 py-3">
                                        <span className="body-md text-on-surface">{info.agents.find(a => a.id === r.userId)?.name || t(isDeveloper ? 'developerCommissions.company' : 'realEstate.commissions.shares.agency')}</span>
                                        <span className="body-sm text-on-surface-variant">{t('realEstate.commissions.forecast.listings', { count: r.listings })}</span>
                                        <span className="body-md text-on-surface">{formatCurrency(r.weighted, currency)} <span className="body-xs text-on-surface-variant">/ {formatCurrency(r.potential, currency)}</span></span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                ) : rows.length === 0 ? (
                    <p className="body-md text-on-surface-variant text-center py-12">{t(isDeveloper ? 'developerCommissions.empty' : 'realEstate.commissions.empty')}</p>
                ) : (
                    <ul className="space-y-4">
                        {rows.map(c => (
                            <li key={c.id} className="bg-surface-container rounded-lg p-5 space-y-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <Link
                                            href={c.property
                                                ? `/properties/${c.property.id}?workspace=${workspaceId}`
                                                : `/developer/programs/${c.program?.id ?? ''}?workspace=${workspaceId}`}
                                            className="title-md text-primary hover:underline"
                                        >
                                            {commissionTitle(c)}
                                        </Link>
                                        <p className="body-sm text-on-surface-variant">
                                            {t('realEstate.commissions.basis')} {formatCurrency(c.basis, c.currency || currency)}
                                            {c.feeType === 'percent' && c.feePercent != null ? ` · ${c.feePercent}%` : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="headline-sm text-on-surface">{formatCurrency(c.grossAmount, c.currency || currency)}</span>
                                        <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>{t(`realEstate.commissions.status.${c.status}` as MessageKey)}</Badge>
                                    </div>
                                </div>
                                <ul className="divide-y divide-outline-variant/20">
                                    {c.splits.map(s => (
                                        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 body-sm">
                                            <span className="text-on-surface">{s.user?.name || s.user?.email || t(isDeveloper ? 'developerCommissions.company' : 'realEstate.commissions.shares.agency')} <span className="text-on-surface-variant">· {t(`realEstate.commissions.roles.${s.role}` as MessageKey)}</span></span>
                                            <span className="text-on-surface-variant">{s.sharePercent}%</span>
                                            <span className="text-on-surface">{formatCurrency(s.amount, c.currency || currency)}</span>
                                        </li>
                                    ))}
                                </ul>
                                {canModerate && !['paid', 'cancelled'].includes(c.status) && (
                                    <div className="flex flex-wrap gap-2">
                                        <button onClick={() => setEditing(c)} className={secondaryButton}>{t('realEstate.commissions.shares.edit')}</button>
                                        {c.status === 'realized' && <button onClick={() => pay(c)} className={primaryButton}>{t('realEstate.commissions.markPaid')}</button>}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                {editing && <SplitEditor isDeveloper={isDeveloper} commission={editing} agents={info.agents} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
            </div>
        </AppShell>
    );
}

export default function CommissionsPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <CommissionsPageInner />
        </Suspense>
    );
}
