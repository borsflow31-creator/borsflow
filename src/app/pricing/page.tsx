import type { Metadata } from 'next'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { PricingSection } from '@/components/landing/PricingSection'
import { FinalCTA } from '@/components/landing/FinalCTA'
import { JsonLd } from '@/components/seo/JsonLd'
import { pricingGraph } from '@/lib/seo/graph'
import { localeAlternates } from '@/lib/seo/site'

/* The title drops the brand suffix the root layout's template already adds,
   so the tab and the result snippet read "Pricing · BorsFlow" once rather
   than twice. */
export const metadata: Metadata = {
    title: 'Pricing',
    description:
        'Flat pricing per workspace with AI included. Free for teams of up to 5 during the open beta; paid plans coming soon.',
    alternates: localeAlternates('en', '/pricing'),
    openGraph: {
        type: 'website',
        url: '/pricing',
        title: 'Pricing · BorsFlow',
        description:
            'Flat pricing per workspace with AI included. Free for teams of up to 5 during the open beta.',
    },
}

export default function PricingPage() {
    return (
        <main className="landing-surface min-h-screen bg-[var(--n-base)] text-[var(--n-text)]">
            <JsonLd data={pricingGraph('en')} />
            <LandingHeader />
            {/* The fixed header overlaps the first section, so push it down. */}
            <div className="pt-16">
                <PricingSection headingLevel="h1" />
            </div>
            <FinalCTA />
        </main>
    )
}
