'use client';

/**
 * Public offer view, for the vendor. Outside the middleware matcher, so no session
 * is required: the link is the credential. The buyer is deliberately anonymous.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { DEFAULT_CURRENCY } from '@/lib/currencies';

interface PublicOffer {
    amount: number;
    currency?: string | null;
    status: string;
    expiresAt?: string | null;
    conditions: { type: string; note: string }[];
    depositAmount?: number | null;
    financingType?: string | null;
    property: { title: string; reference: string; city: string; price: number; currency?: string | null };
    workspace: { name: string };
}

export default function PublicOfferPage() {
    const { t, formatCurrency, formatDate } = useI18n();
    const { token } = useParams<{ token: string }>();
    const [offer, setOffer] = useState<PublicOffer | null>(null);
    const [canRespond, setCanRespond] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
    const [outcome, setOutcome] = useState<'accepted' | 'rejected' | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/public/offers/${token}`);
            if (!res.ok) {
                setError(res.status === 404 ? t('realEstate.offers.vendor.invalid') : t('realEstate.offers.vendor.failed'));
                return;
            }
            const data = await res.json();
            setOffer(data.offer);
            setCanRespond(data.canRespond);
        } catch {
            setError(t('realEstate.offers.vendor.failed'));
        } finally {
            setLoading(false);
        }
    }, [token, t]);

    useEffect(() => { load(); }, [load]);

    const respond = async (decision: 'accept' | 'reject') => {
        setBusy(decision);
        setError('');
        try {
            const res = await fetch(`/api/public/offers/${token}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision }),
            });
            if (!res.ok) {
                setError(res.status === 409 ? t('realEstate.offers.vendor.closedMsg') : t('realEstate.offers.vendor.failed'));
                await load();
                return;
            }
            setOutcome(decision === 'accept' ? 'accepted' : 'rejected');
            setCanRespond(false);
        } catch {
            setError(t('realEstate.offers.vendor.failed'));
        } finally {
            setBusy(null);
        }
    };

    if (loading) return <main className="min-h-screen flex items-center justify-center bg-background"><div className="skeleton w-80 h-48 rounded-lg" /></main>;

    if (!offer) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-background p-6">
                <p className="title-md text-on-surface">{error || t('realEstate.offers.vendor.invalid')}</p>
            </main>
        );
    }

    const currency = offer.currency || offer.property.currency || DEFAULT_CURRENCY;

    return (
        <main className="min-h-screen bg-background p-4 sm:p-8">
            <div className="max-w-xl mx-auto bg-surface rounded-xl shadow-md p-6 sm:p-8 space-y-6">
                <header>
                    <p className="body-sm text-on-surface-variant">{offer.workspace.name}</p>
                    <h1 className="headline-lg text-on-surface">{t('realEstate.offers.vendor.title', { property: offer.property.title })}</h1>
                    <p className="body-md text-on-surface-variant">{t('realEstate.offers.vendor.intro')}</p>
                </header>

                <div className="bg-surface-container rounded-lg p-5">
                    <p className="body-sm text-on-surface-variant">{t('realEstate.offers.vendor.amount')}</p>
                    <p className="display-md text-on-surface">{formatCurrency(offer.amount, currency)}</p>
                    <p className="body-sm text-on-surface-variant mt-1">
                        {offer.financingType && `${t(`realEstate.offers.financing.${offer.financingType}` as MessageKey)}`}
                        {offer.depositAmount != null && ` · ${t('realEstate.offers.form.deposit')} ${formatCurrency(offer.depositAmount, currency)}`}
                        {offer.expiresAt && ` · ${t('realEstate.offers.validUntil', { date: formatDate(offer.expiresAt) })}`}
                    </p>
                </div>

                <section>
                    <h2 className="title-md text-on-surface mb-2">{t('realEstate.offers.vendor.conditions')}</h2>
                    {offer.conditions.length === 0 ? (
                        <p className="body-sm text-on-surface-variant">{t('realEstate.offers.vendor.noConditions')}</p>
                    ) : (
                        <ul className="space-y-1">
                            {offer.conditions.map((c, i) => (
                                <li key={i} className="body-md text-on-surface">
                                    <span className="font-medium">{t(`realEstate.offers.condition.${c.type}` as MessageKey)}</span>
                                    {c.note ? `: ${c.note}` : ''}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}

                {outcome ? (
                    <p className="body-md text-on-surface bg-surface-container rounded-lg px-4 py-3" role="status">
                        {outcome === 'accepted' ? t('realEstate.offers.vendor.acceptedMsg') : t('realEstate.offers.vendor.declinedMsg')}
                    </p>
                ) : canRespond ? (
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            disabled={busy !== null}
                            onClick={() => respond('accept')}
                            className="flex-1 px-5 py-3 bg-primary text-on-primary rounded-lg hover:bg-primary-container transition-colors disabled:opacity-50"
                        >
                            {t('realEstate.offers.vendor.accept')}
                        </button>
                        <button
                            disabled={busy !== null}
                            onClick={() => respond('reject')}
                            className="flex-1 px-5 py-3 bg-surface-container-high text-on-surface rounded-lg hover:bg-surface-container-highest transition-colors disabled:opacity-50"
                        >
                            {t('realEstate.offers.vendor.decline')}
                        </button>
                    </div>
                ) : (
                    <p className="body-md text-on-surface-variant">{t('realEstate.offers.vendor.closedMsg')}</p>
                )}
            </div>
        </main>
    );
}
