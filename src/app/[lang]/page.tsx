import type { Metadata } from 'next'
import { LandingPage } from '@/components/landing/LandingPage'
import { JsonLd } from '@/components/seo/JsonLd'
import { homeGraph, pageMeta } from '@/lib/seo/graph'
import { localeAlternates } from '@/lib/seo/site'
import type { PrefixedLocale } from '@/i18n/marketing-catalog'

/* The landing page in one of the four translated languages. Same component as
   the English page — the language comes from the LocaleBoundary in the layout,
   so there is no second copy of the page to keep in step. */
export async function generateMetadata({
    params,
}: {
    params: { lang: string }
}): Promise<Metadata> {
    const lang = params.lang as PrefixedLocale
    const { title, description } = pageMeta(lang, '/')
    return {
        title,
        description,
        alternates: localeAlternates(lang, '/'),
        openGraph: { type: 'website', url: localeAlternates(lang, '/').canonical, title, description },
    }
}

export default function LocalisedHome({ params }: { params: { lang: string } }) {
    const lang = params.lang as PrefixedLocale
    return (
        <>
            <JsonLd data={homeGraph(lang)} />
            <LandingPage />
        </>
    )
}
