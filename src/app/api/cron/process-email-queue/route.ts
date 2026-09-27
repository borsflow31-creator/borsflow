/**
 * CRON: Process Email Queue
 *
 * Called periodically (e.g. every minute via Vercel Cron or an external scheduler).
 * Processes pending items from the email queue.
 *
 * Protect this endpoint with a secret header so only the scheduler can trigger it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { emailQueueService } from '@/lib/email-queue'
import { emailMarketingService } from '@/lib/email-marketing'
import { prisma } from '@/lib/prisma'
import { isAuthorizedCron } from '@/lib/api/cron'

export const maxDuration = 300 // seconds — Vercel Pro/Enterprise only

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Load providers for all active workspaces that have pending items
    const pendingWorkspaces = await prisma.emailQueue.findMany({
      where: {
        status: 'pending',
        scheduledFor: { lte: new Date() },
      },
      include: {
        email: {
          include: { campaign: true },
        },
      },
      distinct: ['emailId'],
      take: 100,
    })

    // Collect unique workspace IDs. Automation-step emails have no campaign, so
    // fall back to the email's own workspaceId or no provider would be loaded for
    // them and they would sit in the queue forever.
    const workspaceIds = new Set<string>()
    for (const item of pendingWorkspaces) {
      const wsId = (item.email as any)?.campaign?.workspaceId ?? (item.email as any)?.workspaceId
      if (wsId) workspaceIds.add(wsId)
    }

    // Load providers for each workspace
    for (const wsId of Array.from(workspaceIds)) {
      await emailMarketingService.loadProviders(wsId)
    }

    // Process the queue
    await emailQueueService.runOnce()

    const stats = await emailQueueService.getStatistics()

    return NextResponse.json({
      success: true,
      processed: stats.totalProcessed,
      pending: stats.totalQueued - stats.totalProcessed - stats.totalFailed,
      failed: stats.totalFailed,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[cron/process-email-queue] error:', error)
    return NextResponse.json(
      { error: error.message || 'Queue processing failed' },
      { status: 500 }
    )
  }
}

// Also support GET for Vercel Cron (which sends GET requests)
export async function GET(request: NextRequest) {
  return POST(request)
}
