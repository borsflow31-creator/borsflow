'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import PageSkeleton from '@/components/PageSkeleton';
import Toast from '@/components/Toast';
import SelectRefined from '@/components/ui/SelectRefined';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import PropertyFormModal, { type PropertyRecord } from '@/components/realestate/PropertyFormModal';
import { PublishPanel } from '@/components/realestate/PublishPanel';
import MediaManager from '@/components/realestate/MediaManager';
import MandatePanel from '@/components/realestate/MandatePanel';
import InterestsPanel, { type InterestRow } from '@/components/realestate/InterestsPanel';
import OffersPanel, { OfferFormModal } from '@/components/realestate/OffersPanel';
import ViewingsList, { ViewingFormModal } from '@/components/realestate/ViewingsPanel';
import ActivityTimeline from '@/components/realestate/activity';
import { Badge, STATUS_TONE, contactName, dangerButton, errorFrom, secondaryButton, useWorkspaceInfo } from '@/components/realestate/ui';
import { PROPERTY_STATUSES, daysOnMarket } from '@/lib/crm/lifecycle';
import { MatchesList } from '@/components/realestate/BriefsPanel';

const TABS = ['overview', 'media', 'mandate', 'interests', 'matches', 'offers', 'viewings', 'activity'] as const;
type Tab = (typeof TABS)[number];

type Detail = PropertyRecord & {
    workspaceId: string;
    owner?: { id: string; name?: string | null; email?: string | null } | null;
    pipeline?: { id: string; name: string } | null;
};

