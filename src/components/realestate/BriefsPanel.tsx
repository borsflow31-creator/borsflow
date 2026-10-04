'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { Badge, Field, Modal, STATUS_TONE, contactName, dangerButton, errorFrom, inputClass, primaryButton, secondaryButton, useWorkspaceInfo } from './ui';
import { PROPERTY_TYPES } from '@/lib/crm/lifecycle';

interface Brief {
    id: string;
    name: string;
    isActive: boolean;
    notifyByEmail: boolean;
    priceMin?: number | null;
    priceMax?: number | null;
    surfaceMin?: number | null;
    bedroomsMin?: number | null;
    roomsMin?: number | null;
    mustHaveParking: boolean;
    mustHaveElevator: boolean;
    mustHaveGarden: boolean;
    mustHaveTerrace: boolean;
    mustHaveBalcony: boolean;
    propertyTypes?: string | null;
    cities?: string | null;
    districts?: string | null;
    notes?: string | null;
    matchCount: number;
}

interface Insights {
    viewings: number;
    averageInterest: number | null;
    suggestion: { priceMax: number } | null;
}

const MUSTS = [
    ['mustHaveParking', 'parking'],
    ['mustHaveElevator', 'elevator'],
    ['mustHaveGarden', 'garden'],
    ['mustHaveTerrace', 'terrace'],
    ['mustHaveBalcony', 'balcony'],
] as const;

