/**
 * CRON: Expire Invitations
 *
 * Flips pending invitations whose expiry date has passed to `expired`. Scheduled
 * hourly by the Cloudflare scheduler Worker (workers/cron), which gates this job
 * to the top of the hour rather than its own minute tick.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthorizedCron } from '@/lib/api/cron'
import { pruneRateLimitEvents } from '@/lib/api/rate-limit'

// Longest rate-limit window is a day; keep a week so nothing still counted is lost.
const RATE_LIMIT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    // Update all pending invitations that have expired
    const result = await prisma.invitation.updateMany({
      where: {
        status: 'pending',
        expiresAt: {
          lt: now,
        },
      },
      data: {
        status: 'expired',
      },
    })

    console.log(
      `[cron/expire-invitations] Expired ${result.count} pending invitations at ${now.toISOString()}`
    )

    // Same hourly job, second piece of housekeeping: drop rate-limit events that
    // no window can still see.
    const prunedRateLimitEvents = await pruneRateLimitEvents(RATE_LIMIT_RETENTION_MS)

    return NextResponse.json(
      {
        message: 'Invitations expired successfully',
        expiredCount: result.count,
        prunedRateLimitEvents,
        timestamp: now.toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error expiring invitations:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

// Vercel Cron sends GET
export async function GET(request: NextRequest) {
  return POST(request)
}
