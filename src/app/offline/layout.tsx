import type { Metadata } from 'next'

/**
 * The PWA offline fallback.
 *
 * Served from the service worker cache when the network is gone, so it is
 * not a page anyone should arrive at from search.
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
