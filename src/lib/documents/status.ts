/**
 * Quote and invoice status vocabularies, plus the timestamps a status change implies.
 *
 * These are `String` columns in the schema rather than enums, and the schema
 * comments describing them are already out of date (`Invoice.status` omits
 * `partially_paid`, which the code writes). Until they become real enums, this is
 * where the accepted values live, so the API can reject a typo instead of
 * persisting it.
 */

export const QUOTE_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'] as const;

export const INVOICE_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export function isValidQuoteStatus(value: unknown): value is QuoteStatus {
  return typeof value === 'string' && (QUOTE_STATUSES as readonly string[]).includes(value);
}

export function isValidInvoiceStatus(value: unknown): value is InvoiceStatus {
  return typeof value === 'string' && (INVOICE_STATUSES as readonly string[]).includes(value);
}

/**
 * The lifecycle timestamp a status transition should stamp, if it isn't already set.
 *
 * Each stamp records the first time the document reached that state, so an existing
 * value is never overwritten — re-sending a quote keeps its original `sentAt`.
 */
export function quoteStatusTimestamps(
  status: QuoteStatus,
  existing: { sentAt?: Date | null; viewedAt?: Date | null; acceptedAt?: Date | null; rejectedAt?: Date | null }
): Record<string, Date> {
  const now = new Date();
  const stamps: Record<string, Date> = {};

  if (status === 'sent' && !existing.sentAt) stamps.sentAt = now;
  if (status === 'viewed' && !existing.viewedAt) stamps.viewedAt = now;
  if (status === 'accepted' && !existing.acceptedAt) stamps.acceptedAt = now;
  if (status === 'rejected' && !existing.rejectedAt) stamps.rejectedAt = now;

  return stamps;
}