const list = (raw?: string | null): string[] => {
    try { const v = JSON.parse(raw ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** Record or edit what a buyer is looking for. */
export function BriefModal({
    workspaceId,
    leadId,
    brief,
    onSaved,
    onClose,
}: {
    workspaceId: string;
    leadId: string;
    brief?: Brief | null;
    onSaved: (matched: number) => void;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const editing = Boolean(brief);
    const [f, setF] = useState({
        name: brief?.name ?? '',
        priceMin: s(brief?.priceMin), priceMax: s(brief?.priceMax), surfaceMin: s(brief?.surfaceMin),
        bedroomsMin: s(brief?.bedroomsMin), roomsMin: s(brief?.roomsMin),
        cities: list(brief?.cities).join(', '), districts: list(brief?.districts).join(', '),
        notifyByEmail: brief?.notifyByEmail ?? true, isActive: brief?.isActive ?? true,
        notes: brief?.notes ?? '',
        mustHaveParking: brief?.mustHaveParking ?? false, mustHaveElevator: brief?.mustHaveElevator ?? false,
        mustHaveGarden: brief?.mustHaveGarden ?? false, mustHaveTerrace: brief?.mustHaveTerrace ?? false,
        mustHaveBalcony: brief?.mustHaveBalcony ?? false,
    });
    const [types, setTypes] = useState<string[]>(list(brief?.propertyTypes));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(prev => ({ ...prev, [k]: v }));
    const blank = (v: string) => (v.trim() === '' ? null : v.trim());
    const csv = (v: string) => v.split(',').map(x => x.trim()).filter(Boolean);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!f.name.trim()) return setError(t('realEstate.briefs.form.nameRequired'));
        setSaving(true);
        setError('');
        try {
            const res = await fetch(editing ? `/api/search-briefs/${brief!.id}` : '/api/search-briefs', {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId,
                    ...(editing ? {} : { leadId }),
                    name: f.name,
                    priceMin: blank(f.priceMin), priceMax: blank(f.priceMax), surfaceMin: blank(f.surfaceMin),
                    bedroomsMin: blank(f.bedroomsMin), roomsMin: blank(f.roomsMin),
                    propertyTypes: types, cities: csv(f.cities), districts: csv(f.districts),
                    notifyByEmail: f.notifyByEmail, isActive: f.isActive, notes: blank(f.notes),
                    mustHaveParking: f.mustHaveParking, mustHaveElevator: f.mustHaveElevator, mustHaveGarden: f.mustHaveGarden,
                    mustHaveTerrace: f.mustHaveTerrace, mustHaveBalcony: f.mustHaveBalcony,
                }),
            });
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.briefs.errors.save')));
            onSaved((await res.json()).matched ?? 0);
        } catch {
            setError(t('realEstate.briefs.errors.save'));
        } finally {
            setSaving(false);
        }
    };

    const num = (key: 'priceMin' | 'priceMax' | 'surfaceMin' | 'bedroomsMin' | 'roomsMin', label: string) => (
        <Field label={label}>
            <input type="number" min={0} step="any" value={f[key]} onChange={e => set(key, e.target.value)} className={inputClass} />
        </Field>
    );

    return (
        <Modal title={editing ? t('realEstate.briefs.edit') : t('realEstate.briefs.new')} onClose={onClose} wide>
            <form onSubmit={submit} className="space-y-5">
                {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}
                <Field label={t('realEstate.briefs.form.name')}>
                    <input value={f.name} onChange={e => set('name', e.target.value)} className={inputClass} placeholder={t('realEstate.briefs.form.namePlaceholder')} required />
                </Field>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {num('priceMin', t('realEstate.briefs.form.priceMin'))}
                    {num('priceMax', t('realEstate.briefs.form.priceMax'))}
                    {num('surfaceMin', t('realEstate.briefs.form.surfaceMin'))}
                    {num('bedroomsMin', t('realEstate.briefs.form.bedroomsMin'))}
                    {num('roomsMin', t('realEstate.briefs.form.roomsMin'))}
                </div>
                <div>
                    <p className="body-sm text-on-surface-variant mb-2">{t('realEstate.briefs.form.types')}</p>
                    <div className="flex flex-wrap gap-3">
                        {PROPERTY_TYPES.map(type => (
                            <label key={type} className="flex items-center gap-2 body-sm text-on-surface">
                                <input type="checkbox" checked={types.includes(type)} onChange={e => setTypes(prev => (e.target.checked ? [...prev, type] : prev.filter(x => x !== type)))} />
                                {t(`realEstate.properties.types.${type}` as MessageKey)}
                            </label>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label={t('realEstate.briefs.form.cities')} hint={t('realEstate.briefs.form.listHint')}>
                        <input value={f.cities} onChange={e => set('cities', e.target.value)} className={inputClass} />
                    </Field>
                    <Field label={t('realEstate.briefs.form.districts')} hint={t('realEstate.briefs.form.listHint')}>
                        <input value={f.districts} onChange={e => set('districts', e.target.value)} className={inputClass} />
                    </Field>
                </div>
                <div>
                    <p className="body-sm text-on-surface-variant mb-2">{t('realEstate.briefs.form.mustHave')}</p>
                    <div className="flex flex-wrap gap-4">
                        {MUSTS.map(([key, label]) => (
                            <label key={key} className="flex items-center gap-2 body-sm text-on-surface">
                                <input type="checkbox" checked={f[key]} onChange={e => set(key, e.target.checked)} />
                                {t(`realEstate.briefs.form.${label}` as MessageKey)}
                            </label>
                        ))}
                    </div>
                </div>
                <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-2 body-sm text-on-surface"><input type="checkbox" checked={f.notifyByEmail} onChange={e => set('notifyByEmail', e.target.checked)} />{t('realEstate.briefs.form.notify')}</label>
                    {editing && <label className="flex items-center gap-2 body-sm text-on-surface"><input type="checkbox" checked={f.isActive} onChange={e => set('isActive', e.target.checked)} />{t('realEstate.briefs.form.active')}</label>}
                </div>
                <Field label={t('realEstate.briefs.form.notes')}>
                    <textarea value={f.notes} onChange={e => set('notes', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
                </Field>
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className={secondaryButton}>{t('common.cancel')}</button>
                    <button type="submit" disabled={saving} className={primaryButton}>{saving ? t('common.saving') : editing ? t('realEstate.briefs.form.save') : t('realEstate.briefs.form.create')}</button>
                </div>
            </form>
        </Modal>
    );
}

/** A buyer's search briefs: what they want, what their viewings have said, and the matches. */
export default function BriefsPanel({ workspaceId, lead }: { workspaceId: string; lead: { id: string; firstName: string; lastName: string } }) {
    const { t, formatCurrency } = useI18n();
    const info = useWorkspaceInfo(workspaceId);
    const [briefs, setBriefs] = useState<Brief[]>([]);
    const [insights, setInsights] = useState<Insights | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [modal, setModal] = useState<{ brief: Brief | null } | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/search-briefs?workspaceId=${workspaceId}&leadId=${lead.id}`);
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.briefs.errors.load')));
            const data = await res.json();
            setBriefs(data.briefs);
            if (data.briefs[0]) {
                const detail = await fetch(`/api/search-briefs/${data.briefs[0].id}`);
                if (detail.ok) setInsights((await detail.json()).insights);
            } else {
                setInsights(null);
            }
        } catch {
            setError(t('realEstate.briefs.errors.load'));
        } finally {
            setLoading(false);
        }
    }, [workspaceId, lead.id, t]);

    useEffect(() => { load(); }, [load]);

    const remove = async (brief: Brief) => {
        if (!confirm(t('realEstate.briefs.deleteConfirm', { name: brief.name }))) return;
        const res = await fetch(`/api/search-briefs/${brief.id}`, { method: 'DELETE' });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.briefs.errors.delete')));
        load();
    };

    const applySuggestion = async (brief: Brief, priceMax: number) => {
        const res = await fetch(`/api/search-briefs/${brief.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceMax }) });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.briefs.errors.save')));
        load();
    };

    if (loading) return <div className="skeleton h-24 rounded-lg" />;

    return (
        <div className="space-y-4">
            {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}
            {notice && <p className="body-sm text-on-surface bg-surface-container rounded px-3 py-2" role="status">{notice}</p>}
            <div className="flex items-center justify-between">
                <h3 className="title-md text-on-surface">{t('realEstate.briefs.title')}</h3>
                <button onClick={() => setModal({ brief: null })} className={primaryButton}>{t('realEstate.briefs.new')}</button>
            </div>

            {briefs.length === 0 ? (
                <p className="body-md text-on-surface-variant py-4">{t('realEstate.briefs.empty')}</p>
            ) : (
                <ul className="space-y-3">
                    {briefs.map((brief, index) => (
                        <li key={brief.id} className="bg-surface-container rounded-lg p-4 space-y-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                    <p className="title-md text-on-surface">{brief.name}</p>
                                    <p className="body-sm text-on-surface-variant">
                                        {[
                                            brief.priceMin != null || brief.priceMax != null
                                                ? `${brief.priceMin != null ? formatCurrency(brief.priceMin, info.currency) : '…'} – ${brief.priceMax != null ? formatCurrency(brief.priceMax, info.currency) : '…'}`
                                                : null,
                                            brief.bedroomsMin != null ? t('realEstate.properties.card.bedrooms', { count: `${brief.bedroomsMin}+` }) : null,
                                            list(brief.cities).join(', ') || null,
                                        ].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!brief.isActive && <Badge>{t('realEstate.briefs.form.active')} ✕</Badge>}
                                    <button onClick={() => setModal({ brief })} className="body-sm text-primary hover:underline">{t('realEstate.briefs.edit')}</button>
                                    <button onClick={() => remove(brief)} className="body-sm text-error hover:underline">{t('realEstate.briefs.delete')}</button>
                                </div>
                            </div>
                            {index === 0 && insights && insights.viewings > 0 && (
                                <div className="body-sm text-on-surface-variant border-t border-outline-variant/20 pt-2 space-y-1">
                                    <p className="text-on-surface">{t('realEstate.briefs.insights.title')}: {t('realEstate.briefs.insights.viewings', { count: insights.viewings })}
                                        {insights.averageInterest !== null && ` · ${t('realEstate.briefs.insights.averageInterest', { level: insights.averageInterest })}`}</p>
                                    {insights.suggestion && (
                                        <p className="flex flex-wrap items-center gap-2">
                                            {t('realEstate.briefs.insights.suggestion', { price: formatCurrency(insights.suggestion.priceMax + 1, info.currency) })}
                                            <button onClick={() => applySuggestion(brief, insights.suggestion!.priceMax)} className={`${secondaryButton} !py-1`}>
                                                {t('realEstate.briefs.insights.apply', { price: formatCurrency(insights.suggestion.priceMax, info.currency) })}
                                            </button>
                                        </p>
                                    )}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {modal && (
                <BriefModal
                    workspaceId={workspaceId}
                    leadId={lead.id}
                    brief={modal.brief}
                    onClose={() => setModal(null)}
                    onSaved={matched => {
                        setModal(null);
                        setNotice(matched > 0 ? t('realEstate.briefs.matchedNow', { count: matched }) : '');
                        load();
                    }}
                />
            )}
        </div>
    );
}

/** Used by the property's Matches tab. Kept here with the brief types it renders. */
export interface MatchRow {
    id: string;
    score: number;
    status: string;
    reasons: { key: string; weight: number }[];
    lead: { id: string; firstName: string; lastName: string; email?: string | null };
    searchBrief: { id: string; name: string };
}

export function MatchesList({ workspaceId, propertyId, canWrite, onChanged }: { workspaceId: string; propertyId: string; canWrite: boolean; onChanged: () => void }) {
    const { t } = useI18n();
    const [rows, setRows] = useState<MatchRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/matches?workspaceId=${workspaceId}&propertyId=${propertyId}`);
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.matches.errors.load')));
            setRows((await res.json()).matches);
        } catch {
            setError(t('realEstate.matches.errors.load'));
        } finally {
            setLoading(false);
        }
    }, [workspaceId, propertyId, t]);

    useEffect(() => { load(); }, [load]);

    const act = async (id: string, action: 'convert' | 'dismiss') => {
        const res = await fetch(`/api/matches/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.matches.errors.update')));
        await load();
        onChanged();
    };

    if (loading) return <div className="skeleton h-32 rounded-lg" />;

    return (
        <div className="space-y-4">
            {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}
            <p className="body-sm text-on-surface-variant">{t('realEstate.matches.subtitle')}</p>
            {rows.length === 0 ? (
                <p className="body-md text-on-surface-variant text-center py-10">{t('realEstate.matches.empty')}</p>
            ) : (
                <ul className="space-y-3">
                    {rows.map(m => (
                        <li key={m.id} className="bg-surface-container rounded-lg p-4 space-y-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                    <p className="title-md text-on-surface">{contactName(m.lead)}</p>
                                    <p className="body-xs text-on-surface-variant">{t('realEstate.matches.viaBrief', { name: m.searchBrief.name })}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge tone="info">{t('realEstate.matches.score', { score: Math.round(m.score) })}</Badge>
                                    <Badge tone={m.status === 'converted' ? 'good' : STATUS_TONE[m.status] ?? 'neutral'}>{t(`realEstate.matches.status.${m.status}` as MessageKey)}</Badge>
                                </div>
                            </div>
                            <ul className="flex flex-wrap gap-2">
                                {m.reasons.map(r => <li key={r.key}><Badge>{t(`realEstate.matches.reasons.${r.key}` as MessageKey)} +{r.weight}</Badge></li>)}
                            </ul>
                            {canWrite && m.status !== 'converted' && (
                                <div className="flex gap-2">
                                    <button onClick={() => act(m.id, 'convert')} className={primaryButton}>{t('realEstate.matches.actions.createInterest')}</button>
                                    {m.status !== 'dismissed' && <button onClick={() => act(m.id, 'dismiss')} className={dangerButton}>{t('realEstate.matches.actions.dismiss')}</button>}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
