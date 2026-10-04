/**
 * CRON: Property Matches
 *
 * Mails each buyer one digest of the new properties that fit their search brief. Matches are recorded when a listing goes live; this is what turns them into email, batched so a bulk upload never floods a buyer.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/api/cron'
import { sendMatchDigests } from '@/lib/crm/match-digest'

export const maxDuration = 300 // seconds — Vercel Pro/Enterprise only

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendMatchDigests()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[cron/property-matches] error:', error)
    return NextResponse.json({ error: error.message || 'Property Matches failed' }, { status: 500 })
  }
}

// Vercel Cron sends GET
export async function GET(request: NextRequest) {
  return POST(request)
}
