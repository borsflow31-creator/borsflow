'use client'

import React from 'react'
import { I18nProvider, type Locale } from '@/i18n/I18nProvider'
import type { MarketingCatalog } from '@/i18n/marketing-catalog'

/**
 * Re-opens the i18n context inside a locale-prefixed route, pinned to the
 * language the URL names.
 *
 * The root provider resolves language from `localStorage`, which is right for
 * the app — a signed-in user's preference should follow them — but wrong for a
 * page whose address *is* the language claim. React context resolves to the
 * nearest provider, so nesting one here overrides the root for this subtree
 * only, and nothing about the app's behaviour changes.
 */
export function LocaleBoundary({
    locale,
    catalog,
    children,
}: {
    locale: Locale
    catalog: MarketingCatalog
    children: React.ReactNode
}) {
    return (
        <I18nProvider initialLocale={locale} initialCatalog={catalog}>
            {children}
        </I18nProvider>
    )
}
