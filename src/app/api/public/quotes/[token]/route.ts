/**
 * Public quote view — no session required, keyed on the share token.
 *
 * Only the fields in PUBLIC_QUOTE_SELECT are returned; `internalNotes` in
 * particular must never reach a client, and the authenticated GET returns it.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PUBLIC_QUOTE_SELECT, markPublicView } from '@/lib/documents/share';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { publicToken: params.token },
      select: {
        ...PUBLIC_QUOTE_SELECT,
        // For the view stamp below, not returned to the client.
        id: true,
        viewedAt: true,
      },
    });

    // A bad or revoked token is indistinguishable from a missing document.
    if (!quote) {
      return NextResponse.json({ error: 'This link is no longer valid' }, { status: 404 });
    }

    await markPublicView('quote', quote.id, { status: quote.status, viewedAt: quote.viewedAt });

    const { id, viewedAt, ...publicQuote } = quote;

    return NextResponse.json({
      quote: publicQuote,
      canRespond: !['accepted', 'rejected', 'expired'].includes(quote.status),
    });
  } catch (error) {
    console.error('Error loading public quote:', error);
    return NextResponse.json({ error: 'Failed to load quote' }, { status: 500 });
  }
}
