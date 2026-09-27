import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import crypto from 'crypto';

/**
 * POST /api/scheduling/webhooks/calcom/:integrationId
 * Booking lifecycle events from one client's Cal.com account.
 *
 * BorsFlow creates this webhook on the client's account when they connect
 * Cal.com (lib/email/webhook-setup.ts), with a secret of its own choosing. The
 * integration id in the path picks that secret and the workspace the booking
 * belongs to. The old shared endpoint guessed the workspace from the organizer's
 * email and cancelled bookings by id across every workspace.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  const denied = () => NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  const integration = await prisma.calendarIntegration.findUnique({
    where: { id: params.integrationId },
  });
  if (!integration || integration.type !== 'calcom' || !integration.isActive || !integration.webhookSecret) {
    return denied();
  }

  let secret: string;
  try {
    secret = decrypt(integration.webhookSecret);
  } catch {
    return denied();
  }

  const body = await request.text();
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const given = Buffer.from(request.headers.get('x-cal-signature-256') || '');
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return denied();

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { triggerEvent, payload } = event;
  const uid = payload?.uid;
  if (!uid) return NextResponse.json({ received: true });

  try {
    switch (triggerEvent) {
      case 'BOOKING_CREATED':
      case 'BOOKING_RESCHEDULED': {
        // Booking ids are unique per platform, so a meeting another workspace
        // already holds for this id is left alone rather than taken over.
        const existing = await prisma.meeting.findUnique({
          where: { platformEventId_platform: { platformEventId: uid, platform: 'calcom' } },
          select: { workspaceId: true },
        });
        if (existing && existing.workspaceId !== integration.workspaceId) break;

        const startTime = new Date(payload.startTime);
        const endTime   = new Date(payload.endTime);
        const duration  = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
        const title     = payload.title || payload.eventType?.title || 'Cal.com Meeting';

        await prisma.meeting.upsert({
          where: { platformEventId_platform: { platformEventId: uid, platform: 'calcom' } },
          update: {
            title,
            startTime,
            endTime,
            duration,
            status:       'scheduled',
            syncStatus:   'synced',
            lastSyncedAt: new Date(),
          },
          create: {
            workspaceId:           integration.workspaceId,
            title,
            description:           payload.description,
            startTime,
            endTime,
            duration,
            timezone:              payload.attendees?.[0]?.timeZone || 'UTC',
            meetingType:           'online',
            platform:              'calcom',
            platformEventId:       uid,
            calendarIntegrationId: integration.id,
            status:                'scheduled',
            isExternal:            true,
            syncStatus:            'synced',
            lastSyncedAt:          new Date(),
            createdById:           integration.createdById,
          },
        });
        break;
      }

      case 'BOOKING_CANCELLED': {
        await prisma.meeting.updateMany({
          where: { platformEventId: uid, platform: 'calcom', workspaceId: integration.workspaceId },
          data: {
            status:             'cancelled',
            cancelledAt:        new Date(),
            cancellationReason: payload.cancellationReason || 'Cancelled via Cal.com',
            syncStatus:         'synced',
          },
        });
        break;
      }
    }
  } catch (err: any) {
    console.error('Cal.com webhook processing error:', err.message);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
