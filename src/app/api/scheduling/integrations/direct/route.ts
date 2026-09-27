import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { requireWorkspacePermission } from '@/lib/api/workspace';
import { connectCalcomWebhook } from '@/lib/email/webhook-setup';

/**
 * POST: Directly connect a platform using API key / access token (no OAuth redirect)
 * Body: { workspaceId, platform, accessToken, email, name? }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { workspaceId, platform, accessToken, email, name } = body;

  if (!workspaceId || !platform || !accessToken || !email) {
    return NextResponse.json({ error: 'workspaceId, platform, accessToken, and email are required' }, { status: 400 });
  }

  // The workspace comes from the request body, so it must be one the caller can
  // change. Without this, anyone could overwrite another workspace's Zoom or
  // calendar credentials (the Zoom config is upserted per workspace).
  const access = await requireWorkspacePermission(workspaceId, 'content:create');
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
  const { session } = access;

  const encryptedToken = encrypt(accessToken);
  const displayName = name || email;

  try {
    if (platform === 'zoom') {
      // Zoom → stored as VideoConferenceConfig
      const config = await prisma.videoConferenceConfig.upsert({
        where: { workspaceId_platform: { workspaceId, platform: 'zoom' } },
        update: {
          accessToken: encryptedToken,
          providerEmail: email,
          providerUserId: email,
          name: displayName,
          isActive: true,
          updatedBy: session.user.id,
        },
        create: {
          workspaceId,
          platform: 'zoom',
          name: displayName,
          providerUserId: email,
          providerEmail: email,
          accessToken: encryptedToken,
          isActive: true,
          createdById: session.user.id,
        },
      });
      return NextResponse.json({ success: true, id: config.id, type: 'video' });
    }

    // Google Calendar or Cal.com → stored as CalendarIntegration
    const typeMap: Record<string, string> = {
      google_calendar: 'google_calendar',
      calcom: 'calcom',
    };
    const type = typeMap[platform];
    if (!type) return NextResponse.json({ error: 'Unknown platform' }, { status: 400 });

    const integration = await prisma.calendarIntegration.upsert({
      where: {
        workspaceId_type_providerUserId: {
          workspaceId,
          type,
          providerUserId: email,
        },
      },
      update: {
        accessToken: encryptedToken,
        providerEmail: email,
        name: displayName,
        isActive: true,
        syncStatus: 'active',
        updatedBy: session.user.id,
      },
      create: {
        workspaceId,
        type,
        providerUserId: email,
        providerEmail: email,
        name: displayName,
        accessToken: encryptedToken,
        isActive: true,
        syncStatus: 'active',
        createdById: session.user.id,
      },
    });

    // Cal.com: create the booking webhook on the client's account now, so new
    // bookings arrive right away with nothing for the client to configure.
    const connected = type === 'calcom' ? await connectCalcomWebhook(integration.id) : null;

    return NextResponse.json({
      success: true,
      id: integration.id,
      type: 'calendar',
      webhookStatus: connected?.webhookStatus ?? null,
      webhookError: connected?.webhookError ?? null,
    });
  } catch (err: any) {
    console.error('Direct connect error:', err);
    return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 });
  }
}
