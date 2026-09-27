/**
 * Invoice payment reconciliation.
 *
 * `Invoice.amountPaid` / `amountDue` / `status` are a cache over the `Payment`
 * rows, and four code paths used to maintain that cache independently, each with
 * its own rules: the payments POST, the payments DELETE, the invoice PUT, and the
 * Stripe webhook. They disagreed on the paid threshold (`<= 0` vs `<= 0.001`), on
 * whether `amountDue` was clamped at zero, and on which statuses a payment change
 * was allowed to overwrite. This module is the one implementation.
 *
 * Everything is always re-derived from the `Payment` rows. The webhook previously
 * did `amountPaid + newAmount`, so a Stripe retry silently inflated the paid
 * figure; deriving from rows makes a replay a no-op instead.
 */

import { prisma } from '@/lib/prisma';
import { roundMoney } from './calculations';

/**
 * Money lives in `Float` columns, so "paid in full" cannot be an exact compare.
 * Half a cent is below the smallest representable charge and far above the
 * accumulated error of summing a realistic number of payments.
 */
const PAID_TOLERANCE = 0.005;

/** Statuses that exist because of payment state, and so may be rewritten by it. */
const PAYMENT_DERIVED_STATUSES = new Set(['paid', 'partially_paid']);

/** Recorded payment methods accepted from a user. `stripe` is set by the webhook, not by hand. */
export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'check', 'credit_card', 'paypal', 'other'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isValidPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (PAYMENT_METHODS as readonly string[]).includes(value);
}

/** Prisma client or interactive-transaction client. */
type Db = Pick<typeof prisma, 'invoice' | 'payment'>;

export interface PaymentRecalculation {
  amountPaid: number;
  amountDue: number;
  status: string;
  paidDate: Date | null;
}

/**
 * Derive payment fields from the `Payment` rows without writing them.
 *
 * `total` is passed in rather than read from the invoice so a caller that is
 * simultaneously changing the line items can reconcile against the new total.
 */
export function derivePaymentState({
  total,
  payments,
  currentStatus,
  currentPaidDate,
}: {
  total: number;
  payments: { amount: number }[];
  currentStatus: string;
  currentPaidDate: Date | null;
}): PaymentRecalculation {
  const amountPaid = roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));
  const rawDue = roundMoney(total - amountPaid);
  const isFullyPaid = payments.length > 0 && rawDue <= PAID_TOLERANCE;

  // Overpayment is allowed and kept on the Payment row, but the invoice never
  // carries a negative balance; the UI renders the credit from amountPaid.
  const amountDue = Math.max(0, rawDue);

  let status = currentStatus;
  if (isFullyPaid) {
    status = 'paid';
  } else if (amountPaid > 0) {
    status = 'partially_paid';
  } else if (PAYMENT_DERIVED_STATUSES.has(currentStatus)) {
    // Payments were removed entirely. Fall back to `sent` only because the
    // invoice had been marked paid; a draft, overdue or cancelled invoice keeps
    // its own status rather than being silently marked as sent.
    status = 'sent';
  }

  return {
    amountPaid,
    amountDue,
    status,
    paidDate: isFullyPaid ? (currentPaidDate ?? new Date()) : null,
  };
}

/**
 * Re-read an invoice's payments and write the reconciled cache back.
 *
 * Call inside a `$transaction` together with the payment insert or delete that
 * prompted it, so the rows and the cache can never diverge.
 */
export async function recalculateInvoicePayment(
  db: Db,
  invoiceId: string,
  options: { total?: number } = {}
): Promise<PaymentRecalculation> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { total: true, status: true, paidDate: true },
  });

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found while reconciling payments`);
  }

  const payments = await db.payment.findMany({
    where: { invoiceId },
    select: { amount: true },
  });

  const next = derivePaymentState({
    total: options.total ?? invoice.total,
    payments,
    currentStatus: invoice.status,
    currentPaidDate: invoice.paidDate,
  });

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: next.amountPaid,
      amountDue: next.amountDue,
      status: next.status,
      paidDate: next.paidDate,
    },
  });

  return next;
}
