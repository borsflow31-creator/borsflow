import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo/site'

/**
 * Only the marketing surface is crawlable. Everything else is either behind
 * the auth middleware, a tokenised share link, or an API route, and none of it
 * belongs in an index.
 *
 * Disallow stops the crawl; it does not stop a URL that was discovered
 * elsewhere from being listed. The share and invitation routes are emailed
 * around, so they also carry a `noindex` header of their own via their layouts.
 */
export default function robots(): MetadataRoute.Robots {
    const base = siteUrl()

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/api/',
                    '/crm',
                    '/dashboard',
                    '/email-marketing',
                    '/invitations/',
                    '/invoices',
                    '/kanban-board-view',
                    '/mandates',
                    '/meetings',
                    '/offers',
                    '/commissions',
                    '/portals',
                    '/offline',
                    '/pages',
                    '/products',
                    '/properties',
                    '/quotes',
                    '/settings',
                    '/share/',
                    '/templates',
                    '/verify-email',
                    '/viewings',
                    '/view/',
                    '/workspaces',
                ],
            },
        ],
        sitemap: `${base}/sitemap.xml`,
        host: base,
    }
}
