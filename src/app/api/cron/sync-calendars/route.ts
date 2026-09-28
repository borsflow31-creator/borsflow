import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/api/cron';
import { SyncService } from '@/lib/scheduling/sync-service';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/cron/sync-calendars
 * Runs a full sync for all active calendar integrations.
 * Secured with CRON_SECRET header. Driven hourly by the Cloudflare scheduler
 * Worker (workers/cron), which is what every cron job in this app runs on now
 * that Vercel Hobby caps a cron schedule at once a day.
 */
export async function POST(request: NextRequest) {
  // Shared cron check: requires CRON_SECRET (Bearer or x-cron-secret) and refuses
  // every call when the secret is unset. This route used to skip the check
  // entirely in that case, leaving it open to anyone.
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const integrations = await prisma.calendarIntegration.findMany({
    where: { isActive: true, syncEnabled: true }
  });

  const syncService = new SyncService();
  let queued = 0;

  for (const integration of integrations) {
    // Fire-and-forget each sync to avoid timeout
    syncService.fullSyncCalendar(integration.id).catch(err => {
      console.error(`CRON: Sync failed for integration ${integration.id}:`, err.message);
    });
    queued++;
  }

  return NextResponse.json({
    message: `Queued sync for ${queued} integration(s)`,
    queued
  });
}

// Kept for triggering by hand from a browser; the Worker itself sends POST.
export async function GET(request: NextRequest) {
  return POST(request);
}
