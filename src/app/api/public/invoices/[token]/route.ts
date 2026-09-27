/**
 * Public invoice view — no session required, keyed on the share token.
 *
 * Only the fields in PUBLIC_INVOICE_SELECT are returned; `internalNotes` in
 * particular must never reach a client, and the authenticated GET returns it.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PUBLIC_INVOICE_SELECT, markPublicView } from '@/lib/documents/share';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { publicToken: params.token },
      select: {
        ...PUBLIC_INVOICE_SELECT,
        // For the view stamp below, not returned to the client.
        id: true,
        viewedAt: true,
      },
    });

    // A bad or revoked token is indistinguishable from a missing document.
    if (!invoice) {
      return NextResponse.json({ error: 'This link is no longer valid' }, { status: 404 });
    }

    await markPublicView('invoice', invoice.id, {
      status: invoice.status,
      viewedAt: invoice.viewedAt,
    });

    const { id, viewedAt, ...publicInvoice } = invoice;

    return NextResponse.json({
      invoice: publicInvoice,
      // A paid or cancelled invoice should not offer a payment button.
      canPay:
        Boolean(invoice.stripePaymentLink) &&
        invoice.amountDue > 0 &&
        !['paid', 'cancelled'].includes(invoice.status),
    });
  } catch (error) {
    console.error('Error loading public invoice:', error);
    return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 });
  }
}
