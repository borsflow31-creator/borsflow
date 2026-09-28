import React from 'react'
import Link from 'next/link'
import { Layers } from 'lucide-react'
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

/* Anchors rather than routes: every product page is behind the auth
   middleware, so a visitor clicking one would be bounced to sign-in. */
const PRODUCT_LINKS = [
    { label: 'Pipeline', href: '#features' },
    { label: 'Documents', href: '#editor' },
    { label: 'How it works', href: '#journey' },
    { label: 'Assistant', href: '#assistant' },
    { label: 'Roles and team', href: '#team' },
    { label: 'Quotes and invoices', href: '#financials' },
    { label: 'Pricing', href: '/pricing' },
]

const STACK_LINES = [
    'Next.js 14 App Router',
    'PostgreSQL via Prisma',
    'NextAuth sessions',
    'Stripe payments and Connect',
    'Google Calendar, Cal.com, Zoom',
]

export default function Home() {
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-10 sm:gap-12">
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
                                Documents, pipeline, quotes, invoices, email and scheduling on one database. Stop
                                retyping the same deal into five tools.
                            </p>
                        </div>

                        <nav aria-labelledby="footer-product">
                            <h2
                                id="footer-product"
                                className="text-xs font-semibold uppercase tracking-wider text-[var(--n-text)]"
                            >
                                Product
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

                        <div>
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--n-text)]">
                                Built with
                            </h2>
                            <ul className="mt-4 flex flex-col gap-2.5">
                                {STACK_LINES.map((line) => (
                                    <li key={line} className="text-xs text-[var(--n-muted)]">
                                        {line}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="mt-14 pt-8 border-t border-[var(--n-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-xs text-[var(--n-muted)]">&copy; 2026 BorsFlow</p>
                        <div className="flex items-center gap-6">
                            <Link
                                href="/login"
                                className="text-xs text-[var(--n-muted)] hover:text-[var(--n-text)] transition-colors"
                            >
                                Sign in
                            </Link>
                            <Link
                                href="/register"
                                className="text-xs text-[var(--n-muted)] hover:text-[var(--n-text)] transition-colors"
                            >
                                Create a workspace
                            </Link>
                        </div>
                    </div>
                </div>
            </footer>
        </main>
    )
}
