import type { Metadata } from 'next'

/**
 * Tokenised invoice and quote views.
 *
 * Anyone holding the link can read a customer's document, so these pages
 * must never become search results.
 *
 * robots.txt already stops the crawl, but Disallow does not stop a URL that
 * was discovered elsewhere from being listed — and these URLs travel by
 * email. The header is what keeps them out of an index.
 */
export const metadata: Metadata = {
    robots: { index: false, follow: false, nocache: true },
}

export default function NoIndexLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
