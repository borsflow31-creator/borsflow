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
import { notify } from '@/lib/notifications/notify';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { publicToken: params.token },
      select: {
        ...PUBLIC_INVOICE_SELECT,
        // For the view stamp and the notification below, not returned to the client.
        id: true,
        viewedAt: true,
        workspaceId: true,
        createdById: true,
      },
    });

    // A bad or revoked token is indistinguishable from a missing document.
    if (!invoice) {
      return NextResponse.json({ error: 'This link is no longer valid' }, { status: 404 });
    }

    const { firstView } = await markPublicView('invoice', invoice.id, {
      status: invoice.status,
      viewedAt: invoice.viewedAt,
    });

    if (firstView && invoice.createdById) {
      void notify({
        recipients: [invoice.createdById],
        type: 'sales.invoice_viewed',
        workspaceId: invoice.workspaceId,
        title: `${invoice.clientName} viewed invoice ${invoice.invoiceNumber}`,
        href: `/invoices/${invoice.id}`,
        dedupeKey: `invoice.viewed:${invoice.id}`,
      });
    }

    const { id, viewedAt, workspaceId, createdById, ...publicInvoice } = invoice;

    return NextResponse.json({ invoice: publicInvoice });
  } catch (error) {
    console.error('Error loading public invoice:', error);
    return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 });
  }
}
