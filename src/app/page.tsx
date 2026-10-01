'use client'

import React from 'react'
import Link from 'next/link'
import { Layers } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { HeroSection } from '@/components/landing/HeroSection'
import { BentoGrid } from '@/components/landing/BentoGrid'
import { Evidence } from '@/components/landing/Evidence'
import { FourStageJourney } from '@/components/landing/FourStageJourney'
import { AIIntegration } from '@/components/landing/AIIntegration'
import { TeamWorkspace } from '@/components/landing/TeamWorkspace'
import { WhyChoose } from '@/components/landing/WhyChoose'
import { SupportSection } from '@/components/landing/SupportSection'
import { PricingSection } from '@/components/landing/PricingSection'
import { FinalCTA } from '@/components/landing/FinalCTA'

export default function Home() {
    const { t } = useI18n()

    /* Anchors rather than routes: every product page is behind the auth
       middleware, so a visitor clicking one would be bounced to sign-in. */
    const PRODUCT_LINKS = [
        { label: t('landing.footer.linkPipeline'), href: '#features' },
        { label: t('landing.footer.linkDocuments'), href: '#editor' },
        { label: t('landing.footer.linkHowItWorks'), href: '#journey' },
        { label: t('landing.footer.linkAssistant'), href: '#assistant' },
        { label: t('landing.footer.linkRolesTeam'), href: '#team' },
        { label: t('landing.footer.linkQuotesInvoices'), href: '#financials' },
        { label: t('landing.footer.linkPricing'), href: '/pricing' },
    ]

    return (
        <main className="landing-surface min-h-screen bg-[var(--n-base)] text-[var(--n-text)]">
            <LandingHeader />
            <HeroSection />
            <BentoGrid />
            {/* The captures are spread down the scroll rather than stacked
                behind the fold: roughly 10%, 45% and 75% of the page. */}
            <Evidence variant="editor" />
            <FourStageJourney />
            <AIIntegration />
            <TeamWorkspace />
            <Evidence variant="financials" />
            <WhyChoose />
            <PricingSection />
            <SupportSection />
            <FinalCTA />

            <footer className="pt-16 pb-12 border-t border-[var(--n-border)] bg-[var(--n-surface)]/40">
                <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-10 sm:gap-12">
                        <div className="col-span-2">
                            <Link href="/" className="inline-flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-lg bg-[var(--n-text)] text-[var(--n-base)] flex items-center justify-center shadow-xs">
                                    <Layers className="w-4 h-4" aria-hidden="true" />
                                </span>
                                <span className="font-display text-lg font-semibold tracking-tight text-[var(--n-text)]">
                                    BorsFlow
                                </span>
                            </Link>
                            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--n-muted)]">
                                {t('landing.footer.tagline')}
                            </p>
                        </div>

                        <nav aria-labelledby="footer-product">
                            <h2
                                id="footer-product"
                                className="text-xs font-semibold uppercase tracking-wider text-[var(--n-text)]"
                            >
                                {t('landing.footer.productHeading')}
                            </h2>
                            <ul className="mt-4 flex flex-col gap-2.5">
                                {PRODUCT_LINKS.map((item) => (
                                    <li key={item.label}>
                                        <a
                                            href={item.href}
                                            className="text-xs text-[var(--n-muted)] hover:text-[var(--n-text)] transition-colors"
                                        >
                                            {item.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </div>

                    <div className="mt-14 pt-8 border-t border-[var(--n-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-xs text-[var(--n-muted)]">{t('landing.footer.copyright')}</p>
                        <div className="flex items-center gap-6">
                            <Link
                                href="/login"
                                className="text-xs text-[var(--n-muted)] hover:text-[var(--n-text)] transition-colors"
                            >
                                {t('landing.footer.signIn')}
                            </Link>
                            <Link
                                href="/register"
                                className="text-xs text-[var(--n-muted)] hover:text-[var(--n-text)] transition-colors"
                            >
                                {t('landing.footer.createWorkspace')}
                            </Link>
                        </div>
                    </div>
                </div>
            </footer>
        </main>
    )
}
