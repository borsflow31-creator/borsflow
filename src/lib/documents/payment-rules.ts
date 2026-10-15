/**
 * Payment rules with no database access, so the browser can use the same list of
 * methods, the same per-method requirements and the same cents arithmetic as the
 * server. `payments.ts` re-exports all of it.
 */

/** Recorded payment methods accepted from a user. `stripe` is set by the webhook, not by hand. */
export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'check', 'credit_card', 'paypal', 'other'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isValidPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (PAYMENT_METHODS as readonly string[]).includes(value);
}

/**
 * What each method asks of the person recording it. A cheque is not money until
 * it clears, so it starts pending and counts toward nothing until confirmed.
 */
export const METHOD_RULES: Record<PaymentMethod, { reference: 'required' | 'optional' | 'none'; startsPending: boolean }> = {
  cash: { reference: 'none', startsPending: false },
  bank_transfer: { reference: 'optional', startsPending: false },
  check: { reference: 'required', startsPending: true },
  credit_card: { reference: 'optional', startsPending: false },
  paypal: { reference: 'optional', startsPending: false },
  other: { reference: 'optional', startsPending: false },
};

/**
 * 'pending': a cheque not yet cleared. 'confirmed': money received. 'failed': a
 * pending payment that never arrived. 'reversed': recorded in error. Only
 * confirmed rows count; none is ever deleted.
 */
export const PAYMENT_STATUSES = ['pending', 'confirmed', 'failed', 'reversed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Whole cents. Money is stored in Float columns, so every comparison and sum in
 * the payment flow is done on integers and converted back once. `toPrecision`
 * first absorbs the binary error (1.005 * 100 is 100.49999…), so it rounds the
 * way a person would.
 */
export function toCents(amount: number): number {
  return Math.round(Number((amount * 100).toPrecision(15)));
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** A refund takes money back out, so it counts negatively. */
export function signedAmount(payment: { amount: number; kind?: string | null }): number {
  return payment.kind === 'refund' ? -payment.amount : payment.amount;
}
