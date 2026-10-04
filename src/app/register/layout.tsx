import type { Metadata } from 'next'

/* The highest-intent page on the site after the homepage, so it carries its
   own title, description and canonical rather than inheriting the root ones. */
export const metadata: Metadata = {
    title: 'Create your workspace',
    description:
        'Create a free BorsFlow workspace: CRM, documents, scheduling and invoicing for up to five people, with no credit card.',
    alternates: { canonical: '/register' },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
