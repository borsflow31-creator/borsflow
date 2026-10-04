import type { Metadata } from 'next'

/**
 * Tokenised document shares.
 *
 * The token is the only access control, so an indexed share URL is a leak
 * rather than a listing.
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
