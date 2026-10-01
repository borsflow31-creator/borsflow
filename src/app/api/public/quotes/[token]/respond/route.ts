/**
 * Client accept / reject for a publicly shared quote.
 *
 * This is the only path that writes `acceptedAt` other than quote conversion, and
 * the only one that has ever written `rejectedAt`.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { QUOTE_RESPONSE_RATE_LIMIT } from '@/lib/documents/share';
import { consumeRateLimits, rateLimitedResponse } from '@/lib/api/rate-limit';
import { notify } from '@/lib/notifications/notify';
import { workspaceAdminIds } from '@/lib/notifications/recipients';

/** A decision is final; these statuses have already reached one, or timed out. */
const DECIDED = ['accepted', 'rejected', 'expired'];

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const { decision } = body;

    if (decision !== 'accept' && decision !== 'reject') {
      return NextResponse.json(
        { error: "Decision must be either 'accept' or 'reject'" },
        { status: 400 }
      );
    }

    // The endpoint is unauthenticated, so it is limited per token to keep a leaked
    // link from being used to hammer the database.
    const limit = await consumeRateLimits([
      { subject: `quote-token:${params.token}`, rule: QUOTE_RESPONSE_RATE_LIMIT },
    ]);
    if (!limit.allowed) {
      return rateLimitedResponse(limit, 1);
    }

    const quote = await prisma.quote.findUnique({
      where: { publicToken: params.token },
      select: { id: true, status: true, validUntil: true, workspaceId: true, quoteNumber: true, clientName: true, createdById: true },
    });

    if (!quote) {
      return NextResponse.json({ error: 'This link is no longer valid' }, { status: 404 });
    }

    if (DECIDED.includes(quote.status)) {
      return NextResponse.json(
        { error: `This quote has already been ${quote.status}` },
        { status: 409 }
      );
    }

    // The expiry sweep runs hourly, so a quote can be past its date and still
    // marked `sent`. Check the date rather than trusting the status alone.
    if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
      await prisma.quote.update({ where: { id: quote.id }, data: { status: 'expired' } });
      return NextResponse.json({ error: 'This quote has expired' }, { status: 409 });
    }

    const accepted = decision === 'accept';
    const now = new Date();

    await prisma.quote.update({
      where: { id: quote.id },
      data: accepted
        ? { status: 'accepted', acceptedAt: now }
        : { status: 'rejected', rejectedAt: now },
    });

    const admins = await workspaceAdminIds(quote.workspaceId);
    void notify({
      recipients: Array.from(new Set([...(quote.createdById ? [quote.createdById] : []), ...admins])),
      type: accepted ? 'sales.quote_accepted' : 'sales.quote_rejected',
      workspaceId: quote.workspaceId,
      title: `${quote.clientName} ${accepted ? 'accepted' : 'rejected'} quote ${quote.quoteNumber}`,
      href: `/quotes/${quote.id}`,
      dedupeKey: `quote.${accepted ? 'accepted' : 'rejected'}:${quote.id}`,
    });

    return NextResponse.json({
      status: accepted ? 'accepted' : 'rejected',
      respondedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Error recording quote response:', error);
    return NextResponse.json({ error: 'Failed to record your response' }, { status: 500 });
  }
}
