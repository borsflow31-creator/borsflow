import type { Metadata } from 'next'

/**
 * Workspace invitation acceptance.
 *
 * A one-time link tied to one recipient; indexing it serves nobody and
 * exposes the workspace name.
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
