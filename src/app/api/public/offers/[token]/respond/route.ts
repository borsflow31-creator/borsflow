/**
 * Vendor accept / decline for a shared offer.
 *
 * Accepting goes through the same acceptOffer() the agent uses, so a vendor's
 * click rejects the competing offers atomically too. The only difference is who
 * the decision is attributed to: nobody has a session here, so the offer records
 * decidedVia = 'vendor_link', and the activity feed is attributed to the agent
 * holding the listing (Activity requires a user).
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { consumeRateLimits, rateLimitedResponse } from '@/lib/api/rate-limit'
import { OFFER_RESPONSE_RATE_LIMIT } from '@/lib/crm/public-links'
import { acceptOffer, rejectOffer } from '@/lib/services/offers'
import { failure } from '@/lib/api/respond'

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const decision = body?.decision
    if (decision !== 'accept' && decision !== 'reject') {
      return NextResponse.json({ error: "Decision must be either 'accept' or 'reject'" }, { status: 400 })
    }

    // Before the database read: the endpoint is unauthenticated, so it is limited
    // per link to keep a leaked one from being used to hammer it.
    const limit = await consumeRateLimits([{ subject: `offer-token:${params.token}`, rule: OFFER_RESPONSE_RATE_LIMIT }])
    if (!limit.allowed) return rateLimitedResponse(limit, 1)

    const offer = await prisma.offer.findUnique({
      where: { publicToken: params.token },
      select: {
        id: true, status: true, workspaceId: true, expiresAt: true,
        property: { select: { ownerId: true } },
        workspace: { select: { ownerId: true } },
      },
    })
    if (!offer) return NextResponse.json({ error: 'This link is no longer valid' }, { status: 404 })

    if (offer.status !== 'pending') {
      return NextResponse.json({ error: `This offer has already been ${offer.status}` }, { status: 409 })
    }
    if (offer.expiresAt && offer.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'This offer has expired' }, { status: 409 })
    }

    const ctx = { workspaceId: offer.workspaceId, userId: offer.property.ownerId ?? offer.workspace.ownerId }

    if (decision === 'accept') {
      await acceptOffer(offer.id, ctx, 'vendor_link')
    } else {
      await rejectOffer(offer.id, ctx, { via: 'vendor_link', reason: 'declined' })
    }

    return NextResponse.json({
      status: decision === 'accept' ? 'accepted' : 'rejected',
      respondedAt: new Date().toISOString(),
    })
  } catch (error) {
    return failure(error, 'Failed to record your response', 'Error recording offer response')
  }
}
