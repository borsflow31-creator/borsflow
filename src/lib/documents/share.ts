/**
 * Public client links for quotes and invoices.
 *
 * Both documents live behind `next-auth/middleware`, so the client a document was
 * sent to could never open it. That is also why `acceptedAt` was only ever written
 * by quote conversion and `rejectedAt` / `viewedAt` were never written at all —
 * there was no surface on which a client could respond.
 *
 * A share link carries a random token rather than the record id. The existing
 * `Page.isPublic` pattern publishes a page at its own cuid, which is fine for a wiki
 * page and not for a financial document: ids leak through other endpoints and are
 * enumerable in a way a token is not.
 */

import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

/** 32 bytes of base64url — far beyond guessing, still short enough to paste in an email. */
export function generatePublicToken(): string {
  return randomBytes(32).toString('base64url');
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function publicDocumentUrl(kind: 'quote' | 'invoice', token: string): string {
  return `${appUrl()}/view/${kind}/${token}`;
}

/**
 * The fields a client may see.
 *
 * `internalNotes` is deliberately absent: it is staff-only, and every authenticated
 * GET returns it, so it would be easy to leak by reusing those shapes here. Payment
 * rows are reduced to what a remittance advice needs.
 */
export const PUBLIC_QUOTE_SELECT = {
  quoteNumber: true,
  status: true,
  clientName: true,
  clientEmail: true,
  clientPhone: true,
  clientCompany: true,
  clientAddress: true,
  issueDate: true,
  validUntil: true,
  currency: true,
  subtotal: true,
  taxRate: true,
  taxAmount: true,
  discountType: true,
  discountValue: true,
  discountAmount: true,
  total: true,
  notes: true,
  terms: true,
  acceptedAt: true,
  rejectedAt: true,
  items: {
    orderBy: { order: 'asc' },
    select: {
      description: true,
      quantity: true,
      unitPrice: true,
      discount: true,
      taxRate: true,
      total: true,
    },
  },
  workspace: { select: { name: true } },
} as const;

export const PUBLIC_INVOICE_SELECT = {
  invoiceNumber: true,
  status: true,
  clientName: true,
  clientEmail: true,
  clientPhone: true,
  clientCompany: true,
  clientAddress: true,
  issueDate: true,
  dueDate: true,
  currency: true,
  subtotal: true,
  taxRate: true,
  taxAmount: true,
  discountType: true,
  discountValue: true,
  discountAmount: true,
  total: true,
  amountPaid: true,
  amountDue: true,
  notes: true,
  terms: true,
  payments: {
    orderBy: { paymentDate: 'desc' },
    select: {
      amount: true,
      paymentDate: true,
      paymentMethod: true,
      referenceNumber: true,
    },
  },
  items: {
    orderBy: { order: 'asc' },
    select: {
      description: true,
      quantity: true,
      unitPrice: true,
      discount: true,
      taxRate: true,
      total: true,
    },
  },
  workspace: { select: { name: true } },
} as const;

/**
 * Mint or rotate a document's public token and return the shareable URL.
 *
 * Rotating invalidates any link already sent, which is the only way to revoke one.
 */
export async function shareDocument(
  kind: 'quote' | 'invoice',
  id: string,
  { rotate = false }: { rotate?: boolean } = {}
): Promise<{ token: string; url: string }> {
  const existing =
    kind === 'quote'
      ? await prisma.quote.findUnique({ where: { id }, select: { publicToken: true } })
      : await prisma.invoice.findUnique({ where: { id }, select: { publicToken: true } });

  if (existing?.publicToken && !rotate) {
    return { token: existing.publicToken, url: publicDocumentUrl(kind, existing.publicToken) };
  }

  const token = generatePublicToken();
  const data = { publicToken: token, publicTokenCreatedAt: new Date() };

  if (kind === 'quote') {
    await prisma.quote.update({ where: { id }, data });
  } else {
    await prisma.invoice.update({ where: { id }, data });
  }

  return { token, url: publicDocumentUrl(kind, token) };
}

/**
 * Record that the client opened the document.
 *
 * `viewedAt` is stamped once, and `sent` advances to `viewed` so the team can see
 * the document landed. A document already accepted, paid or cancelled is left alone.
 */
export async function markPublicView(
  kind: 'quote' | 'invoice',
  id: string,
  current: { status: string; viewedAt: Date | null }
): Promise<{ firstView: boolean }> {
  const data: Record<string, unknown> = {};

  const firstView = !current.viewedAt;
  if (firstView) data.viewedAt = new Date();
  if (current.status === 'sent') data.status = 'viewed';

  if (Object.keys(data).length > 0) {
    if (kind === 'quote') {
      await prisma.quote.update({ where: { id }, data });
    } else {
      await prisma.invoice.update({ where: { id }, data });
    }
  }

  return { firstView };
}

/** A client responding to a quote may only accept or reject it. */
export const QUOTE_RESPONSE_RATE_LIMIT = {
  bucket: 'quote:respond',
  limit: 20,
  windowMs: 60 * 60 * 1000,
  windowLabel: 'hour',
} as const;
