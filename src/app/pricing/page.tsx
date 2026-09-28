import type { Metadata } from 'next'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { PricingSection } from '@/components/landing/PricingSection'
import { FinalCTA } from '@/components/landing/FinalCTA'

export const metadata: Metadata = {
    title: 'Pricing - BorsFlow',
    description:
        'Flat pricing per workspace with AI included. Free for teams of up to 5 during the open beta; paid plans coming soon.',
}

export default function PricingPage() {
    return (
        <main className="landing-surface min-h-screen bg-[var(--n-base)] text-[var(--n-text)]">
            <LandingHeader />
            {/* The fixed header overlaps the first section, so push it down. */}
            <div className="pt-16">
                <PricingSection headingLevel="h1" />
            </div>
            <FinalCTA />
        </main>
    )
}
