import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';
import {
  createInvoicePaymentLink,
  deactivatePaymentLink,
  getOrCreateCustomer,
  getStripeForWorkspace,
} from '@/lib/stripe';

// POST /api/invoices/[id]/payment-link
// Tries workspace direct API keys first, falls back to Stripe Connect account.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Verify workspace access — fetch all Stripe-related fields
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: invoice.workspaceId,
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
      select: {
        stripeAccountId: true,
        stripeAccountEnabled: true,
        stripeSecretKey: true,
        stripePublishableKey: true,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Membership is not enough to change content: viewers are read-only.
    if (!(await canEditContent(invoice.workspaceId, session.user.id))) {
      return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
    }

    const hasDirectKeys = !!(workspace.stripeSecretKey && workspace.stripePublishableKey);
    const hasConnectAccount = !!(workspace.stripeAccountId && workspace.stripeAccountEnabled);

    if (!hasDirectKeys && !hasConnectAccount) {
      return NextResponse.json(
        { error: 'Stripe is not configured for this workspace. Add your Stripe API keys in Settings → Integrations → Payments.' },
        { status: 400 }
      );
    }

    if (['paid', 'cancelled'].includes(invoice.status)) {
      return NextResponse.json(
        { error: `Cannot generate a payment link for a ${invoice.status} invoice` },
        { status: 400 }
      );
    }

    // Determine which Stripe client to use
    const stripeClient = hasDirectKeys
      ? await getStripeForWorkspace(workspace)
      : undefined;

    const connectedAccountId = (!hasDirectKeys && hasConnectAccount)
      ? workspace.stripeAccountId!
      : '';

    // Deactivate old payment link if one exists
    if (invoice.stripePaymentLinkId) {
      try {
        await deactivatePaymentLink(connectedAccountId, invoice.stripePaymentLinkId, stripeClient);
      } catch {
        // Non-fatal: old link may already be inactive
      }
    }

    // Get or create Stripe customer for the client (only for Connect mode)
    let stripeCustomerId = invoice.stripeCustomerId;
    if (!stripeCustomerId && invoice.clientEmail && !hasDirectKeys && connectedAccountId) {
      stripeCustomerId = await getOrCreateCustomer(
        connectedAccountId,
        invoice.clientEmail,
        invoice.clientName
      );
    }

    // Stripe requires amounts in the smallest currency unit (cents for USD)
    const amountCents = Math.round(invoice.amountDue * 100);

    const { url, paymentLinkId } = await createInvoicePaymentLink({
      connectedAccountId: connectedAccountId || undefined,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amountCents,
      currency: invoice.currency,
      clientEmail: invoice.clientEmail ?? undefined,
      description: `Payment for invoice ${invoice.invoiceNumber}`,
      stripeClient,
    });

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        stripeCustomerId: stripeCustomerId ?? undefined,
        stripePaymentLink: url,
        stripePaymentLinkId: paymentLinkId,
        // Move to 'sent' if still a draft
        status: invoice.status === 'draft' ? 'sent' : invoice.status,
        sentAt: invoice.status === 'draft' ? new Date() : invoice.sentAt,
      },
    });

    return NextResponse.json({
      paymentLink: url,
      paymentLinkId,
      invoice: updated,
    });
  } catch (error) {
    console.error('Error generating payment link:', error);
    return NextResponse.json({ error: 'Failed to generate payment link' }, { status: 500 });
  }
}
