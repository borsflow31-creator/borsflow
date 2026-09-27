import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { constructWebhookEvent } from '@/lib/stripe';
import { recalculateInvoicePayment } from '@/lib/documents/payments';

// POST /api/webhooks/stripe
// Handles Stripe Connect webhook events for all connected accounts.
// Events come in with an `account` field identifying the connected account.
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = constructWebhookEvent(rawBody, signature);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // For Connect, events include the connected account ID
  const connectedAccountId = (event as any).account as string | undefined;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoiceId;
        if (!invoiceId) break;

        const amountPaid = (session.amount_total ?? 0) / 100;

        const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) break;

        // Stripe redelivers on any non-2xx, and this handler used to add the amount
        // to the stored total, so a retry inflated amountPaid and left a duplicate
        // Payment row. The reference number is the natural idempotency key.
        const reference =
          typeof session.payment_intent === 'string' ? session.payment_intent : session.id;

        const alreadyRecorded = await prisma.payment.findFirst({
          where: { invoiceId, referenceNumber: reference },
          select: { id: true },
        });

        if (alreadyRecorded) {
          console.log(`Stripe payment ${reference} already recorded for invoice ${invoiceId}; ignoring replay`);
          break;
        }

        await prisma.$transaction(async (tx) => {
          await tx.payment.create({
            data: {
              invoiceId,
              amount: amountPaid,
              paymentDate: new Date(),
              paymentMethod: 'stripe',
              referenceNumber: reference,
              notes: connectedAccountId
                ? `Stripe payment via connected account ${connectedAccountId}`
                : 'Stripe payment',
              createdById: null,
            },
          });

          await tx.invoice.update({
            where: { id: invoiceId },
            data: {
              stripeSessionId: session.id,
              stripePaymentIntentId:
                typeof session.payment_intent === 'string' ? session.payment_intent : null,
            },
          });

          // Totals are derived from the Payment rows rather than incremented, so a
          // replay that slipped past the guard above still cannot double-count.
          await recalculateInvoicePayment(tx, invoiceId);
        });
        break;
      }

      case 'payment_intent.succeeded': {
        // Secondary confirmation — only update if the invoice isn't already paid
        const intent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = intent.metadata?.invoiceId;
        if (!invoiceId) break;

        const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice || invoice.status === 'paid') break;

        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            stripePaymentIntentId: intent.id,
          },
        });
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = intent.metadata?.invoiceId;
        if (!invoiceId) break;

        console.warn(
          `Payment failed for invoice ${invoiceId}: ${intent.last_payment_error?.message}`
        );
        // No status change — the invoice stays as-is so the client can retry via the payment link
        break;
      }

      // Sync account enabled status when an account is updated
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        if (!account.id) break;

        await prisma.workspace.updateMany({
          where: { stripeAccountId: account.id },
          data: { stripeAccountEnabled: account.charges_enabled },
        });
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }
  } catch (err) {
    console.error(`Error processing Stripe webhook event ${event.type}:`, err);
    // Ask Stripe to retry. This used to return 200 to avoid duplicate processing,
    // which silently dropped payments on a transient DB error; now that recording
    // is idempotent on the reference number, a retry is safe and a lost payment is not.
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
