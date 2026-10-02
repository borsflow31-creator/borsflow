/**
 * CRON: Process Scheduled Campaigns
 *
 * Sends every email campaign whose scheduled time has passed by queuing its
 * emails. Runs before process-email-queue, which then delivers them.
 */

import { NextRequest, NextResponse } from 'next/server'
import { emailCampaignService } from '@/lib/email-campaign'
import { isAuthorizedCron } from '@/lib/api/cron'

export const maxDuration = 300 // seconds — Vercel Pro/Enterprise only

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await emailCampaignService.processDueScheduledCampaigns()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[cron/process-scheduled-campaigns] error:', error)
    return NextResponse.json(
      { error: error.message || 'Scheduled campaign processing failed' },
      { status: 500 }
    )
  }
}

// Vercel Cron sends GET
export async function GET(request: NextRequest) {
  return POST(request)
}
