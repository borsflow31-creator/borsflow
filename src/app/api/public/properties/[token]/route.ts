/**
 * Public listing data. No session: the token is the credential, and an unpublished,
 * sold or withdrawn property is indistinguishable from a missing one.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { consumeRateLimits, rateLimitedResponse } from '@/lib/api/rate-limit'
import { LISTING_VIEW_RATE_LIMIT } from '@/lib/crm/public-links'
import { loadPublicListing } from '@/lib/crm/public-listing'

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const limit = await consumeRateLimits([{ subject: `listing-token:${params.token}`, rule: LISTING_VIEW_RATE_LIMIT }])
    if (!limit.allowed) return rateLimitedResponse(limit, 1)

    const listing = await loadPublicListing(params.token)
    if (!listing) return NextResponse.json({ error: 'This listing is no longer available' }, { status: 404 })
    return NextResponse.json({ listing })
  } catch (error) {
    console.error('Error fetching public listing:', error)
    return NextResponse.json({ error: 'Failed to load this listing' }, { status: 500 })
  }
}
