import type { Metadata } from 'next'
import { LandingPage } from '@/components/landing/LandingPage'
import { JsonLd } from '@/components/seo/JsonLd'
import { homeGraph } from '@/lib/seo/graph'
import { localeAlternates } from '@/lib/seo/site'

/* A server shell around the client landing page: the body needs hooks, but the
   canonical URL, the hreflang set and the structured data all have to be
   emitted server-side, and a 'use client' module cannot export `metadata`.

   This is the English page. Its translations live at /[lang], and the
   `alternates` here are what tells a crawler the five of them are one page. */
export const metadata: Metadata = {
    alternates: localeAlternates('en', '/'),
}

export default function Home() {
    return (
        <>
            <JsonLd data={homeGraph('en')} />
            <LandingPage />
        </>
    )
}
