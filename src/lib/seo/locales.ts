/**
 * Which languages the marketing pages are published in, and where each
 * translation lives.
 *
 * Pure path arithmetic with no environment access, so the language switcher
 * can import it into the client bundle without dragging server-only origin
 * resolution along with it.
 */
import type { Locale } from '@/i18n/I18nProvider'

/** Every language the marketing pages are published in. `satisfies` keeps this
    list honest against the `Locale` union rather than drifting from it. */
export const LOCALES = ['en', 'fr', 'es', 'de', 'ar'] as const satisfies readonly Locale[]

/**
 * English is served unprefixed, so only these four get a `/xx` route.
 *
 * Prefixing English too would be tidier, but it would move the homepage and
 * the pricing page to new URLs and throw away whatever they have already
 * earned. The asymmetry is the cheaper trade.
 */
export const PREFIXED_LOCALES = LOCALES.filter((l) => l !== 'en')

/** Locales a prefixed route has to paint right-to-left. */
export const RTL_LOCALES: readonly Locale[] = ['ar']

/** The marketing pages that exist in every language. */
export type MarketingPath = '/' | '/pricing'

/** The path a page lives at in a given language. */
export function localePath(locale: Locale, path: MarketingPath): string {
    const prefix = locale === 'en' ? '' : `/${locale}`
    return path === '/' ? prefix || '/' : `${prefix}${path}`
}

/**
 * The address the current page has in another language, or `null` when this
 * path is not a marketing page.
 *
 * The app itself keeps its stored-preference behaviour — those routes are
 * behind auth and have no business being crawled in five languages — so the
 * switcher only navigates when there is somewhere to navigate to.
 */
export function marketingHref(pathname: string, locale: Locale): string | null {
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length && (PREFIXED_LOCALES as readonly string[]).includes(segments[0])) {
        segments.shift()
    }
    const rest = `/${segments.join('/')}`
    if (rest === '/') return localePath(locale, '/')
    if (rest === '/pricing') return localePath(locale, '/pricing')
    return null
}
