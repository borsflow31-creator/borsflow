/**
 * CRON: Mark overdue invoices and expired quotes
 *
 * `overdue` and `expired` were statuses nothing ever wrote. The list pages derived
 * "is overdue" client-side from `dueDate`, so the state could not be filtered on,
 * reported on, or reacted to server-side, and the `@@index([dueDate])` on Invoice
 * went unused.
 *
 * Registered in the Cloudflare scheduler Worker's hourly jobs (workers/cron),
 * which is what drives every cron job in this app now - Vercel Hobby caps a
 * cron schedule at once a day, so nothing lives in vercel.json anymore.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthorizedCron } from '@/lib/api/cron'
import { notify } from '@/lib/notifications/notify'

/**
 * Only invoices the client still owes on become overdue. A draft has not been sent,
 * so it cannot be late; paid and cancelled are terminal.
 */
const OVERDUE_FROM = ['sent', 'viewed', 'partially_paid']

/** A quote past its validity date, unless it has already been decided. */
const EXPIRE_FROM = ['draft', 'sent', 'viewed']

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    // Selected before the sweep so the notifications below know exactly which
    // rows just flipped, rather than re-deriving "is overdue" after the fact.
    const [toOverdue, toExpire] = await Promise.all([
      prisma.invoice.findMany({
        where: { dueDate: { lt: now }, status: { in: OVERDUE_FROM } },
        select: { id: true, workspaceId: true, createdById: true, invoiceNumber: true, clientName: true },
      }),
      prisma.quote.findMany({
        where: { validUntil: { lt: now }, status: { in: EXPIRE_FROM } },
        select: { id: true, workspaceId: true, createdById: true, quoteNumber: true, clientName: true },
      }),
    ])

    const [invoices, quotes] = await Promise.all([
      prisma.invoice.updateMany({
        where: { id: { in: toOverdue.map((i) => i.id) } },
        data: { status: 'overdue' },
      }),
      prisma.quote.updateMany({
        where: { id: { in: toExpire.map((q) => q.id) } },
        data: { status: 'expired' },
      }),
    ])

    for (const invoice of toOverdue) {
      if (!invoice.createdById) continue
      void notify({
        recipients: [invoice.createdById],
        type: 'sales.invoice_overdue',
        workspaceId: invoice.workspaceId,
        title: `Invoice ${invoice.invoiceNumber} for ${invoice.clientName} is overdue`,
        href: `/invoices/${invoice.id}`,
        dedupeKey: `invoice.overdue:${invoice.id}`,
      })
    }
    for (const quote of toExpire) {
      if (!quote.createdById) continue
      void notify({
        recipients: [quote.createdById],
        type: 'sales.quote_expired',
        workspaceId: quote.workspaceId,
        title: `Quote ${quote.quoteNumber} for ${quote.clientName} expired`,
        href: `/quotes/${quote.id}`,
        dedupeKey: `quote.expired:${quote.id}`,
      })
    }

    console.log(
      `[cron/mark-overdue] Marked ${invoices.count} invoices overdue and ${quotes.count} quotes expired at ${now.toISOString()}`
    )

    return NextResponse.json(
      {
        message: 'Overdue sweep completed',
        overdueInvoices: invoices.count,
        expiredQuotes: quotes.count,
        timestamp: now.toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error marking overdue documents:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// Vercel Cron sends GET
export async function GET(request: NextRequest) {
  return POST(request)
}
