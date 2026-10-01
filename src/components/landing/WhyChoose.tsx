'use client'

import React from 'react'
import { Check, X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'

export const WhyChoose = () => {
    const { t } = useI18n()

    /* No prices and no claims about other products: the argument is the seam that
       opens between any five tools, which is verifiable by anyone who has run one. */
    const SEAMS: string[] = [
        t('landing.whyChoose.seam1'),
        t('landing.whyChoose.seam2'),
        t('landing.whyChoose.seam3'),
        t('landing.whyChoose.seam4'),
    ]

    const JOINS: string[] = [
        t('landing.whyChoose.join1'),
        t('landing.whyChoose.join2'),
        t('landing.whyChoose.join3'),
        t('landing.whyChoose.join4'),
    ]

    return (
        <section id="comparison" className="py-16 sm:py-24 scroll-mt-24 border-t border-[var(--n-border)]">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
                <div className="max-w-3xl">
                    <h2 className="font-display t-h2 text-[var(--n-text)]">
                        {t('landing.whyChoose.heading')}
                    </h2>
                    <p className="mt-5 t-lead measure text-[var(--n-muted)]">
                        {t('landing.whyChoose.lead')}
                    </p>
                </div>

                <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
                    {/* Five tools */}
                    <div>
                        <h3 className="pb-4 border-b border-[var(--n-border-strong)] text-xs font-medium uppercase tracking-wider text-[var(--n-muted)]">
                            {t('landing.whyChoose.fiveToolsHeading')}
                        </h3>
                        <dl>
                            {SEAMS.map((seam) => (
                                <div key={seam} className="flex items-start gap-2.5 py-3 border-b border-[var(--n-border)]">
                                    <X className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--n-muted)]" aria-hidden="true" />
                                    <dt className="text-sm text-[var(--n-muted)]">{seam}</dt>
                                </div>
                            ))}
                        </dl>
                    </div>

                    {/* One workspace */}
                    <div>
                        <h3 className="pb-4 border-b border-[var(--n-border-strong)] text-xs font-medium uppercase tracking-wider text-[var(--n-text)]">
                            {t('landing.whyChoose.oneWorkspaceHeading')}
                        </h3>
                        <dl>
                            {JOINS.map((join) => (
                                <div key={join} className="flex items-start gap-2.5 py-3 border-b border-[var(--n-border)]">
                                    <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--n-emerald)]" aria-hidden="true" />
                                    <dt className="text-sm text-[var(--n-text)]">{join}</dt>
                                </div>
                            ))}
                        </dl>
                    </div>
                </div>
            </div>
        </section>
    )
}
