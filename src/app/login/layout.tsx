import type { Metadata } from 'next'

/* A legitimate destination for a brand search, so it stays indexable — but
   it needs its own title and canonical, or it inherits the homepage's and
   competes with it for the same query. */
export const metadata: Metadata = {
    title: 'Sign in',
    description:
        'Sign in to your BorsFlow workspace to pick up your pipeline, documents, quotes and invoices.',
    alternates: { canonical: '/login' },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
