import type { Metadata } from 'next'
import Link from 'next/link'
import { Layers } from 'lucide-react'

/* Next's built-in 404 is a bare string with no way back, so every mistyped or
   retired URL is a dead end for a visitor and a dead end for a crawler. These
   four links are the entire public surface, which is what makes this page
   worth crawling at all.

   English only, deliberately: a 404 fires at an address that matched no route,
   so there is no locale segment to read and no stored preference on the server
   to read it from. Copy stays out of the catalogs rather than pretending the
   page knows a language it cannot know. */

/* The 404 status is what actually keeps this out of an index. The `noindex` is
   here so the page stops inheriting the root layout's `index, follow` and
   claiming the opposite of what its own status code says. `follow` stays on,
   because the four links below are the point. */
export const metadata: Metadata = {
    title: 'Page not found',
    robots: { index: false, follow: true },
}

const LINKS = [
    { href: '/', label: 'Home' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/register', label: 'Create a workspace' },
    { href: '/login', label: 'Sign in' },
]

export default function NotFound() {
    return (
        <main className="landing-surface min-h-screen bg-[var(--n-base)] text-[var(--n-text)] flex items-center justify-center px-5 py-20">
            <div className="w-full max-w-md text-center">
                <Link href="/" className="inline-flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-[var(--n-text)] text-[var(--n-base)] flex items-center justify-center shadow-xs">
                        <Layers className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <span className="font-display text-lg font-semibold tracking-tight text-[var(--n-text)]">
                        BorsFlow
                    </span>
                </Link>

                <p className="mt-10 t-data text-xs text-[var(--n-muted)]">404</p>
                <h1 className="mt-3 font-display t-sub text-[var(--n-text)]">Page not found</h1>
                <p className="mt-4 text-sm leading-relaxed text-[var(--n-muted)]">
                    The address you followed does not match anything here. It may have moved, or
                    the link may have been mistyped.
                </p>

                <nav aria-labelledby="not-found-links" className="mt-10">
                    <h2
                        id="not-found-links"
                        className="text-xs font-semibold uppercase tracking-wider text-[var(--n-text)]"
                    >
                        Try one of these
                    </h2>
                    <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
                        {LINKS.map((item) => (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className="text-xs text-[var(--n-muted)] hover:text-[var(--n-text)] transition-colors"
                                >
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            </div>
        </main>
    )
}
