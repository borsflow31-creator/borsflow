/**
 * Public, tokenised view of an offer, for the vendor.
 *
 * No session: /api/public is absent from the auth middleware matcher. The token
 * is the whole credential, so a revoked or unknown one is indistinguishable from
 * a missing one.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { consumeRateLimits, rateLimitedResponse } from '@/lib/api/rate-limit'
import { OFFER_VIEW_RATE_LIMIT } from '@/lib/crm/public-links'

/**
 * What a vendor may see. An explicit allow-list: the authenticated offer shape
 * carries the buyer's identity and contact details, internal ids and the agent's
 * notes, and reusing it here would leak every one of them to whoever holds the
 * link. The buyer is deliberately anonymous.
 */
const PUBLIC_OFFER_SELECT = {
  amount: true,
  currency: true,
  status: true,
  offeredAt: true,
  expiresAt: true,
  decidedAt: true,
  conditions: true,
  depositAmount: true,
  financingType: true,
  property: { select: { title: true, reference: true, city: true, price: true, currency: true } },
  workspace: { select: { name: true } },
} as const

const CLOSED = ['accepted', 'rejected', 'withdrawn', 'expired']

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    // Before the database read: the endpoint is unauthenticated.
    const limit = await consumeRateLimits([{ subject: `offer-token:${params.token}`, rule: OFFER_VIEW_RATE_LIMIT }])
    if (!limit.allowed) return rateLimitedResponse(limit, 1)

    const offer = await prisma.offer.findUnique({ where: { publicToken: params.token }, select: PUBLIC_OFFER_SELECT })
    if (!offer) return NextResponse.json({ error: 'This link is no longer valid' }, { status: 404 })

    // A pending offer past its date is expired even if the sweep has not run yet.
    const pastDue = offer.status === 'pending' && offer.expiresAt && offer.expiresAt.getTime() < Date.now()
    const status = pastDue ? 'expired' : offer.status

    return NextResponse.json({ offer: { ...offer, status }, canRespond: !CLOSED.includes(status) })
  } catch (error) {
    console.error('Error fetching public offer:', error)
    return NextResponse.json({ error: 'Failed to load this offer' }, { status: 500 })
  }
}
