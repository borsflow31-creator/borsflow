'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import SelectRefined from '@/components/ui/SelectRefined';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { Badge, Field, Modal, errorFrom, inputClass, primaryButton, secondaryButton, dangerButton, useWorkspaceInfo } from '@/components/realestate/ui';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';

interface Feed {
    id: string;
    name: string;
    portal: string;
    format: string;
    url: string | null;
    isActive: boolean;
    includeUnpublished: boolean;
    lastFetchedAt?: string | null;
    fetchCount: number;
}

/**
 * Portal feeds: the URLs a listing portal fetches. Each is a credential, so rotating
 * one is how an agency cuts off a portal, and only an owner or admin sees or creates them.
 */
function PortalsPageInner() {
    const { t, formatDateTime } = useI18n();
    const { workspaceId, ready } = useWorkspaceParam();
    const info = useWorkspaceInfo(workspaceId);
    const [feeds, setFeeds] = useState<Feed[]>([]);
    const [portals, setPortals] = useState<string[]>([]);
    const [canWrite, setCanWrite] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ name: '', portal: 'generic', format: 'xml', includeUnpublished: false });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        try {
            const res = await fetch(`/api/portal-feeds?workspaceId=${workspaceId}`);
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.portalFeeds.errors.load')));
            const data = await res.json();
            setFeeds(data.feeds);
            setPortals(data.portals);
            setCanWrite(Boolean(data.canWrite));
            setError('');
        } catch {
            setError(t('realEstate.portalFeeds.errors.load'));
        } finally {
            setLoading(false);
        }
    }, [workspaceId, t]);

    useEffect(() => { load(); }, [load]);

    const create = async () => {
        if (!form.name.trim()) return setError(t('realEstate.portalFeeds.errors.name'));
        setSaving(true);
        try {
            const res = await fetch('/api/portal-feeds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, workspaceId }) });
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.portalFeeds.errors.save')));
            setCreating(false);
            setForm({ name: '', portal: 'generic', format: 'xml', includeUnpublished: false });
            setError('');
            load();
        } catch {
            setError(t('realEstate.portalFeeds.errors.save'));
        } finally {
            setSaving(false);
        }
    };

    const change = async (feed: Feed, body: object) => {
        const res = await fetch(`/api/portal-feeds/${feed.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.portalFeeds.errors.save')));
        load();
    };

    const remove = async (feed: Feed) => {
        if (!confirm(t('realEstate.portalFeeds.deleteConfirm', { name: feed.name }))) return;
        const res = await fetch(`/api/portal-feeds/${feed.id}`, { method: 'DELETE' });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.portalFeeds.errors.save')));
        load();
    };

    const copy = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            alert(t('realEstate.portalFeeds.copied'));
        } catch {
            prompt(t('realEstate.portalFeeds.url'), url);
        }
    };

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <NoWorkspace />;

    const portalOptions = portals.map(p => ({ value: p, label: t(`realEstate.portalFeeds.portals.${p}` as MessageKey) }));
    const formatOptions = ['xml', 'json'].map(f => ({ value: f, label: f.toUpperCase() }));

    return (
        <AppShell
            workspace={{ id: workspaceId, name: info.name || t('crm.page.workspaceFallback') }}
            currentPage={undefined}
            breadcrumbs={[
                { label: t('nav.dashboard'), href: '/dashboard' },
                { label: t('realEstate.nav.properties'), href: `/properties?workspace=${workspaceId}` },
                { label: t('realEstate.portalFeeds.title'), href: `/portals?workspace=${workspaceId}` },
            ]}
        >
            <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div>
                        <h1 className="display-md text-on-surface">{t('realEstate.portalFeeds.title')}</h1>
                        <p className="body-md text-on-surface-variant">{t('realEstate.portalFeeds.subtitle')}</p>
                    </div>
                    {canWrite && <button onClick={() => setCreating(true)} className={primaryButton}>{t('realEstate.portalFeeds.new')}</button>}
                </div>
                <p className="body-sm text-on-surface-variant bg-surface-container rounded-lg p-4">{t('realEstate.portalFeeds.onboardingNote')}</p>
                {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}

                {loading ? <div className="skeleton h-40 rounded-lg" /> : feeds.length === 0 ? (
                    <p className="body-md text-on-surface-variant text-center py-12">{t('realEstate.portalFeeds.empty')}</p>
                ) : (
                    <ul className="space-y-4">
                        {feeds.map(feed => (
                            <li key={feed.id} className="bg-surface-container rounded-lg p-5 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="title-md text-on-surface">{feed.name}</p>
                                        <p className="body-sm text-on-surface-variant">
                                            {t(`realEstate.portalFeeds.portals.${feed.portal}` as MessageKey)} · {feed.format.toUpperCase()}
                                            {feed.includeUnpublished ? ` · ${t('realEstate.portalFeeds.includeUnpublished')}` : ''}
                                        </p>
                                    </div>
                                    <Badge tone={feed.isActive ? 'good' : 'neutral'}>{t(feed.isActive ? 'realEstate.portalFeeds.active' : 'realEstate.portalFeeds.paused')}</Badge>
                                </div>
                                {feed.url && <p className="body-xs text-on-surface-variant break-all font-mono">{feed.url}</p>}
                                <p className="body-sm text-on-surface-variant">
                                    {feed.lastFetchedAt ? t('realEstate.portalFeeds.lastFetched', { date: formatDateTime(feed.lastFetchedAt), count: feed.fetchCount }) : t('realEstate.portalFeeds.neverFetched')}
                                </p>
                                {canWrite && (
                                    <div className="flex flex-wrap gap-2">
                                        {feed.url && <button onClick={() => copy(feed.url!)} className={secondaryButton}>{t('realEstate.portalFeeds.copy')}</button>}
                                        <button onClick={() => change(feed, { isActive: !feed.isActive })} className={secondaryButton}>{t(feed.isActive ? 'realEstate.portalFeeds.pause' : 'realEstate.portalFeeds.resume')}</button>
                                        <button onClick={() => { if (confirm(t('realEstate.portalFeeds.rotateConfirm'))) change(feed, { rotate: true }); }} className={secondaryButton}>{t('realEstate.portalFeeds.rotate')}</button>
                                        <button onClick={() => remove(feed)} className={dangerButton}>{t('common.delete')}</button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                {creating && (
                    <Modal title={t('realEstate.portalFeeds.new')} onClose={() => setCreating(false)}>
                        <div className="space-y-4">
                            <Field label={t('realEstate.portalFeeds.form.name')}>
                                <input className={inputClass} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('realEstate.portalFeeds.form.namePlaceholder')} />
                            </Field>
                            <Field label={t('realEstate.portalFeeds.form.portal')}>
                                <SelectRefined value={form.portal} options={portalOptions} onChange={v => setForm({ ...form, portal: v })} variant="filled" size="sm" />
                            </Field>
                            <Field label={t('realEstate.portalFeeds.form.format')}>
                                <SelectRefined value={form.format} options={formatOptions} onChange={v => setForm({ ...form, format: v })} variant="filled" size="sm" />
                            </Field>
                            <label className="flex items-start gap-2 body-sm text-on-surface">
                                <input type="checkbox" className="mt-1" checked={form.includeUnpublished} onChange={e => setForm({ ...form, includeUnpublished: e.target.checked })} />
                                <span>{t('realEstate.portalFeeds.form.includeUnpublished')}</span>
                            </label>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setCreating(false)} className={secondaryButton}>{t('common.cancel')}</button>
                                <button onClick={create} disabled={saving} className={primaryButton}>{saving ? t('common.saving') : t('realEstate.portalFeeds.form.create')}</button>
                            </div>
                        </div>
                    </Modal>
                )}
            </div>
        </AppShell>
    );
}

export default function PortalsPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <PortalsPageInner />
        </Suspense>
    );
}
