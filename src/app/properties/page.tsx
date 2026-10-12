'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import Toast from '@/components/Toast';
import SelectRefined from '@/components/ui/SelectRefined';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { PropertyCard, type PropertyCardData } from '@/components/realestate/cards';
import PropertyFormModal from '@/components/realestate/PropertyFormModal';
import { inputClass, primaryButton, secondaryButton, useWorkspaceInfo, errorFrom } from '@/components/realestate/ui';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { PROPERTY_STATUSES, PROPERTY_TYPES } from '@/lib/crm/lifecycle';
import { StandaloneGuide } from '@/components/ui/PageHeader';

interface Filters {
    q: string;
    status: string;
    type: string;
    city: string;
    minPrice: string;
    maxPrice: string;
    minBedrooms: string;
}

const NO_FILTERS: Filters = { q: '', status: '', type: '', city: '', minPrice: '', maxPrice: '', minBedrooms: '' };

function PropertiesPageInner() {
    const { t } = useI18n();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { workspaceId, ready } = useWorkspaceParam();
    const info = useWorkspaceInfo(workspaceId);

    const [filters, setFilters] = useState<Filters>(NO_FILTERS);
    const [debouncedQ, setDebouncedQ] = useState('');
    const [page, setPage] = useState(1);
    const [properties, setProperties] = useState<PropertyCardData[]>([]);
    const [cities, setCities] = useState<string[]>([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [canWrite, setCanWrite] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(searchParams.get('new') === '1');
    const [ownerBoardId, setOwnerBoardId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // The search box waits for a pause in typing; the selects apply immediately.
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQ(filters.q), 300);
        return () => clearTimeout(timer);
    }, [filters.q]);

    const query = useMemo(() => {
        const p = new URLSearchParams({ workspaceId, page: String(page), limit: '24' });
        if (debouncedQ.trim()) p.set('q', debouncedQ.trim());
        for (const key of ['status', 'type', 'city', 'minPrice', 'maxPrice', 'minBedrooms'] as const) {
            if (filters[key]) p.set(key, filters[key]);
        }
        return p.toString();
    }, [workspaceId, page, debouncedQ, filters]);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/properties?${query}`);
            if (!res.ok) {
                setToast({ message: await errorFrom(res, t('realEstate.properties.errors.load')), type: 'error' });
                return;
            }
            const data = await res.json();
            setProperties(data.properties);
            setCities(data.cities ?? []);
            setPagination(data.pagination);
            setCanWrite(Boolean(data.canWrite));
        } catch {
            setToast({ message: t('realEstate.properties.errors.load'), type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [query, workspaceId, t]);

    useEffect(() => { load(); }, [load]);

    // The link to the owner board needs its id.
    useEffect(() => {
        if (!workspaceId) return;
        fetch(`/api/pipelines?workspaceId=${workspaceId}`)
            .then(res => (res.ok ? res.json() : []))
            .then((pipelines: { id: string; subjectType?: string }[]) => {
                setOwnerBoardId(pipelines.find(p => p.subjectType === 'Property')?.id ?? null);
            })
            .catch(() => {});
    }, [workspaceId]);

    const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const filtered = Object.entries(filters).some(([, v]) => v !== '');

    const statusOptions = useMemo(
        () => [{ value: '', label: t('realEstate.properties.filters.all') }, ...PROPERTY_STATUSES.map(v => ({ value: v, label: t(`realEstate.properties.status.${v}` as MessageKey) }))],
        [t]
    );
    const typeOptions = useMemo(
        () => [{ value: '', label: t('realEstate.properties.filters.all') }, ...PROPERTY_TYPES.map(v => ({ value: v, label: t(`realEstate.properties.types.${v}` as MessageKey) }))],
        [t]
    );
    const cityOptions = useMemo(
        () => [{ value: '', label: t('realEstate.properties.filters.all') }, ...cities.map(c => ({ value: c, label: c }))],
        [cities, t]
    );

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <NoWorkspace />;

    return (
        <AppShell
            workspace={{ id: workspaceId, name: info.name || t('crm.page.workspaceFallback') }}
            currentPage={undefined}
            breadcrumbs={[
                { label: t('nav.dashboard'), href: '/dashboard' },
                { label: t('realEstate.nav.properties'), href: `/properties?workspace=${workspaceId}` },
            ]}
        >
            <div className="p-4 sm:p-6">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h1 className="display-md text-on-surface">{t('realEstate.properties.title')}</h1>
                        <p className="body-md text-on-surface-variant">{t('realEstate.properties.subtitle')}</p>
                    </div>
                        <div className="mb-5">
                            <StandaloneGuide id="properties" />
                        </div>
                    <div className="flex items-center gap-2">
                        {ownerBoardId && (
                            <Link href={`/crm?workspace=${workspaceId}&pipeline=${ownerBoardId}`} className={secondaryButton}>
                                {t('realEstate.properties.viewBoard')}
                            </Link>
                        )}
                        {canWrite && (
                            <button onClick={() => setShowForm(true)} className={primaryButton}>
                                {t('realEstate.properties.new')}
                            </button>
                        )}
                    </div>
                </div>

                <div className="mb-6 grid grid-cols-2 lg:grid-cols-7 gap-3 items-end">
                    <div className="col-span-2 lg:col-span-2">
                        <input
                            type="search"
                            value={filters.q}
                            onChange={e => setFilter('q', e.target.value)}
                            placeholder={t('realEstate.properties.searchPlaceholder')}
                            className={inputClass}
                            aria-label={t('realEstate.properties.searchPlaceholder')}
                        />
                    </div>
                    <SelectRefined value={filters.status} options={statusOptions} onChange={v => setFilter('status', v)} label={t('realEstate.properties.filters.status')} variant="filled" />
                    <SelectRefined value={filters.type} options={typeOptions} onChange={v => setFilter('type', v)} label={t('realEstate.properties.filters.type')} variant="filled" />
                    <SelectRefined value={filters.city} options={cityOptions} onChange={v => setFilter('city', v)} label={t('realEstate.properties.filters.city')} variant="filled" />
                    <input type="number" min={0} value={filters.minPrice} onChange={e => setFilter('minPrice', e.target.value)} placeholder={t('realEstate.properties.filters.minPrice')} className={inputClass} aria-label={t('realEstate.properties.filters.minPrice')} />
                    <input type="number" min={0} value={filters.maxPrice} onChange={e => setFilter('maxPrice', e.target.value)} placeholder={t('realEstate.properties.filters.maxPrice')} className={inputClass} aria-label={t('realEstate.properties.filters.maxPrice')} />
                    <input type="number" min={0} value={filters.minBedrooms} onChange={e => setFilter('minBedrooms', e.target.value)} placeholder={t('realEstate.properties.filters.minBedrooms')} className={inputClass} aria-label={t('realEstate.properties.filters.minBedrooms')} />
                    {filtered && (
                        <button onClick={() => { setFilters(NO_FILTERS); setPage(1); }} className="body-sm text-primary text-left">
                            {t('realEstate.properties.filters.clear')}
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-64 rounded-lg" />)}
                    </div>
                ) : properties.length === 0 ? (
                    <div className="flex flex-col items-center text-center py-20 gap-3">
                        <Building2 className="w-10 h-10 text-on-surface-variant" />
                        <p className="title-md text-on-surface">
                            {filtered ? t('realEstate.properties.empty.filtered') : t('realEstate.properties.empty.title')}
                        </p>
                        {!filtered && <p className="body-md text-on-surface-variant max-w-md">{t('realEstate.properties.empty.body')}</p>}
                        {!filtered && canWrite && (
                            <button onClick={() => setShowForm(true)} className={primaryButton}>{t('realEstate.properties.new')}</button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {properties.map(p => <PropertyCard key={p.id} property={p} workspaceId={workspaceId} currency={info.currency} />)}
                        </div>
                        {pagination.pages > 1 && (
                            <div className="mt-6 flex items-center justify-center gap-3">
                                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={secondaryButton}>←</button>
                                <span className="body-sm text-on-surface-variant">{pagination.page} / {pagination.pages}</span>
                                <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} className={secondaryButton}>→</button>
                            </div>
                        )}
                    </>
                )}

                {showForm && (
                    <PropertyFormModal
                        workspaceId={workspaceId}
                        onClose={() => setShowForm(false)}
                        onSaved={(property) => {
                            setShowForm(false);
                            router.push(`/properties/${property.id}?workspace=${workspaceId}`);
                        }}
                    />
                )}
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppShell>
    );
}

export default function PropertiesPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <PropertiesPageInner />
        </Suspense>
    );
}
