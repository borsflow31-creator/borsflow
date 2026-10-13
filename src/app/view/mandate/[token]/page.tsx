'use client';

/**
 * Public vendor report. Outside the middleware matcher, so no session is needed:
 * the vendor opens it from the link in their update email. Names no buyer.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { VERDICT_DIMENSIONS } from '@/lib/crm/lifecycle';
import type { VendorReport } from '@/lib/crm/vendor-report';
import { DEFAULT_CURRENCY } from '@/lib/currencies';

export default function PublicVendorReportPage() {
    const { t, formatCurrency, formatDate } = useI18n();
    const { token } = useParams<{ token: string }>();
    const [report, setReport] = useState<VendorReport | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/public/mandates/${token}`)
            .then(async res => {
                if (!res.ok) throw new Error(res.status === 404 ? t('realEstate.vendorReport.invalid') : t('realEstate.vendorReport.failed'));
                return res.json();
            })
            .then(data => setReport(data.report))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [token, t]);

    if (loading) return <main className="min-h-screen flex items-center justify-center bg-background"><div className="skeleton w-80 h-48 rounded-lg" /></main>;
    if (!report) {
        return <main className="min-h-screen flex items-center justify-center bg-background p-6"><p className="title-md text-on-surface">{error}</p></main>;
    }

    const currency = report.property.currency || DEFAULT_CURRENCY;
    const stat = (label: string, value: string | number) => (
        <div className="bg-surface-container rounded-lg p-4">
            <p className="body-sm text-on-surface-variant">{label}</p>
            <p className="headline-md text-on-surface">{value}</p>
        </div>
    );

    return (
        <main className="min-h-screen bg-background p-4 sm:p-8">
            <div className="max-w-3xl mx-auto bg-surface rounded-xl shadow-md p-6 sm:p-8 space-y-8">
                <header>
                    <p className="body-sm text-on-surface-variant">{report.agency}</p>
                    <h1 className="headline-lg text-on-surface">{report.property.title}</h1>
                    <p className="body-md text-on-surface-variant">
                        {report.property.city} · {report.mandate.reference} · {t('realEstate.vendorReport.updated', { date: formatDate(report.generatedAt) })}
                    </p>
                </header>

                <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {stat(t('realEstate.vendorReport.askingPrice'), formatCurrency(report.property.price, currency))}
                    {stat(t('realEstate.vendorReport.daysOnMarket'), report.property.daysOnMarket ?? '—')}
                    {stat(t('realEstate.vendorReport.enquiries'), report.enquiries)}
                    {stat(t('realEstate.vendorReport.viewings'), report.viewings.total)}
                </section>

                <section>
                    <h2 className="title-md text-on-surface mb-3">{t('realEstate.vendorReport.offers')}</h2>
                    <p className="body-md text-on-surface">
                        {report.offers.total === 0
                            ? t('realEstate.vendorReport.noOffers')
                            : t('realEstate.vendorReport.offersSummary', {
                                  count: report.offers.total,
                                  highest: report.offers.highest !== null ? formatCurrency(report.offers.highest, currency) : '—',
                              })}
                    </p>
                </section>

                <section>
                    <h2 className="title-md text-on-surface mb-3">{t('realEstate.vendorReport.feedback')}</h2>
                    {report.viewings.withFeedback === 0 ? (
                        <p className="body-md text-on-surface-variant">{t('realEstate.vendorReport.noFeedback')}</p>
                    ) : (
                        <>
                            <p className="body-sm text-on-surface-variant mb-3">
                                {t('realEstate.vendorReport.feedbackIntro', { count: report.viewings.withFeedback })}
                                {report.viewings.averageInterest !== null && ` · ${t('realEstate.vendorReport.averageInterest', { level: report.viewings.averageInterest })}`}
                            </p>
                            <ul className="space-y-2">
                                {VERDICT_DIMENSIONS.map(dim => {
                                    const v = report.feedback[dim];
                                    const total = v.negative + v.neutral + v.positive;
                                    if (total === 0) return null;
                                    return (
                                        <li key={dim} className="flex items-center gap-3">
                                            <span className="w-28 body-sm text-on-surface">{t(`realEstate.viewings.feedback.dimensions.${dim}` as MessageKey)}</span>
                                            <span className="flex-1 flex h-3 rounded overflow-hidden bg-surface-container-high" role="img"
                                                aria-label={`${v.positive} ${t('realEstate.viewings.feedback.verdict.positive')}, ${v.neutral} ${t('realEstate.viewings.feedback.verdict.neutral')}, ${v.negative} ${t('realEstate.viewings.feedback.verdict.negative')}`}>
                                                <span style={{ width: `${(v.positive / total) * 100}%` }} className="bg-emerald-500" />
                                                <span style={{ width: `${(v.neutral / total) * 100}%` }} className="bg-yellow-400" />
                                                <span style={{ width: `${(v.negative / total) * 100}%` }} className="bg-red-500" />
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}
                </section>

                {report.pricePosition && report.pricePosition.percentile !== null && (
                    <section>
                        <h2 className="title-md text-on-surface mb-2">{t('realEstate.vendorReport.pricePosition')}</h2>
                        <p className="body-md text-on-surface">
                            {t('realEstate.vendorReport.pricePositionBody', {
                                percentile: report.pricePosition.percentile,
                                count: report.pricePosition.comparables,
                            })}
                        </p>
                    </section>
                )}

                {report.priceHistory.length > 0 && (
                    <section>
                        <h2 className="title-md text-on-surface mb-2">{t('realEstate.mandates.price.title')}</h2>
                        <ul className="space-y-1">
                            {report.priceHistory.map((c, i) => (
                                <li key={i} className="body-md text-on-surface">
                                    {formatDate(c.changedAt)}: {formatCurrency(c.fromPrice, currency)} → {formatCurrency(c.toPrice, currency)}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </main>
    );
}
