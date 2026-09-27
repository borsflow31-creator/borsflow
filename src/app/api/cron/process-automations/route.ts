/**
 * CRON: Process Automations
 *
 * Advances every AutomationEnrollment whose next step is due, materializing that
 * step into the email queue. Runs alongside process-email-queue, which then sends
 * what this route enqueues.
 */

import { NextRequest, NextResponse } from 'next/server'
import { automationEngine } from '@/lib/automation-engine'
import { isAuthorizedCron } from '@/lib/api/cron'

export const maxDuration = 300 // seconds — Vercel Pro/Enterprise only

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await automationEngine.processDueEnrollments()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[cron/process-automations] error:', error)
    return NextResponse.json(
      { error: error.message || 'Automation processing failed' },
      { status: 500 }
    )
  }
}

// Vercel Cron sends GET
export async function GET(request: NextRequest) {
  return POST(request)
}
