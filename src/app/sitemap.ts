import type { MetadataRoute } from 'next'
import { CONTENT_UPDATED, siteUrl } from '@/lib/seo/site'
import { LOCALES, localePath, type MarketingPath } from '@/lib/seo/locales'
import { prisma } from '@/lib/prisma'

// Listings come from the database, so the sitemap is built per request rather than at
// build time (when there may be no database to ask).
export const dynamic = 'force-dynamic'

/**
 * Every page a visitor can reach without an account, in every language it is
 * published in. Anything else needs a session or a share token, so listing it
 * would only hand crawlers redirects and 404s.
 *
 * The two marketing pages are listed once per locale. hreflang in each page's
 * `alternates` is what groups them; the sitemap just has to make all ten
 * discoverable.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const base = siteUrl()

    const marketing: { path: MarketingPath; priority: number }[] = [
        { path: '/', priority: 1 },
        { path: '/pricing', priority: 0.8 },
    ]

    const translated = marketing.flatMap(({ path, priority }) =>
        LOCALES.map((locale) => ({
            url: `${base}${localePath(locale, path)}`,
            lastModified: CONTENT_UPDATED,
            changeFrequency: (path === '/' ? 'weekly' : 'monthly') as 'weekly' | 'monthly',
            // English is the primary page; a translation should not outrank it
            // for the same query when both are eligible.
            priority: locale === 'en' ? priority : priority - 0.2,
        })),
    )

    // Published listings that are on the market: finding the home is how a buyer
    // arrives, so each is a page worth indexing. A sold or withdrawn one drops out the
    // moment it stops being public.
    let listings: MetadataRoute.Sitemap = []
    try {
        const rows = await prisma.property.findMany({
            where: { isPublished: true, publicToken: { not: null }, status: { in: ['live', 'under_offer'] } },
            select: { publicToken: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
            take: 5000,
        })
        listings = rows.map((r) => ({
            url: `${base}/listings/${r.publicToken}`,
            lastModified: r.updatedAt,
            changeFrequency: 'weekly' as const,
            priority: 0.6,
        }))
    } catch (error) {
        // A missing database must not take the marketing pages out of the sitemap.
        console.error('[sitemap] could not load listings:', error)
    }

    return [
        ...translated,
        ...listings,
        {
            url: `${base}/register`,
            lastModified: CONTENT_UPDATED,
            changeFrequency: 'yearly',
            priority: 0.5,
        },
        {
            url: `${base}/login`,
            lastModified: CONTENT_UPDATED,
            changeFrequency: 'yearly',
            priority: 0.3,
        },
    ]
}
