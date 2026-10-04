/**
 * The feed a portal fetches. The token is the credential: no session, and an unknown,
 * rotated or deactivated feed is indistinguishable from a missing one.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { consumeRateLimits, rateLimitedResponse } from '@/lib/api/rate-limit'
import { PORTAL_FEED_RATE_LIMIT } from '@/lib/crm/public-links'
import { renderPortalFeed } from '@/lib/crm/portal-feed'

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const limit = await consumeRateLimits([{ subject: `portal-feed:${params.token}`, rule: PORTAL_FEED_RATE_LIMIT }])
    if (!limit.allowed) return rateLimitedResponse(limit, 1)

    const feed = await prisma.portalFeed.findUnique({ where: { token: params.token } })
    if (!feed || !feed.isActive) return NextResponse.json({ error: 'This feed is not available' }, { status: 404 })

    const { body, contentType, count } = await renderPortalFeed(feed)
    await prisma.portalFeed.update({ where: { id: feed.id }, data: { lastFetchedAt: new Date(), fetchCount: { increment: 1 } } })

    return new NextResponse(body, {
      headers: { 'Content-Type': contentType, 'X-Listing-Count': String(count), 'Cache-Control': 'private, max-age=60' },
    })
  } catch (error) {
    console.error('Error rendering portal feed:', error)
    return NextResponse.json({ error: 'Failed to build this feed' }, { status: 500 })
  }
}
