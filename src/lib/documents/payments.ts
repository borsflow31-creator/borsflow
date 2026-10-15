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
 * Everything is always re-derived from the confirmed `Payment` rows. The webhook previously
 * did `amountPaid + newAmount`, so a Stripe retry silently inflated the paid
 * figure; deriving from rows makes a replay a no-op instead.
 */

import { prisma } from '@/lib/prisma';
import { fromCents, signedAmount, toCents } from './payment-rules';

/**
 * Money lives in `Float` columns, so "paid in full" cannot be an exact compare.
 * Half a cent is below the smallest representable charge and far above the
 * accumulated error of summing a realistic number of payments.
 */
const PAID_TOLERANCE = 0.005;

/** Statuses that exist because of payment state, and so may be rewritten by it. */
const PAYMENT_DERIVED_STATUSES = new Set(['paid', 'partially_paid']);

export {
  PAYMENT_METHODS, METHOD_RULES, PAYMENT_STATUSES, isValidPaymentMethod, toCents, fromCents, signedAmount,
} from './payment-rules';
export type { PaymentMethod, PaymentStatus } from './payment-rules';

/** Prisma client or interactive-transaction client. */
type Db = Pick<typeof prisma, 'invoice' | 'payment' | 'callForFunds' | 'developmentLot'>;

/** The rows that count toward an invoice's paid amount, signed. */
export async function countedPayments(db: Pick<typeof prisma, 'payment'>, invoiceId: string): Promise<{ amount: number }[]> {
  const rows = await db.payment.findMany({
    where: { invoiceId, status: 'confirmed' },
    select: { amount: true, kind: true },
  });
  return rows.map((row) => ({ amount: signedAmount(row) }));
}

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
  const amountPaid = fromCents(payments.reduce((sum, payment) => sum + toCents(payment.amount), 0));
  const rawDue = fromCents(toCents(total) - toCents(amountPaid));
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

  const payments = await countedPayments(db, invoiceId);

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

  await syncCallFromInvoice(db, invoiceId, next);
  await syncDepositFromInvoice(db, invoiceId, next);

  return next;
}

/**
 * A call for funds' status follows the money on its invoice, whichever screen
 * recorded it. Before this, a payment taken on the invoice page left the call
 * unpaid everywhere else, and paying it again booked the money twice.
 *
 * `draft` calls are left alone: they have not been sent to anyone.
 */
export async function syncCallFromInvoice(
  db: Pick<typeof prisma, 'callForFunds' | 'payment'>,
  invoiceId: string,
  state: PaymentRecalculation
): Promise<void> {
  const call = await db.callForFunds.findUnique({
    where: { invoiceId },
    select: { id: true, status: true, dueAt: true, paidAt: true, bankLoanReference: true },
  });
  if (!call || call.status === 'draft') return;

  const pastDue = call.dueAt !== null && call.dueAt.getTime() < Date.now();
  let status: string;
  let paidAt: Date | null = null;

  if (state.status === 'paid') {
    status = 'paid';
    const last = await db.payment.findFirst({
      where: { invoiceId, status: 'confirmed', kind: 'payment' },
      orderBy: { paymentDate: 'desc' },
      select: { paymentDate: true },
    });
    paidAt = last?.paymentDate ?? call.paidAt ?? new Date();
  } else if (pastDue) {
    status = 'overdue';
  } else if (state.amountPaid > 0) {
    status = 'partially_paid';
  } else if (call.status === 'paid' || call.status === 'partially_paid' || call.status === 'overdue') {
    status = call.bankLoanReference ? 'sent_to_bank' : 'issued';
  } else {
    status = call.status;
  }

  if (status !== call.status || paidAt?.getTime() !== call.paidAt?.getTime()) {
    await db.callForFunds.update({ where: { id: call.id }, data: { status, paidAt } });
  }
}

/**
 * A unit's deposit fields are a cache of its deposit invoice: `reservationFee`
 * is what was asked, `reservationFeePaidAt` the day it was fully received. They
 * are kept because contracts, the buyer portal and older screens read them.
 */
export async function syncDepositFromInvoice(
  db: Pick<typeof prisma, 'developmentLot' | 'payment'>,
  invoiceId: string,
  state: PaymentRecalculation
): Promise<void> {
  const lot = await db.developmentLot.findUnique({
    where: { depositInvoiceId: invoiceId },
    select: { id: true, reservationFeePaidAt: true },
  });
  if (!lot) return;

  let paidAt: Date | null = null;
  if (state.status === 'paid') {
    const last = await db.payment.findFirst({
      where: { invoiceId, status: 'confirmed', kind: 'payment' },
      orderBy: { paymentDate: 'desc' },
      select: { paymentDate: true },
    });
    paidAt = last?.paymentDate ?? lot.reservationFeePaidAt ?? new Date();
  }
  if (paidAt?.getTime() !== lot.reservationFeePaidAt?.getTime()) {
    await db.developmentLot.update({ where: { id: lot.id }, data: { reservationFeePaidAt: paidAt } });
  }
}
