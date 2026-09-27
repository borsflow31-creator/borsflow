import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt, encrypt } from '@/lib/encryption';
import axios from 'axios';
import { requireWorkspacePermission } from '@/lib/api/workspace';

/**
 * POST /api/scheduling/calcom/sync
 * Fetches upcoming bookings from Cal.com v2 API and upserts them into the Meeting table.
 */
export async function POST(request: NextRequest) {
  const { workspaceId } = await request.json();
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

  // Syncing uses the workspace's stored Cal.com token and writes meetings into
  // it, so the caller must be able to change that workspace.
  const access = await requireWorkspacePermission(workspaceId, 'content:create');
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

  // Find the active Cal.com integration for this workspace
  const integration = await prisma.calendarIntegration.findFirst({
    where: { workspaceId, type: 'calcom', isActive: true }
  });

  if (!integration) {
    return NextResponse.json({ error: 'No active Cal.com integration found' }, { status: 404 });
  }

  if (!integration.accessToken) {
    return NextResponse.json({ error: 'No access token available' }, { status: 401 });
  }

  // Decrypt and refresh token if expired
  let accessToken = decrypt(integration.accessToken);

  if (integration.tokenExpiresAt && new Date(integration.tokenExpiresAt) <= new Date()) {
    if (!integration.refreshToken) {
      return NextResponse.json({ error: 'Token expired and no refresh token available' }, { status: 401 });
    }
    const refreshToken = decrypt(integration.refreshToken);
    try {
      const tokenRes = await axios.post(
        'https://app.cal.com/oauth/token',
        new URLSearchParams({
          refresh_token: refreshToken,
          client_id: process.env.CALCOM_CLIENT_ID || '',
          client_secret: process.env.CALCOM_CLIENT_SECRET || '',
          grant_type: 'refresh_token'
        })
      );
      accessToken = tokenRes.data.access_token;
      await prisma.calendarIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: encrypt(accessToken),
          refreshToken: tokenRes.data.refresh_token ? encrypt(tokenRes.data.refresh_token) : integration.refreshToken,
          tokenExpiresAt: tokenRes.data.expires_in
            ? new Date(Date.now() + tokenRes.data.expires_in * 1000)
            : undefined
        }
      });
    } catch {
      return NextResponse.json({ error: 'Failed to refresh Cal.com token' }, { status: 401 });
    }
  }

  // Fetch upcoming + past bookings from Cal.com v2
  let bookings: any[] = [];
  try {
    const calHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'cal-api-version': '2024-08-13'
    };
    const [upcomingRes, pastRes] = await Promise.allSettled([
      axios.get('https://api.cal.com/v2/bookings', { headers: calHeaders, params: { status: 'upcoming', take: 100 } }),
      axios.get('https://api.cal.com/v2/bookings', { headers: calHeaders, params: { status: 'past',     take: 100 } }),
    ]);
    // v2 response shape: { status: 'success', data: [ ...bookings ] }
    if (upcomingRes.status === 'fulfilled') bookings.push(...(upcomingRes.value.data?.data ?? []));
    if (pastRes.status === 'fulfilled')     bookings.push(...(pastRes.value.data?.data ?? []));
    if (bookings.length === 0 && upcomingRes.status === 'rejected') {
      const err = (upcomingRes as PromiseRejectedResult).reason;
      return NextResponse.json(
        { error: 'Failed to fetch bookings from Cal.com', detail: err?.response?.data ?? err?.message },
        { status: 502 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch bookings from Cal.com', detail: err?.response?.data ?? err?.message },
      { status: 502 }
    );
  }

  // Upsert each booking into the Meeting table
  let synced = 0;
  for (const booking of bookings) {
    // v2 booking fields
    const uid: string = booking.uid ?? String(booking.id);
    const title: string = booking.title ?? 'Cal.com Booking';
    const startTime: string = booking.startTime ?? booking.start;
    const endTime: string = booking.endTime ?? booking.end;
    if (!startTime || !endTime) continue;

    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    const duration = Math.round(durationMs / 60000);

    // Map Cal.com status to our Meeting status (v2 returns lowercase)
    const calStatus: string = (booking.status ?? '').toLowerCase();
    const status =
      calStatus === 'cancelled' ? 'cancelled'
      : calStatus === 'accepted' || calStatus === 'confirmed' ? 'scheduled'
      : calStatus === 'past' ? 'completed'
      : 'scheduled';

    // Collect attendees
    const attendees: { name: string; email: string }[] = (booking.attendees ?? []).map((a: any) => ({
      name: a.name ?? '',
      email: a.email ?? ''
    }));

    // Upsert by platformEventId (uid) using the unique constraint
    try {
      await prisma.meeting.upsert({
        where: { platformEventId_platform: { platformEventId: uid, platform: 'calcom' } },
        update: {
          title,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          duration,
          status,
          description: booking.description ?? undefined,
          timezone: booking.attendees?.[0]?.timeZone ?? undefined,
          meetingUrl: booking.meetingUrl ?? booking.videoCallUrl ?? undefined,
          syncStatus: 'synced',
          calendarIntegrationId: integration.id
        },
        create: {
          workspaceId,
          title,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          duration,
          status,
          platform: 'calcom',
          meetingType: 'online',
          platformEventId: uid,
          isExternal: true,
          description: booking.description ?? null,
          timezone: booking.attendees?.[0]?.timeZone ?? null,
          meetingUrl: booking.meetingUrl ?? booking.videoCallUrl ?? null,
          syncStatus: 'synced',
          calendarIntegrationId: integration.id,
          userId: access.session.user.id,
          createdById: access.session.user.id,
          attendees: attendees.length > 0
            ? {
                create: attendees.map(a => ({
                  name: a.name,
                  email: a.email
                }))
              }
            : undefined
        }
      });
      synced++;
    } catch {
      // skip individual upsert failures
    }
  }

  return NextResponse.json({ synced, total: bookings.length });
}
