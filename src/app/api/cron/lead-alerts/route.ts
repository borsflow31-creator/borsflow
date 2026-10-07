/**
 * CRON: Per-minute alerts about buyer leads.
 *
 *  - A new lead that nobody has contacted within the workspace's limit (15 minutes
 *    by default) is reported to the owner and the admins.
 *  - An open lead that has gone quiet, with nothing booked, gets a follow-up task
 *    for its owner.
 *
 * Runs every minute because the first alert is worth little if it arrives late;
 * the query is narrow (leads from the last day, indexed on createdAt) so a minute
 * with nothing to do costs one small read. Safe to run twice at once: each alert
 * claims a unique row before anyone is told (see services/developer/alerts).
 *
 * Registered in the Cloudflare scheduler Worker's per-minute jobs (workers/cron).
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/api/cron'
import { evaluateLeadAlerts } from '@/lib/services/developer/alerts'

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await evaluateLeadAlerts(new Date())
    return NextResponse.json({ message: 'Lead alerts completed', ...result })
  } catch (error) {
    console.error('Error running lead alerts:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// Same pattern as the other cron routes: the scheduler may use either verb.
export async function GET(request: NextRequest) {
  return POST(request)
}
