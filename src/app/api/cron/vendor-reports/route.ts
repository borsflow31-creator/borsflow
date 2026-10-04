/**
 * CRON: Vendor Reports
 *
 * Sends each vendor with a scheduled mandate their periodic report: enquiries, viewings, feedback and price position.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/api/cron'
import { sendDueVendorReports } from '@/lib/crm/vendor-report'

export const maxDuration = 300 // seconds — Vercel Pro/Enterprise only

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendDueVendorReports()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[cron/vendor-reports] error:', error)
    return NextResponse.json({ error: error.message || 'Vendor Reports failed' }, { status: 500 })
  }
}

// Vercel Cron sends GET
export async function GET(request: NextRequest) {
  return POST(request)
}
