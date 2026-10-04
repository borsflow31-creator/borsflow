/**
 * CRON: Mandate Expiry
 *
 * Warns agents about mandates nearing their end date, starts mandate_expiring automations, and expires the mandates that have passed (de-listing their property).
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/api/cron'
import { runMandateWatch } from '@/lib/crm/mandate-watch'

export const maxDuration = 300 // seconds — Vercel Pro/Enterprise only

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runMandateWatch()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[cron/mandate-expiry] error:', error)
    return NextResponse.json({ error: error.message || 'Mandate Expiry failed' }, { status: 500 })
  }
}

// Vercel Cron sends GET
export async function GET(request: NextRequest) {
  return POST(request)
}
