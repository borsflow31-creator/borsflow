import type { Metadata } from 'next'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { PricingSection } from '@/components/landing/PricingSection'
import { FinalCTA } from '@/components/landing/FinalCTA'
import { JsonLd } from '@/components/seo/JsonLd'
import { pricingGraph, pageMeta } from '@/lib/seo/graph'
import { localeAlternates } from '@/lib/seo/site'
import type { PrefixedLocale } from '@/i18n/marketing-catalog'

export async function generateMetadata({
    params,
}: {
    params: { lang: string }
}): Promise<Metadata> {
    const lang = params.lang as PrefixedLocale
    const { title, description } = pageMeta(lang, '/pricing')
    return {
        title,
        description,
        alternates: localeAlternates(lang, '/pricing'),
        openGraph: {
            type: 'website',
            url: localeAlternates(lang, '/pricing').canonical,
            title,
            description,
        },
    }
}

export default function LocalisedPricing({ params }: { params: { lang: string } }) {
    const lang = params.lang as PrefixedLocale
    return (
        <main className="landing-surface min-h-screen bg-[var(--n-base)] text-[var(--n-text)]">
            <JsonLd data={pricingGraph(lang)} />
            <LandingHeader />
            {/* The fixed header overlaps the first section, so push it down. */}
            <div className="pt-16">
                <PricingSection headingLevel="h1" />
            </div>
            <FinalCTA />
        </main>
    )
}
