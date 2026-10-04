import { notFound } from 'next/navigation'
import { LocaleBoundary } from '@/components/i18n/LocaleBoundary'
import { marketingCatalog, type PrefixedLocale } from '@/i18n/marketing-catalog'
import { PREFIXED_LOCALES } from '@/lib/seo/locales'

/**
 * The translated marketing surface: /fr, /es, /de, /ar and their /pricing.
 *
 * `dynamicParams = false` is the load-bearing line. Without it this dynamic
 * segment would answer *any* unmatched single-segment path — /foo, /careers,
 * a typo in somebody's link — by serving the landing page under a nonsense
 * address. That is a crawl trap and an endless supply of duplicate pages.
 * With it, anything outside `generateStaticParams` is a 404, which is what it
 * should be. Existing static routes such as /pricing and /login still win on
 * their own, because a literal segment always outranks a dynamic one.
 */
export const dynamicParams = false

export function generateStaticParams() {
    return PREFIXED_LOCALES.map((lang) => ({ lang }))
}

export default async function LangLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: { lang: string }
}) {
    // Belt and braces: dynamicParams already rules out anything unlisted, but
    // this keeps the cast below honest rather than assumed.
    if (!(PREFIXED_LOCALES as readonly string[]).includes(params.lang)) notFound()
    const lang = params.lang as PrefixedLocale

    return (
        <LocaleBoundary locale={lang} catalog={await marketingCatalog(lang)}>
            {children}
        </LocaleBoundary>
    )
}
