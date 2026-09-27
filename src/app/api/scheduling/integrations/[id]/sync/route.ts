import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SyncService } from '@/lib/scheduling/sync-service';
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace';

/** Loads the integration and authorizes against the workspace that owns it. */
async function authorize(id: string, write: boolean) {
  const integration = await prisma.calendarIntegration.findUnique({ where: { id } });
  if (!integration) return { error: 'Integration not found', status: 404 as const };

  const access = write
    ? await requireWorkspacePermission(integration.workspaceId, 'content:create')
    : await requireWorkspaceAccess(integration.workspaceId);
  if ('error' in access) return { error: access.error, status: access.status };
  return { integration };
}

// POST /api/scheduling/integrations/[id]/sync — trigger manual sync
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await authorize(params.id, true);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { integration } = result;

  if (!integration.isActive) return NextResponse.json({ error: 'Integration is disabled' }, { status: 400 });

  // Update status to syncing
  await prisma.calendarIntegration.update({
    where: { id: params.id },
    data: { syncStatus: 'active' }
  });

  // Run sync in the background (don't await — respond immediately)
  const syncService = new SyncService();
  syncService.fullSyncCalendar(params.id).catch(err => {
    console.error(`Background sync failed for ${params.id}:`, err.message);
  });

  return NextResponse.json({ message: 'Sync started', integrationId: params.id });
}

// GET /api/scheduling/integrations/[id]/sync — get sync logs
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await authorize(params.id, false);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const logs = await prisma.calendarSyncLog.findMany({
    where: { calendarIntegrationId: params.id },
    orderBy: { startedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      operationType: true,
      status: true,
      eventsProcessed: true,
      eventsCreated: true,
      eventsUpdated: true,
      eventsDeleted: true,
      eventsSkipped: true,
      errorMessage: true,
      durationMs: true,
      startedAt: true,
      completedAt: true,
    }
  });

  return NextResponse.json({ logs });
}
