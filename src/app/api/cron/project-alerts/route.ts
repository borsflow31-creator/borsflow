/**
 * CRON: Hourly alerts about projects.
 *
 *  - Selling slower than the plan (a straight line from launch to delivery).
 *  - Stock running low.
 *  - Too many deals falling through.
 *
 * Hourly, not per minute: these are trends, and each alert is limited to once a
 * week or once a month per project by its claim key, so running more often would
 * only re-read the same numbers.
 *
 * Registered in the Cloudflare scheduler Worker's hourly jobs (workers/cron).
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/api/cron'
import { evaluateProjectAlerts } from '@/lib/services/developer/alerts'

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await evaluateProjectAlerts(new Date())
    return NextResponse.json({ message: 'Project alerts completed', ...result })
  } catch (error) {
    console.error('Error running project alerts:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// Same pattern as the other cron routes: the scheduler may use either verb.
export async function GET(request: NextRequest) {
  return POST(request)
}
