/**
 * CRON: Mark overdue invoices and expired quotes
 *
 * `overdue` and `expired` were statuses nothing ever wrote. The list pages derived
 * "is overdue" client-side from `dueDate`, so the state could not be filtered on,
 * reported on, or reacted to server-side, and the `@@index([dueDate])` on Invoice
 * went unused.
 *
 * Registered in the Cloudflare scheduler Worker's hourly jobs (workers/cron), which
 * is what drives this app's minute- and hour-granularity cron; only refresh-tokens
 * and sync-calendars live in vercel.json.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthorizedCron } from '@/lib/api/cron'

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

    const [invoices, quotes] = await Promise.all([
      prisma.invoice.updateMany({
        where: {
          dueDate: { lt: now },
          status: { in: OVERDUE_FROM },
        },
        data: { status: 'overdue' },
      }),
      prisma.quote.updateMany({
        where: {
          validUntil: { lt: now },
          status: { in: EXPIRE_FROM },
        },
        data: { status: 'expired' },
      }),
    ])

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
