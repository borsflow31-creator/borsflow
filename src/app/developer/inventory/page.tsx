'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Loader2, Rows3, Table2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import Toast from '@/components/Toast';
import LotModal from '@/components/developer/LotModal';
import { Modal, Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { useWorkspaceCurrency } from '@/components/developer/useWorkspaceCurrency';
import { useWorkspaceAgents } from '@/components/developer/useWorkspaceAgents';
import {
    Chip, LOT_STATUS_LABEL, LOT_STATUS_TILE, LOT_STATUS_TONE, tableClass, tdClass, thClass,
} from '@/components/developer/status';
import { useI18n } from '@/i18n/I18nProvider';
import { LOT_STATUSES } from '@/lib/crm/projects';

const LOT_TYPES = ['apartment', 'house', 'parking', 'box', 'cellar', 'commercial'] as const;
/** A deal exists on these, so a sale can be cancelled. */
const CANCELLABLE = new Set(['reserved', 'contract_signed', 'deed_signed']);

interface Filters {
    programId: string;
    buildingId: string;
    status: string;
    type: string;
    agentId: string;
    minPrice: string;
    maxPrice: string;
}
const NO_FILTERS: Filters = { programId: '', buildingId: '', status: '', type: '', agentId: '', minPrice: '', maxPrice: '' };

function personName(p?: { firstName: string; lastName: string } | null): string {
    return p ? `${p.firstName} ${p.lastName}`.trim() || '–' : '–';
}

function InventoryInner() {
    const { workspaceId, ready } = useWorkspaceParam();
    const { t, formatNumber, formatDate } = useI18n();
    const currency = useWorkspaceCurrency(workspaceId);
    const agents = useWorkspaceAgents(workspaceId);

    const [lots, setLots] = useState<any[]>([]);
    const [programs, setPrograms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<Filters>(NO_FILTERS);
    // Price inputs are typed digit by digit; applying each keystroke would fire a
    // request per digit, so the query follows them after a short pause.
    const [applied, setApplied] = useState<Filters>(NO_FILTERS);
    const [view, setView] = useState<'table' | 'building'>('table');
    const [editing, setEditing] = useState<any | null>(null);
    const [cancelling, setCancelling] = useState<any | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const money = (n: number) => formatNumber(n, { style: 'currency', currency, maximumFractionDigits: 0 });
    const moneyCompact = (n: number) =>
        formatNumber(n, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });

    useEffect(() => {
        const id = setTimeout(() => setApplied(filters), 300);
        return () => clearTimeout(id);
    }, [filters]);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({ workspaceId });
            for (const [key, value] of Object.entries(applied)) if (value) params.set(key, value);
            const res = await fetch(`/api/developer/lots?${params}`);
            if (!res.ok) throw new Error('failed');
            setLots((await res.json()).lots ?? []);
        } catch {
            setToast({ message: t('developer.loadFailed'), type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [workspaceId, applied, t]);

    useEffect(() => { if (ready && workspaceId) load(); }, [ready, workspaceId, load]);

    // Projects and their buildings, for the filters and for the lot form.
    useEffect(() => {
        if (!ready || !workspaceId) return;
        fetch(`/api/developer/programs?workspaceId=${workspaceId}`)
            .then((r) => (r.ok ? r.json() : { programs: [] }))
            .then((d) => setPrograms(d.programs ?? []))
            .catch(() => { /* filters degrade to empty */ });
    }, [ready, workspaceId]);

    const buildingOptions = useMemo(() => {
        const pool = filters.programId ? programs.filter((p) => p.id === filters.programId) : programs;
        return pool.flatMap((p) => (p.buildings ?? []).map((b: any) => ({ id: b.id, name: `${p.name} · ${b.name}` })));
    }, [programs, filters.programId]);

    const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
    const hasFilters = Object.values(filters).some(Boolean);

    /** Project → building → floor (top first), for the building view. */
    const grouped = useMemo(() => {
        const out = new Map<string, { name: string; buildings: Map<string, { name: string; floors: Map<number, any[]> }> }>();
        for (const lot of lots) {
            const project = out.get(lot.programId) ?? { name: lot.program?.name ?? '', buildings: new Map() };
            const bKey = lot.buildingId ?? 'none';
            const building = project.buildings.get(bKey) ?? { name: lot.building?.name ?? '–', floors: new Map() };
            const floor = building.floors.get(lot.floor) ?? [];
            floor.push(lot);
            building.floors.set(lot.floor, floor);
            project.buildings.set(bKey, building);
            out.set(lot.programId, project);
        }
        return out;
    }, [lots]);

    const totals = useMemo(() => {
        let value = 0;
        for (const l of lots) value += l.totalPrice ?? 0;
        return { count: lots.length, value };
    }, [lots]);

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <AppShell><NoWorkspace /></AppShell>;

    const paymentCell = (lot: any) => {
        const p = lot.payment;
        if (!p || p.state === 'none') return <span className="text-on-surface-variant/70">{t('developer.paymentsNone')}</span>;
        if (p.state === 'paid') return <Chip tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{t('developer.paymentsPaid')}</Chip>;
        if (p.state === 'overdue') return <Chip tone="bg-red-500/10 text-red-700 dark:text-red-400">{t('developer.paymentsOverdue')}</Chip>;
        return (
            <span className="tabular-nums text-xs text-on-surface-variant">
                {t('developer.paymentsPartial', { paid: moneyCompact(p.paid), total: moneyCompact(p.called) })}
            </span>
        );
    };

    const selectClass = `${inputClass} !py-2`;

    return (
        <AppShell>
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-2 bg-primary/10 text-primary rounded-lg"><LayoutGrid className="w-6 h-6" /></span>
                            <h1 className="text-2xl font-bold text-on-surface">{t('developer.inventoryTitle')}</h1>
                        </div>
                        <p className="text-sm text-on-surface-variant mt-1">
                            {t('developer.inventorySubtitle')} · {t('developer.unitsCount', { count: totals.count })} · {moneyCompact(totals.value)}
                        </p>
                    </div>
                    <div role="tablist" className="inline-flex rounded-lg border border-outline-variant/30 p-0.5 bg-surface-container-low">
                        {([['table', Table2, 'developer.inventoryTableView'], ['building', Rows3, 'developer.inventoryBuildingView']] as const).map(([key, Icon, label]) => (
                            <button
                                key={key}
                                role="tab"
                                aria-selected={view === key}
                                onClick={() => setView(key)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                    view === key ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {t(label)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
                    <select className={selectClass} value={filters.programId} onChange={(e) => set({ programId: e.target.value, buildingId: '' })} aria-label={t('developer.filterAllProjects')}>
                        <option value="">{t('developer.filterAllProjects')}</option>
                        {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select className={selectClass} value={filters.buildingId} onChange={(e) => set({ buildingId: e.target.value })} aria-label={t('developer.filterAllBuildings')}>
                        <option value="">{t('developer.filterAllBuildings')}</option>
                        {buildingOptions.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <select className={selectClass} value={filters.status} onChange={(e) => set({ status: e.target.value })} aria-label={t('developer.filterAllStatuses')}>
                        <option value="">{t('developer.filterAllStatuses')}</option>
                        {LOT_STATUSES.map((s) => <option key={s} value={s}>{t(LOT_STATUS_LABEL[s])}</option>)}
                    </select>
                    <select className={`${selectClass} capitalize`} value={filters.type} onChange={(e) => set({ type: e.target.value })} aria-label={t('developer.filterAllTypes')}>
                        <option value="">{t('developer.filterAllTypes')}</option>
                        {LOT_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select className={selectClass} value={filters.agentId} onChange={(e) => set({ agentId: e.target.value })} aria-label={t('developer.filterAllAgents')}>
                        <option value="">{t('developer.filterAllAgents')}</option>
                        {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <input type="number" min={0} className={selectClass} placeholder={t('developer.filterMinPrice')} aria-label={t('developer.filterMinPrice')} value={filters.minPrice} onChange={(e) => set({ minPrice: e.target.value })} />
                    <input type="number" min={0} className={selectClass} placeholder={t('developer.filterMaxPrice')} aria-label={t('developer.filterMaxPrice')} value={filters.maxPrice} onChange={(e) => set({ maxPrice: e.target.value })} />
                    <button
                        onClick={() => { setFilters(NO_FILTERS); setApplied(NO_FILTERS); }}
                        disabled={!hasFilters}
                        className="text-xs font-medium text-secondary hover:underline disabled:opacity-40 disabled:no-underline"
                    >
                        {t('developer.clearFilters')}
                    </button>
                </div>

                {loading && lots.length === 0 ? (
                    <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" /></div>
                ) : lots.length === 0 ? (
                    <div className="p-12 text-center border border-dashed border-outline-variant/40 rounded-xl">
                        <LayoutGrid className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-3" />
                        <p className="text-sm text-on-surface-variant">{t('developer.inventoryEmpty')}</p>
                    </div>
                ) : view === 'table' ? (
                    <div className={`overflow-x-auto border border-outline-variant/20 rounded-xl ${loading ? 'opacity-60' : ''}`}>
                        <table className={tableClass}>
                            <thead className="bg-surface-container-low">
                                <tr>
                                    <th className={thClass}>{t('developer.colUnit')}</th>
                                    <th className={thClass}>{t('developer.colBuilding')}</th>
                                    <th className={thClass}>{t('developer.colFloor')}</th>
                                    <th className={thClass}>{t('developer.colType')}</th>
                                    <th className={thClass}>{t('developer.colBedrooms')}</th>
                                    <th className={`${thClass} text-end`}>{t('developer.colArea')}</th>
                                    <th className={thClass}>{t('developer.colOrientation')}</th>
                                    <th className={`${thClass} text-end`}>{t('developer.colListPrice')}</th>
                                    <th className={`${thClass} text-end`}>{t('developer.colDiscount')}</th>
                                    <th className={`${thClass} text-end`}>{t('developer.colFinalPrice')}</th>
                                    <th className={thClass}>{t('developer.colStatus')}</th>
                                    <th className={thClass}>{t('developer.colOwner')}</th>
                                    <th className={thClass}>{t('developer.colAgent')}</th>
                                    <th className={thClass}>{t('developer.colReservedAt')}</th>
                                    <th className={thClass}>{t('developer.colContractAt')}</th>
                                    <th className={thClass}>{t('developer.colPaymentStatus')}</th>
                                    <th className={thClass} />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/15">
                                {lots.map((lot) => (
                                    <tr
                                        key={lot.id}
                                        tabIndex={0}
                                        onClick={() => setEditing(lot)}
                                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setEditing(lot)}
                                        className="cursor-pointer hover:bg-surface-container-low/60 focus:bg-surface-container-low/60 focus:outline-none transition-colors"
                                    >
                                        <td className={tdClass}>
                                            <span className="block font-semibold text-on-surface">{lot.lotNumber}</span>
                                            <span className="block text-[11px] text-on-surface-variant">{lot.program?.name}</span>
                                        </td>
                                        <td className={tdClass}>{lot.building?.name ?? '–'}</td>
                                        <td className={`${tdClass} tabular-nums`}>{lot.floor}</td>
                                        <td className={`${tdClass} capitalize`}>
                                            {lot.type}{lot.typology ? ` · ${lot.typology}` : ''}
                                        </td>
                                        <td className={`${tdClass} tabular-nums`}>{lot.bedrooms ?? '–'}</td>
                                        <td className={`${tdClass} text-end tabular-nums`}>{lot.surfaceArea} m²</td>
                                        <td className={tdClass}>{lot.orientation ?? '–'}</td>
                                        <td className={`${tdClass} text-end tabular-nums`}>{money(lot.basePrice)}</td>
                                        <td className={`${tdClass} text-end tabular-nums text-on-surface-variant`}>
                                            {lot.discount > 0 ? `−${money(lot.discount)}` : '–'}
                                        </td>
                                        <td className={`${tdClass} text-end tabular-nums font-semibold`}>{money(lot.totalPrice)}</td>
                                        <td className={tdClass}>
                                            <Chip tone={LOT_STATUS_TONE[lot.status] ?? LOT_STATUS_TONE.delivered}>
                                                {t(LOT_STATUS_LABEL[lot.status] ?? LOT_STATUS_LABEL.available)}
                                            </Chip>
                                        </td>
                                        <td className={tdClass}>
                                            {personName(lot.buyerLead ?? lot.optionHolderLead)}
                                        </td>
                                        <td className={tdClass}>{lot.salesAgent?.name ?? lot.salesAgent?.email ?? '–'}</td>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{lot.reservedAt ? formatDate(lot.reservedAt) : '–'}</td>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{lot.contractSignedAt ? formatDate(lot.contractSignedAt) : '–'}</td>
                                        <td className={tdClass}>{paymentCell(lot)}</td>
                                        <td className={`${tdClass} text-end`}>
                                            {CANCELLABLE.has(lot.status) && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setCancelling(lot); }}
                                                    className="text-xs font-medium text-error hover:underline whitespace-nowrap"
                                                >
                                                    {t('developer.cancelSale')}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className={`space-y-8 ${loading ? 'opacity-60' : ''}`}>
                        {/* Legend: the tile colours, with their words. */}
                        <ul className="flex flex-wrap gap-2">
                            {LOT_STATUSES.map((s) => (
                                <li key={s}><Chip tone={LOT_STATUS_TONE[s]}>{t(LOT_STATUS_LABEL[s])}</Chip></li>
                            ))}
                        </ul>
                        {[...grouped.entries()].map(([programId, project]) => (
                            <section key={programId}>
                                <h2 className="text-sm font-semibold text-on-surface mb-3">{project.name}</h2>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                    {[...project.buildings.entries()].map(([bKey, building]) => (
                                        <div key={bKey} className="border border-outline-variant/20 rounded-xl p-4">
                                            <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">{building.name}</h3>
                                            <div className="space-y-1.5">
                                                {[...building.floors.entries()].sort((a, b) => b[0] - a[0]).map(([floor, floorLots]) => (
                                                    <div key={floor} className="flex items-start gap-3">
                                                        <span className="w-8 flex-shrink-0 pt-1.5 text-[11px] text-on-surface-variant tabular-nums text-end">{floor}</span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {floorLots.map((lot) => (
                                                                <button
                                                                    key={lot.id}
                                                                    onClick={() => setEditing(lot)}
                                                                    title={`${lot.lotNumber} · ${t(LOT_STATUS_LABEL[lot.status])} · ${money(lot.totalPrice)}`}
                                                                    aria-label={`${lot.lotNumber}, ${t(LOT_STATUS_LABEL[lot.status])}, ${money(lot.totalPrice)}`}
                                                                    className={`min-w-[52px] px-2 py-1.5 rounded-md border text-center transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60 ${LOT_STATUS_TILE[lot.status] ?? LOT_STATUS_TILE.delivered}`}
                                                                >
                                                                    <span className="block text-xs font-semibold leading-tight">{lot.lotNumber}</span>
                                                                    <span className="block text-[10px] leading-tight opacity-80 tabular-nums">{lot.surfaceArea} m²</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>

            {editing && (
                <LotModal
                    workspaceId={workspaceId}
                    programId={editing.programId}
                    buildings={programs.find((p) => p.id === editing.programId)?.buildings ?? []}
                    initialLot={editing}
                    onClose={() => setEditing(null)}
                    onSuccess={() => { setEditing(null); load(); }}
                />
            )}

            {cancelling && (
                <CancelSaleModal
                    workspaceId={workspaceId}
                    lot={cancelling}
                    onClose={() => setCancelling(null)}
                    onDone={(info) => {
                        setCancelling(null);
                        load();
                        // What the cancellation did not undo, said plainly: these are
                        // money questions someone has to settle by hand.
                        const notes: string[] = [];
                        if (info.remainingCalls > 0) notes.push(t('developerSales.cancel.callsRemain', { count: info.remainingCalls }));
                        if (info.commissionSettled) notes.push(t('developerSales.cancel.commissionSettled'));
                        else if (info.commissionWithdrawn) notes.push(t('developerSales.cancel.commissionWithdrawn'));
                        if (notes.length > 0) setToast({ message: notes.join(' '), type: 'success' });
                    }}
                    onError={(message) => setToast({ message, type: 'error' })}
                />
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppShell>
    );
}

function CancelSaleModal({
    workspaceId, lot, onClose, onDone, onError,
}: {
    workspaceId: string;
    lot: any;
    onClose: () => void;
    onDone: (info: { remainingCalls: number; commissionWithdrawn: boolean; commissionSettled: boolean }) => void;
    onError: (message: string) => void;
}) {
    const { t } = useI18n();
    const [reason, setReason] = useState('');
    const [refund, setRefund] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`/api/developer/lots/${lot.id}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId,
                    reason: reason.trim() || undefined,
                    refundAmount: refund.trim() === '' ? undefined : Number(refund),
                }),
            });
            if (!res.ok) throw new Error('failed');
            const data = await res.json();
            onDone({
                remainingCalls: data.remainingCalls ?? 0,
                commissionWithdrawn: !!data.commissionWithdrawn,
                commissionSettled: !!data.commissionSettled,
            });
        } catch {
            onError(t('developer.cancelSaleFailed'));
            setSaving(false);
        }
    };

    return (
        <Modal title={t('developer.cancelSaleTitle')} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                <p className="text-sm text-on-surface-variant">{t('developer.cancelSaleBody', { unit: lot.lotNumber })}</p>
                <Field label={t('developer.cancelSaleReason')}>
                    <textarea
                        className={inputClass}
                        rows={3}
                        maxLength={500}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={t('developer.cancelSaleReasonPlaceholder')}
                        autoFocus
                    />
                </Field>
                <Field label={t('developerSales.cancel.refund')}>
                    <input type="number" min={0} step={100} className={inputClass} value={refund} onChange={(e) => setRefund(e.target.value)} placeholder="0" />
                </Field>
                <p className="text-xs text-on-surface-variant">{t('developerSales.cancel.refundHint')}</p>
                <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={onClose} className={secondaryButton} disabled={saving}>{t('common.cancel')}</button>
                    <button type="submit" className={primaryButton} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('developer.cancelSaleConfirm')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

export default function InventoryPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <InventoryInner />
        </Suspense>
    );
}
