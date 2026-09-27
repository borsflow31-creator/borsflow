import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/api/cron';
import { SyncService } from '@/lib/scheduling/sync-service';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/cron/sync-calendars
 * Runs a full sync for all active calendar integrations.
 * Secured with CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
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
