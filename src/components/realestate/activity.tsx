'use client';

import { useEffect, useState } from 'react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { relativeTime } from '@/lib/relative-time';
import { errorFrom } from './ui';

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/** The Activity types this module writes; the lead timeline uses it to know which rows are ours. */
export const REAL_ESTATE_ACTIVITY_TYPES = new Set([
    'property_created', 'property_updated', 'property_status_changed', 'property_stage_changed',
    'interest_created', 'interest_stage_changed', 'interest_status_changed',
    'mandate_created', 'mandate_status_changed', 'mandate_renewed',
    'price_changed', 'offer_made', 'offer_accepted', 'offer_rejected', 'offer_withdrawn',
    'viewing_booked', 'viewing_feedback',
]);

/**
 * One activity row as a sentence in the reader's language.
 *
 * The server stores an English `description` as a fallback, but the words a user
 * reads come from here, built from the structured `metadata` the event was logged
 * with, so a French agent does not read English sentences about their own deals.
 * Returns null for a type this does not know, and the caller falls back to the
 * stored description.
 */
export function describeActivity(
    type: string,
    data: Record<string, any>,
    t: Translate,
    formatCurrency: (amount: number, currency?: string) => string,
    fallbackCurrency?: string
): string | null {
    const money = (n: unknown) => (typeof n === 'number' ? formatCurrency(n, data.currency || fallbackCurrency) : String(n ?? ''));
    const propertyStatus = (v: unknown) => (v ? t(`realEstate.properties.status.${v}` as MessageKey) : '');
    const text = (v: unknown, fallback = '') => (v === null || v === undefined || v === '' ? fallback : String(v));

    switch (type) {
        case 'property_created':
            return t('realEstate.activity.propertyCreated', { title: text(data.title) });
        case 'property_updated':
            return t('realEstate.activity.propertyUpdated', { title: text(data.title) });
        case 'property_status_changed':
            return t('realEstate.activity.propertyStatus', { title: text(data.title), from: propertyStatus(data.from), to: propertyStatus(data.to) });
        case 'property_stage_changed':
            return t('realEstate.activity.propertyStage', { title: text(data.title), from: text(data.from), to: text(data.to) });
        case 'interest_created':
            return t('realEstate.activity.interestCreated', { buyer: text(data.buyer), property: text(data.property) });
        case 'interest_stage_changed':
            return t('realEstate.activity.interestStage', { buyer: text(data.buyer), property: text(data.property), from: text(data.from), to: text(data.to) });
        case 'interest_status_changed':
            return t('realEstate.activity.interestStatus', {
                buyer: text(data.buyer),
                property: text(data.property),
                status: data.status ? t(`realEstate.interests.status.${data.status}` as MessageKey) : '',
            });
        case 'mandate_created':
            return t('realEstate.activity.mandateCreated', { reference: text(data.reference), property: text(data.property) });
        case 'mandate_status_changed':
            return t('realEstate.activity.mandateStatus', {
                reference: text(data.reference),
                status: data.status ? t(`realEstate.mandates.status.${data.status}` as MessageKey) : '',
            });
        case 'mandate_renewed':
            return t('realEstate.activity.mandateRenewed', { reference: text(data.reference), date: text(data.date) });
        case 'price_changed':
            return t('realEstate.activity.priceChanged', { property: text(data.property), from: money(data.from), to: money(data.to) });
        case 'offer_made':
            return t('realEstate.activity.offerMade', { buyer: text(data.buyer), amount: money(data.amount), property: text(data.property) });
        case 'offer_accepted':
            return t('realEstate.activity.offerAccepted', { buyer: text(data.buyer), amount: money(data.amount), property: text(data.property) });
        case 'offer_rejected':
            return t('realEstate.activity.offerRejected', { buyer: text(data.buyer, '—'), amount: money(data.amount), property: text(data.property) });
        case 'offer_withdrawn':
            return t('realEstate.activity.offerWithdrawn', { buyer: text(data.buyer), amount: money(data.amount), property: text(data.property) });
        case 'viewing_booked':
            return t('realEstate.activity.viewingBooked', { property: text(data.property) });
        case 'viewing_feedback':
            return t('realEstate.activity.viewingFeedback', { property: text(data.property), level: text(data.level, '-') });
        default:
            return null;
    }
}

interface Entry {
    id: string;
    type: string;
    description: string;
    metadata: Record<string, any> | null;
    createdAt: string;
    user?: { name?: string | null; email?: string | null } | null;
}

/** Everything that happened on one property, newest first. */
export default function ActivityTimeline({ propertyId, currency, refreshKey = 0 }: { propertyId: string; currency: string; refreshKey?: number }) {
    const { t, locale, formatCurrency } = useI18n();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/properties/${propertyId}/activity`)
            .then(async res => {
                if (!res.ok) throw new Error(await errorFrom(res, t('realEstate.properties.errors.load')));
                return res.json();
            })
            .then(data => !cancelled && setEntries(data.activities))
            .catch(e => !cancelled && setError(e.message))
            .finally(() => !cancelled && setLoading(false));
        return () => { cancelled = true; };
    }, [propertyId, refreshKey, t]);

    if (loading) return <div className="skeleton h-40 rounded-lg" />;
    if (error) return <p className="body-sm text-error">{error}</p>;
    if (entries.length === 0) return <p className="body-md text-on-surface-variant text-center py-10">{t('realEstate.activity.empty')}</p>;

    return (
        <ol className="space-y-3">
            {entries.map(entry => (
                <li key={entry.id} className="flex gap-3 bg-surface-container rounded-lg px-4 py-3">
                    <div className="flex-1 min-w-0">
                        <p className="body-md text-on-surface">
                            {describeActivity(entry.type, entry.metadata ?? {}, t, formatCurrency, currency) ?? entry.description}
                        </p>
                        <p className="body-xs text-on-surface-variant">
                            {entry.user?.name || entry.user?.email || ''} · {relativeTime(entry.createdAt, locale)}
                        </p>
                    </div>
                </li>
            ))}
        </ol>
    );
}
