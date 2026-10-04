/**
 * CRON: Refresh Segments
 *
 * Re-materializes the stalest active segmentation rules. Membership is derived,
 * so a segment left alone goes stale as subjects are created, edited and moved.
 *
 * This exists so nothing has to refresh segments on a write path. Materializing
 * a segment loads every row of its subject type, so doing it inside a lead edit
 * or a property create would make that request as slow as the largest segment in
 * the workspace. The only other refreshes are the targeted one immediately
 * before a campaign send and an explicit user save.
 *
 * Budgeted per run rather than sweeping everything: with maxDuration at 300s, a
 * workspace with hundreds of rules would otherwise time out and refresh nothing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { emailSegmentationService } from '@/lib/email-segmentation'
import { isAuthorizedCron } from '@/lib/api/cron'

export const maxDuration = 300 // seconds — Vercel Pro/Enterprise only

/** How many rules one run may rebuild, and how old counts as stale. */
const REFRESH_LIMIT = 25
const MAX_AGE_MINUTES = 60

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await emailSegmentationService.refreshStaleSegments({
      limit: REFRESH_LIMIT,
      maxAgeMinutes: MAX_AGE_MINUTES,
    })

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[cron/refresh-segments] error:', error)
    return NextResponse.json(
      { error: error.message || 'Segment refresh failed' },
      { status: 500 }
    )
  }
}

// Vercel Cron sends GET
export async function GET(request: NextRequest) {
  return POST(request)
}
