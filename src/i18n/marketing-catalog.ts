import type { Locale } from './I18nProvider'
import type { Messages } from './messages/en'

/**
 * The catalog subtrees a locale-prefixed marketing page hands to the client.
 *
 * A full catalog is ~100 KB, and it would be serialised into the HTML of every
 * translated page to render text the visitor can already see. The landing and
 * pricing pages only read `landing`, plus `common` for a couple of shared
 * labels and `misc` for the language switcher, so only those three cross the
 * boundary. Anything else falls back to English inside the provider, which is
 * the right answer for a page that has no other content.
 */
export type MarketingCatalog = Pick<Messages, 'common' | 'landing' | 'misc'>

/** English is the statically-bundled fallback, so it is not loadable here. */
export type PrefixedLocale = Exclude<Locale, 'en'>

const LOADERS: Record<PrefixedLocale, () => Promise<{ default: Messages }>> = {
    fr: () => import('./messages/fr'),
    es: () => import('./messages/es'),
    de: () => import('./messages/de'),
    ar: () => import('./messages/ar'),
}

export async function marketingCatalog(locale: PrefixedLocale): Promise<MarketingCatalog> {
    const { default: m } = await LOADERS[locale]()
    return { common: m.common, landing: m.landing, misc: m.misc }
}