function PropertyDetailInner() {
    const { t, formatCurrency, formatDate } = useI18n();
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const id = params.id;

    const [property, setProperty] = useState<Detail | null>(null);
    const [canWrite, setCanWrite] = useState(false);
    const [canModerate, setCanModerate] = useState(false);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [editing, setEditing] = useState(false);
    const [offerFor, setOfferFor] = useState<{ interestId?: string } | null>(null);
    const [viewingFor, setViewingFor] = useState<{ interestId?: string; lead?: InterestRow['lead'] } | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const requested = searchParams.get('tab') as Tab | null;
    const tab: Tab = requested && TABS.includes(requested) ? requested : 'overview';

    const workspaceId = property?.workspaceId ?? searchParams.get('workspace') ?? '';
    const info = useWorkspaceInfo(workspaceId);
    const currency = property?.currency || info.currency;

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/properties/${id}`);
            if (res.status === 404) return setNotFound(true);
            if (!res.ok) return setToast({ message: await errorFrom(res, t('realEstate.properties.errors.loadOne')), type: 'error' });
            const data = await res.json();
            setProperty({ ...data.property, daysOnMarket: data.property.daysOnMarket });
            setCanWrite(Boolean(data.canWrite));
            setCanModerate(Boolean(data.canModerate));
        } catch {
            setToast({ message: t('realEstate.properties.errors.loadOne'), type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    useEffect(() => { load(); }, [load]);

    /** Something changed on a tab: reload the header and let the other tabs refetch. */
    const changed = useCallback(() => { setRefreshKey(k => k + 1); load(); }, [load]);

    const goTab = (next: Tab) => {
        const qs = new URLSearchParams(searchParams.toString());
        qs.set('tab', next);
        router.replace(`/properties/${id}?${qs.toString()}`, { scroll: false });
    };

    const statusOptions = useMemo(
        () => PROPERTY_STATUSES.map(v => ({ value: v, label: t(`realEstate.properties.status.${v}` as MessageKey) })),
        [t]
    );

    const changeStatus = async (status: string) => {
        if (!property || status === property.status) return;
        const res = await fetch(`/api/properties/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
        if (!res.ok) return setToast({ message: await errorFrom(res, t('realEstate.properties.errors.save')), type: 'error' });
        changed();
    };

    const remove = async () => {
        if (!property || !confirm(t('realEstate.properties.detail.deleteConfirm', { title: property.title }))) return;
        const res = await fetch(`/api/properties/${id}`, { method: 'DELETE' });
        if (!res.ok) return setToast({ message: await errorFrom(res, t('realEstate.properties.errors.delete')), type: 'error' });
        router.push(`/properties?workspace=${property.workspaceId}`);
    };

    if (loading) return <PageSkeleton />;

    if (notFound || !property) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
                <p className="title-md text-on-surface">{t('realEstate.properties.errors.notFound')}</p>
                <Link href="/properties" className="text-primary hover:underline">{t('realEstate.properties.detail.back')}</Link>
            </div>
        );
    }

    const days = daysOnMarket(property.listedAt);
    const fact = (label: string, value: React.ReactNode) =>
        value === null || value === undefined || value === '' ? null : (
            <div key={label}>
                <dt className="body-xs text-on-surface-variant">{label}</dt>
                <dd className="body-md text-on-surface">{value}</dd>
            </div>
        );

    return (
        <AppShell
            workspace={{ id: property.workspaceId, name: info.name || t('crm.page.workspaceFallback') }}
            currentPage={undefined}
            breadcrumbs={[
                { label: t('nav.dashboard'), href: '/dashboard' },
                { label: t('realEstate.nav.properties'), href: `/properties?workspace=${property.workspaceId}` },
                { label: property.title, href: `/properties/${id}?workspace=${property.workspaceId}` },
            ]}
        >
            <div className="p-4 sm:p-6 max-w-6xl mx-auto">
                <Link href={`/properties?workspace=${property.workspaceId}`} className="body-sm text-primary hover:underline">
                    ← {t('realEstate.properties.detail.back')}
                </Link>

                <div className="mt-3 mb-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="display-md text-on-surface">{property.title}</h1>
                            <Badge tone={STATUS_TONE[property.status] ?? 'neutral'}>{t(`realEstate.properties.status.${property.status}` as MessageKey)}</Badge>
                        </div>
                        <p className="body-md text-on-surface-variant">
                            {property.reference} · {[property.addressLine, property.district, property.city].filter(Boolean).join(', ')}
                        </p>
                        <p className="headline-md text-on-surface mt-2">{formatCurrency(property.price, currency)}</p>
                        <p className="body-sm text-on-surface-variant">
                            {days !== null ? t('realEstate.properties.card.daysOnMarket', { count: days }) : t('realEstate.properties.detail.notListed')}
                            {property.listedAt ? ` · ${t('realEstate.properties.detail.listedOn', { date: formatDate(property.listedAt) })}` : ''}
                        </p>
                    </div>
                    {canWrite && (
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="w-44">
                                <SelectRefined value={property.status} options={statusOptions} onChange={changeStatus} variant="filled" size="sm" />
                            </div>
                            <button onClick={() => setEditing(true)} className={secondaryButton}>{t('realEstate.properties.edit')}</button>
                            {canModerate && <button onClick={remove} className={dangerButton}>{t('realEstate.properties.detail.delete')}</button>}
                        </div>
                    )}
                </div>

                <div className="mb-6 border-b border-outline-variant/20 overflow-x-auto">
                    <nav className="flex gap-1" role="tablist">
                        {TABS.map(name => (
                            <button
                                key={name}
                                role="tab"
                                aria-selected={tab === name}
                                onClick={() => goTab(name)}
                                className={`px-4 py-2 body-md whitespace-nowrap border-b-2 transition-colors ${
                                    tab === name ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                {t(`realEstate.properties.detail.tabs.${name}` as MessageKey)}
                            </button>
                        ))}
                    </nav>
                </div>

                {tab === 'overview' && (
                    <div className="space-y-8">
                        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                            {fact(t('realEstate.properties.form.type'), t(`realEstate.properties.types.${property.propertyType}` as MessageKey))}
                            {fact(t('realEstate.properties.form.transaction'), t(`realEstate.properties.transaction.${property.transactionType}` as MessageKey))}
                            {fact(t('realEstate.properties.form.surface'), property.surfaceArea)}
                            {fact(t('realEstate.properties.form.landArea'), property.landArea)}
                            {fact(t('realEstate.properties.form.rooms'), property.rooms)}
                            {fact(t('realEstate.properties.form.bedrooms'), property.bedrooms)}
                            {fact(t('realEstate.properties.form.bathrooms'), property.bathrooms)}
                            {fact(t('realEstate.properties.form.floor'), property.floor)}
                            {fact(t('realEstate.properties.form.buildYear'), property.buildYear)}
                            {fact(t('realEstate.properties.form.energyRating'), property.energyRating)}
                            {fact(t('realEstate.properties.form.postalCode'), property.postalCode)}
                            {fact(t('realEstate.properties.form.country'), property.countryCode)}
                        </dl>

                        <ul className="flex flex-wrap gap-2">
                            {([
                                ['hasElevator', 'elevator'], ['hasParking', 'parking'], ['hasBalcony', 'balcony'], ['hasTerrace', 'terrace'],
                                ['hasGarden', 'garden'], ['hasPool', 'pool'], ['furnished', 'furnished'],
                            ] as const).filter(([key]) => property[key]).map(([key, label]) => (
                                <li key={key}><Badge>{t(`realEstate.properties.form.${label}` as MessageKey)}</Badge></li>
                            ))}
                        </ul>

                        {property.description && <p className="body-md text-on-surface whitespace-pre-wrap max-w-3xl">{property.description}</p>}

                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface-container rounded-lg p-5">
                            {fact(t('realEstate.properties.detail.vendor'), property.vendor ? `${contactName(property.vendor)}${property.vendor.email ? ` · ${property.vendor.email}` : ''}` : t('realEstate.properties.card.vendorUnknown'))}
                            {fact(t('realEstate.properties.detail.agent'), property.owner?.name || property.owner?.email || t('realEstate.properties.form.ownerNone'))}
                        </dl>

                        {property.customFields && Object.keys(property.customFields).length > 0 && (
                            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                                {Object.entries(property.customFields).map(([key, value]) =>
                                    fact(key, typeof value === 'boolean' ? (value ? t('common.confirm') : '—') : String(value))
                                )}
                            </dl>
                        )}

                        <PublishPanel propertyId={id} isPublished={Boolean(property.isPublished)} hasLink={Boolean(property.publicToken)} canWrite={canWrite} onChanged={changed} />

                        {property.pipeline && (
                            <Link href={`/crm?workspace=${property.workspaceId}&pipeline=${property.pipeline.id}`} className="body-sm text-primary hover:underline">
                                {t('realEstate.properties.openBoard')} →
                            </Link>
                        )}
                    </div>
                )}

                {tab === 'media' && <MediaManager propertyId={id} canWrite={canWrite} onChanged={changed} />}

                {tab === 'mandate' && (
                    <MandatePanel
                        workspaceId={property.workspaceId}
                        property={{ id, title: property.title, price: property.price, currency: property.currency, vendor: property.vendor }}
                        canWrite={canWrite}
                        onChanged={changed}
                    />
                )}

                {tab === 'interests' && (
                    <InterestsPanel
                        key={refreshKey}
                        workspaceId={property.workspaceId}
                        property={{ id, title: property.title, reference: property.reference, city: property.city }}
                        canWrite={canWrite}
                        currency={currency}
                        onChanged={changed}
                        onBookViewing={row => setViewingFor({ interestId: row.id, lead: row.lead })}
                        onMakeOffer={row => setOfferFor({ interestId: row.id })}
                    />
                )}

                {tab === 'matches' && (
                    <MatchesList workspaceId={property.workspaceId} propertyId={id} canWrite={canWrite} onChanged={changed} />
                )}

                {tab === 'offers' && (
                    <OffersPanel
                        workspaceId={property.workspaceId}
                        propertyId={id}
                        canWrite={canWrite}
                        currency={currency}
                        refreshKey={refreshKey}
                        onChanged={changed}
                        onRecord={() => setOfferFor({})}
                    />
                )}

                {tab === 'viewings' && (
                    <ViewingsList
                        workspaceId={property.workspaceId}
                        propertyId={id}
                        canWrite={canWrite}
                        refreshKey={refreshKey}
                        onChanged={changed}
                        onBook={() => setViewingFor({})}
                    />
                )}

                {tab === 'activity' && <ActivityTimeline propertyId={id} currency={currency} refreshKey={refreshKey} />}

                {editing && (
                    <PropertyFormModal
                        workspaceId={property.workspaceId}
                        property={property}
                        onClose={() => setEditing(false)}
                        onSaved={() => { setEditing(false); changed(); }}
                    />
                )}
                {offerFor && (
                    <OfferFormModal
                        workspaceId={property.workspaceId}
                        propertyId={id}
                        interestId={offerFor.interestId}
                        onClose={() => setOfferFor(null)}
                        onSaved={() => { setOfferFor(null); changed(); goTab('offers'); }}
                    />
                )}
                {viewingFor && (
                    <ViewingFormModal
                        workspaceId={property.workspaceId}
                        property={{ id, title: property.title, reference: property.reference, city: property.city }}
                        lead={viewingFor.lead ?? null}
                        interestId={viewingFor.interestId}
                        onClose={() => setViewingFor(null)}
                        onSaved={() => { setViewingFor(null); changed(); goTab('viewings'); }}
                    />
                )}
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppShell>
    );
}

export default function PropertyDetailPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <PropertyDetailInner />
        </Suspense>
    );
}
