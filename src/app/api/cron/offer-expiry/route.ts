/**
 * CRON: Offer Expiry
 *
 * Marks pending offers whose validity date has passed as expired.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/api/cron'
import { expireDueOffers } from '@/lib/services/offers'

export const maxDuration = 300 // seconds — Vercel Pro/Enterprise only

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await expireDueOffers()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[cron/offer-expiry] error:', error)
    return NextResponse.json({ error: error.message || 'Offer Expiry failed' }, { status: 500 })
  }
}

// Vercel Cron sends GET
export async function GET(request: NextRequest) {
  return POST(request)
}
