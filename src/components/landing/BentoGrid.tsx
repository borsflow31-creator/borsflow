'use client'

import React from 'react'
import { Boxes, Calendar, Mail, Users } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'

export const BentoGrid = () => {
    const { t } = useI18n()

    /* Architecture facts, kept as a definition list rather than a fourth row of
       cards. The compliance, uptime and audit-trail assertions this section once
       carried had nothing behind them and were removed. */
    const FOUNDATIONS: { term: string; detail: string }[] = [
        { term: t('landing.bentoGrid.foundationPostgresTerm'), detail: t('landing.bentoGrid.foundationPostgresDetail') },
        { term: t('landing.bentoGrid.foundationAuthTerm'), detail: t('landing.bentoGrid.foundationAuthDetail') },
        {
            term: t('landing.bentoGrid.foundationSecretsTerm'),
            detail: t('landing.bentoGrid.foundationSecretsDetail'),
        },
        { term: t('landing.bentoGrid.foundationPermissionsTerm'), detail: t('landing.bentoGrid.foundationPermissionsDetail') },
    ]

    return (
        <section id="features" className="py-16 sm:py-24 scroll-mt-24">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
                <div className="max-w-3xl">
                    <h2 className="font-display t-h2 text-[var(--n-text)]">
                        {t('landing.bentoGrid.heading')}
                    </h2>
                    <p className="mt-5 t-lead measure text-[var(--n-muted)]">
                        {t('landing.bentoGrid.lead')}
                    </p>
                </div>

                <div className="mt-14 grid grid-cols-1 lg:grid-cols-6 gap-5">
                    <article id="crm" className="taste-plinth lg:col-span-3 p-6 sm:p-8 scroll-mt-24">
                        <Users className="w-5 h-5 text-[var(--n-emerald)]" aria-hidden="true" />
                        <h3 className="mt-4 font-display t-h3 text-[var(--n-text)]">{t('landing.bentoGrid.crmTitle')}</h3>
                        <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                            {t('landing.bentoGrid.crmBody')}
                        </p>
                    </article>

                    <article className="taste-plinth lg:col-span-3 p-6 sm:p-8">
                        <Mail className="w-5 h-5 text-[var(--n-emerald)]" aria-hidden="true" />
                        <h3 className="mt-4 font-display t-h3 text-[var(--n-text)]">{t('landing.bentoGrid.emailTitle')}</h3>
                        <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                            {t('landing.bentoGrid.emailBody')}
                        </p>
                    </article>

                    <article className="taste-plinth lg:col-span-2 p-6 sm:p-8">
                        <Calendar className="w-5 h-5 text-[var(--n-emerald)]" aria-hidden="true" />
                        <h3 className="mt-4 font-display t-h3 text-[var(--n-text)]">{t('landing.bentoGrid.meetingsTitle')}</h3>
                        <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                            {t('landing.bentoGrid.meetingsBody')}
                        </p>
                    </article>

                    <article className="taste-plinth lg:col-span-2 p-6 sm:p-8">
                        <Boxes className="w-5 h-5 text-[var(--n-emerald)]" aria-hidden="true" />
                        <h3 className="mt-4 font-display t-h3 text-[var(--n-text)]">{t('landing.bentoGrid.catalogTitle')}</h3>
                        <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                            {t('landing.bentoGrid.catalogBody')}
                        </p>
                    </article>

                    {/* Bare material on the page ground, deliberately without a
                        plinth, so the row reads as a change of surface. */}
                    <div className="lg:col-span-2 self-start">
                        <h3 className="pb-3 border-b border-[var(--n-border-strong)] text-xs font-medium uppercase tracking-wider text-[var(--n-text)]">
                            {t('landing.bentoGrid.underneathHeading')}
                        </h3>
                        <dl className="grid grid-cols-1 gap-x-8">
                        {FOUNDATIONS.map(({ term, detail }) => (
                            <div key={term} className="py-3.5 border-b border-[var(--n-border)]">
                                <dt className="text-xs font-medium text-[var(--n-text)]">{term}</dt>
                                <dd className="mt-1 text-xs leading-relaxed text-[var(--n-muted)]">{detail}</dd>
                            </div>
                            ))}
                        </dl>
                    </div>
                </div>
            </div>
        </section>
    )
}
