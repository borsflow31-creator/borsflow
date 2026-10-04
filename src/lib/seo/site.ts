/**
 * Where the site lives, and how a page declares its translations.
 *
 * Kept free of the message catalogs on purpose: the root layout imports
 * `siteUrl` for its `metadataBase`, and it should not drag five translation
 * files into that bundle to get one string. The JSON-LD builders that do need
 * the catalogs live in `./graph`.
 */
import type { Locale } from '@/i18n/I18nProvider'
import { LOCALES, localePath, type MarketingPath } from './locales'

/**
 * The public origin, no trailing slash. Builds on the precedence
 * `src/lib/email.ts` uses, with one addition: the Vercel production domain
 * comes *before* NEXTAUTH_URL.
 *
 * On a preview deployment NEXTAUTH_URL is the preview domain, and a canonical
 * or a sitemap built from that points search engines at a throwaway host —
 * which is how a preview deploy ends up competing with production in the
 * index. `VERCEL_PROJECT_PRODUCTION_URL` is the stable production hostname on
 * every deployment, preview included, so it is the safer middle fallback.
 */
export function siteUrl(): string {
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
    const configured =
        process.env.NEXT_PUBLIC_APP_URL ||
        (vercel ? `https://${vercel}` : undefined) ||
        process.env.NEXTAUTH_URL
    return (configured || 'http://localhost:3000').replace(/\/$/, '')
}

/**
 * Last meaningful change to the marketing copy. Bump it when the landing or
 * pricing wording changes — not on every deploy.
 *
 * A `lastmod` of "now" on every page at every build is a well-known way to
 * teach a crawler to ignore the field, which is worse than omitting it.
 */
export const CONTENT_UPDATED = '2026-10-03'

/**
 * `alternates` for one page in one language: its own canonical plus an
 * hreflang pointing at each translation.
 *
 * Every language's block has to list every language, itself included, or
 * Google treats the cluster as unconfirmed and keeps whichever page it likes.
 * `x-default` is English, as the fallback for a visitor whose language we do
 * not publish. Next resolves these against `metadataBase`, so the relative
 * paths come out absolute — which hreflang requires.
 */
export function localeAlternates(locale: Locale, path: MarketingPath) {
    const languages: Record<string, string> = {}
    for (const l of LOCALES) languages[l] = localePath(l, path)
    languages['x-default'] = localePath('en', path)
    return { canonical: localePath(locale, path), languages }
}
