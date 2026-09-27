import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleOAuthService } from '@/lib/scheduling/google-service';
import { ZoomOAuthService } from '@/lib/scheduling/zoom-service';
import { CalComOAuthService } from '@/lib/scheduling/calcom-service';
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace';
import { connectCalcomWebhook, webhookBaseUrl } from '@/lib/email/webhook-setup';

/**
 * GET: Lists all calendar and video integrations for a workspace
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

  const access = await requireWorkspaceAccess(workspaceId);
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

  // Finish Cal.com live-update setup that couldn't happen at connect time
  // (connected before it was automatic, or before BorsFlow had a public address).
  if (webhookBaseUrl()) {
    const pending = await prisma.calendarIntegration.findMany({
      where: {
        workspaceId,
        isActive: true,
        type: 'calcom',
        OR: [{ webhookStatus: null }, { webhookStatus: 'waiting_public_url' }],
      },
      select: { id: true },
    });
    for (const { id } of pending) {
      await connectCalcomWebhook(id).catch(err => console.error('[integrations] live updates setup failed:', err));
    }
  }

  const [calendarIntegrations, videoConfigs] = await Promise.all([
    prisma.calendarIntegration.findMany({
      where: { workspaceId, isActive: true },
      select: {
        id: true,
        type: true,
        name: true,
        providerEmail: true,
        lastSyncAt: true,
        syncStatus: true,
        syncFrequency: true,
        webhookStatus: true,
        webhookError: true
      }
    }),
    prisma.videoConferenceConfig.findMany({
      where: { workspaceId, isActive: true },
      select: {
        id: true,
        platform: true,
        name: true,
        providerEmail: true,
        isDefault: true
      }
    })
  ]);

  return NextResponse.json({ calendarIntegrations, videoConfigs });
}

/**
 * POST: Initiates a new integration by returning the OAuth URL
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { workspaceId, platform } = body;

  if (!workspaceId || !platform) {
    return NextResponse.json({ error: 'workspaceId and platform required' }, { status: 400 });
  }

  // The OAuth state carries this workspaceId and the callback stores the
  // connection there, so only someone who can change this workspace may start it.
  const access = await requireWorkspacePermission(workspaceId, 'content:create');
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

  let oauthUrl = '';
  switch (platform) {
    case 'google_calendar':
      oauthUrl = new GoogleOAuthService().getAuthUrl(workspaceId);
      break;
    case 'zoom':
      oauthUrl = new ZoomOAuthService().getAuthUrl(workspaceId);
      break;
    case 'calcom':
      oauthUrl = new CalComOAuthService().getAuthUrl(workspaceId);
      break;
    default:
      return NextResponse.json({ error: 'Unknown platform' }, { status: 400 });
  }

  return NextResponse.json({ oauthUrl });
}
