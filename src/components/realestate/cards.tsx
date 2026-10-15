'use client';

import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { daysOnMarket } from '@/lib/crm/lifecycle';
import { Badge, STATUS_TONE, contactName } from './ui';

export interface PropertyCardData {
    id: string;
    title: string;
    reference: string;
    city: string;
    district?: string | null;
    status: string;
    stage?: string;
    price: number;
    currency?: string | null;
    bedrooms?: number | null;
    surfaceArea?: number | null;
    listedAt?: string | null;
    coverUrl?: string | null;
    vendor?: { firstName: string; lastName: string } | null;
}

/** A listing in the grid: cover, status, price, the numbers a buyer scans first. */
/** A property price: whole units, no cents. */
function usePrice() {
    const { formatNumber } = useI18n();
    return (amount: number, currency: string) =>
        formatNumber(amount, { style: 'currency', currency, maximumFractionDigits: 0 });
}

export function PropertyCard({ property, workspaceId, currency }: { property: PropertyCardData; workspaceId: string; currency: string }) {
    const { t } = useI18n();
    const formatCurrency = usePrice();
    const days = daysOnMarket(property.listedAt);

    return (
        <Link
            href={`/properties/${property.id}?workspace=${workspaceId}`}
            className="group block bg-surface-container rounded-lg overflow-hidden hover:shadow-md transition-shadow"
        >
            <div className="relative aspect-[4/3] bg-surface-container-high">
                {property.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={property.coverUrl} alt={property.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-on-surface-variant gap-2">
                        <Building2 className="w-8 h-8" />
                        <span className="body-xs">{t('realEstate.properties.card.noPhoto')}</span>
                    </div>
                )}
                <div className="absolute top-2 left-2">
                    <Badge tone={STATUS_TONE[property.status] ?? 'neutral'}>
                        {t(`realEstate.properties.status.${property.status}` as MessageKey)}
                    </Badge>
                </div>
            </div>
            <div className="p-4 space-y-1">
                <p className="title-md text-on-surface truncate">{property.title}</p>
                <p className="body-sm text-on-surface-variant truncate">
                    {[property.district, property.city].filter(Boolean).join(', ')} · {property.reference}
                </p>
                <p className="headline-sm text-on-surface pt-1">{formatCurrency(property.price, property.currency || currency)}</p>
                <div className="flex flex-wrap items-center gap-x-3 body-xs text-on-surface-variant pt-1">
                    {property.bedrooms != null && <span>{t('realEstate.properties.card.bedrooms', { count: property.bedrooms })}</span>}
                    {property.surfaceArea != null && <span>{t('realEstate.properties.card.surface', { count: property.surfaceArea })}</span>}
                    {days != null && <span>{t('realEstate.properties.card.daysOnMarket', { count: days })}</span>}
                </div>
            </div>
        </Link>
    );
}

export interface InterestCardData {
    id: string;
    status: string;
    lead: { firstName: string; lastName: string; email?: string | null };
    property: { id: string; title: string; city: string; price: number; currency?: string | null };
    offers?: { id: string; amount: number; currency?: string | null }[];
    lastActivityAt?: string | null;
}

/** A buyer's journey on one property, as a card on the buyer board. */
export function InterestBoardCard({ interest, currency }: { interest: InterestCardData; currency: string }) {
    const { t } = useI18n();
    const formatCurrency = usePrice();
    const offers = interest.offers ?? [];
    const best = offers.reduce<number | null>((max, o) => (max === null || o.amount > max ? o.amount : max), null);

    return (
        <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
                <h4 className="title-md text-on-surface">{contactName(interest.lead)}</h4>
                {interest.status !== 'active' && (
                    <Badge tone={STATUS_TONE[interest.status] ?? 'neutral'}>
                        {t(`realEstate.interests.status.${interest.status}` as MessageKey)}
                    </Badge>
                )}
            </div>
            <p className="body-sm text-on-surface-variant">
                {interest.property.title}
                <span className="block body-xs">{interest.property.city}</span>
            </p>
            <div className="flex items-center justify-between body-sm">
                <span className="text-on-surface-variant">{formatCurrency(interest.property.price, interest.property.currency || currency)}</span>
                {best !== null && (
                    <span className="font-medium text-on-surface" title={t('realEstate.offers.title')}>
                        {formatCurrency(best, offers[0]?.currency || currency)}
                    </span>
                )}
            </div>
        </div>
    );
}

export interface PropertyBoardData extends PropertyCardData {
    vendor?: { firstName: string; lastName: string } | null;
}

/** A property on the owner board: the vendor is who the agent is working. */
export function PropertyBoardCard({ property, currency }: { property: PropertyBoardData; currency: string }) {
    const { t } = useI18n();
    const formatCurrency = usePrice();
    const days = daysOnMarket(property.listedAt);

    return (
        <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
                <h4 className="title-md text-on-surface">{property.title}</h4>
                <Badge tone={STATUS_TONE[property.status] ?? 'neutral'}>
                    {t(`realEstate.properties.status.${property.status}` as MessageKey)}
                </Badge>
            </div>
            <p className="body-sm text-on-surface-variant">
                {property.vendor ? contactName(property.vendor) : t('realEstate.properties.card.vendorUnknown')}
                <span className="block body-xs">{[property.city, property.reference].filter(Boolean).join(' · ')}</span>
            </p>
            <div className="flex items-center justify-between body-sm">
                <span className="font-medium text-on-surface">{formatCurrency(property.price, property.currency || currency)}</span>
                {days != null && <span className="body-xs text-on-surface-variant">{t('realEstate.properties.card.daysOnMarket', { count: days })}</span>}
            </div>
        </div>
    );
}
