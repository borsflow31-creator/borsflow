'use client';

/**
 * The public listing page. No session: this is what a buyer opens.
 * Everything shown comes from the allow-listed listing the server publishes.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import type { PublicListing } from '@/lib/crm/public-listing';

const AMENITY_KEY: Record<string, string> = {
    elevator: 'elevator', parking: 'parking', balcony: 'balcony', terrace: 'terrace', garden: 'garden', pool: 'pool', furnished: 'furnished',
};

export default function PublicListingPage() {
    const { t, formatCurrency } = useI18n();
    const { token } = useParams<{ token: string }>();
    const [listing, setListing] = useState<PublicListing | null>(null);
    const [loading, setLoading] = useState(true);
    const [active, setActive] = useState(0);
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', message: '', website: '' });
    const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

    useEffect(() => {
        fetch(`/api/public/properties/${token}`)
            .then(res => (res.ok ? res.json() : null))
            .then(data => setListing(data?.listing ?? null))
            .catch(() => setListing(null))
            .finally(() => setLoading(false));
    }, [token]);

    if (loading) return <main className="min-h-screen flex items-center justify-center bg-background"><div className="skeleton w-96 h-64 rounded-lg" /></main>;
    if (!listing) {
        return <main className="min-h-screen flex items-center justify-center bg-background p-6"><p className="title-md text-on-surface">{t('realEstate.listing.invalid')}</p></main>;
    }

    const photos = listing.media.filter(m => m.kind === 'photo');
    const extras = listing.media.filter(m => m.kind !== 'photo');
    const current = photos[active] ?? photos[0];

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        setState('sending');
        try {
            const res = await fetch('/api/public/enquiries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, listingToken: token }),
            });
            setState(res.ok ? 'sent' : 'failed');
        } catch {
            setState('failed');
        }
    };

    const fact = (label: string, value: string | number | null | undefined) =>
        value === null || value === undefined || value === '' ? null : (
            <div key={label}>
                <dt className="body-xs text-on-surface-variant">{label}</dt>
                <dd className="body-md text-on-surface">{value}</dd>
            </div>
        );

    const input = 'premium-input w-full px-4 py-2.5 text-sm transition-all';

    return (
        <main className="min-h-screen bg-background">
            <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8">
                <header className="space-y-1">
                    <p className="body-sm text-on-surface-variant">{listing.agency}</p>
                    <h1 className="display-md text-on-surface">{listing.title}</h1>
                    <p className="body-md text-on-surface-variant">
                        {[listing.addressLine, listing.district, listing.city].filter(Boolean).join(', ')} · {listing.reference}
                    </p>
                    <p className="headline-lg text-on-surface">{formatCurrency(listing.price, listing.currency)}</p>
                </header>

                {current && (
                    <section aria-label={t('realEstate.listing.gallery')} className="space-y-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={current.url} alt={current.caption ?? listing.title} className="w-full max-h-[32rem] object-cover rounded-xl bg-surface-container-high" />
                        {photos.length > 1 && (
                            <ul className="flex gap-2 overflow-x-auto pb-1">
                                {photos.map((p, i) => (
                                    <li key={p.id}>
                                        <button onClick={() => setActive(i)} aria-label={`${i + 1} / ${photos.length}`} className={`block w-24 h-16 rounded-lg overflow-hidden border-2 ${i === active ? 'border-primary' : 'border-transparent'}`}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={p.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                            {fact(t('realEstate.properties.form.type'), t(`realEstate.properties.types.${listing.propertyType}` as MessageKey))}
                            {fact(t('realEstate.properties.form.surface'), listing.surfaceArea)}
                            {fact(t('realEstate.properties.form.rooms'), listing.rooms)}
                            {fact(t('realEstate.properties.form.bedrooms'), listing.bedrooms)}
                            {fact(t('realEstate.properties.form.bathrooms'), listing.bathrooms)}
                            {fact(t('realEstate.properties.form.floor'), listing.floor)}
                            {fact(t('realEstate.properties.form.buildYear'), listing.buildYear)}
                            {fact(t('realEstate.properties.form.energyRating'), listing.energyRating)}
                            {fact(t('realEstate.properties.detail.daysOnMarket'), listing.daysOnMarket)}
                        </dl>

                        {listing.amenities.length > 0 && (
                            <ul className="flex flex-wrap gap-2">
                                {listing.amenities.map(a => (
                                    <li key={a} className="body-sm px-3 py-1 rounded-full bg-surface-container text-on-surface">
                                        {t(`realEstate.properties.form.${AMENITY_KEY[a]}` as MessageKey)}
                                    </li>
                                ))}
                            </ul>
                        )}

                        {listing.description && <p className="body-lg text-on-surface whitespace-pre-wrap">{listing.description}</p>}

                        {extras.length > 0 && (
                            <ul className="space-y-1">
                                {extras.map(m => (
                                    <li key={m.id}>
                                        <a href={m.url} target="_blank" rel="noopener noreferrer" className="body-md text-primary hover:underline">
                                            {t(`realEstate.media.kind.${m.kind}` as MessageKey)}{m.caption ? ` — ${m.caption}` : ''} ↗
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <aside>
                        <form onSubmit={send} className="bg-surface rounded-xl shadow-md p-5 space-y-3 sticky top-6">
                            <h2 className="title-lg text-on-surface">{t('realEstate.listing.enquiryTitle')}</h2>
                            {state === 'sent' ? (
                                <p className="body-md text-on-surface" role="status">{t('realEstate.listing.sent')}</p>
                            ) : (
                                <>
                                    {/* The honeypot: a field no person sees, so anything in it is a bot. */}
                                    <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
                                        <label>Website <input tabIndex={-1} autoComplete="off" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></label>
                                    </div>
                                    <input className={input} placeholder={t('realEstate.listing.firstName')} aria-label={t('realEstate.listing.firstName')} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                                    <input className={input} placeholder={t('realEstate.listing.lastName')} aria-label={t('realEstate.listing.lastName')} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                                    <input className={input} type="email" required placeholder={t('realEstate.listing.email')} aria-label={t('realEstate.listing.email')} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                                    <input className={input} type="tel" placeholder={t('realEstate.listing.phone')} aria-label={t('realEstate.listing.phone')} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                                    <textarea className={`${input} resize-none`} rows={4} placeholder={t('realEstate.listing.message')} aria-label={t('realEstate.listing.message')} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
                                    {state === 'failed' && <p className="body-sm text-error" role="alert">{t('realEstate.listing.failed')}</p>}
                                    <button type="submit" disabled={state === 'sending'} className="w-full px-4 py-3 bg-primary text-on-primary rounded-lg hover:bg-primary-container transition-colors disabled:opacity-50">
                                        {state === 'sending' ? t('common.saving') : t('realEstate.listing.send')}
                                    </button>
                                </>
                            )}
                        </form>
                    </aside>
                </div>
            </div>
        </main>
    );
}
