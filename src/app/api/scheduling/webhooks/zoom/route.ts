import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * POST /api/scheduling/webhooks/zoom
 * Receives Zoom meeting lifecycle events.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  // Zoom webhook validation — URL validation challenge
  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Handle Zoom's endpoint URL validation
  if (event.event === 'endpoint.url_validation') {
    const hashForValidate = crypto
      .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN || '')
      .update(event.payload.plainToken)
      .digest('hex');

    return NextResponse.json({
      plainToken: event.payload.plainToken,
      encryptedToken: hashForValidate
    });
  }

  // Verify signature
  const timestamp = request.headers.get('x-zm-request-timestamp') || '';
  const signature = request.headers.get('x-zm-signature') || '';
  const secret    = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || '';

  // Fail closed when the secret is missing (this used to skip verification, so
  // anyone could post meeting updates, e.g. rewrite a meeting's join link), and
  // compare lengths first so a malformed signature is a 401, not a 500.
  const message  = `v0:${timestamp}:${body}`;
  const expected = secret ? 'v0=' + crypto.createHmac('sha256', secret).update(message).digest('hex') : '';
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (!secret || given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const { event: eventType, payload } = event;

  try {
    switch (eventType) {
      case 'meeting.created':
      case 'meeting.updated': {
        const zoomMeeting  = payload.object;
        if (!zoomMeeting?.id) break;

        const config = await prisma.videoConferenceConfig.findFirst({
          where: { platform: 'zoom', isActive: true, providerEmail: payload.operator_email }
        });
        if (!config) break;

        const startTime = new Date(zoomMeeting.start_time);
        const endTime   = new Date(startTime.getTime() + zoomMeeting.duration * 60000);

        await prisma.meeting.updateMany({
          where: { platformMeetingId: String(zoomMeeting.id), platform: 'zoom' },
          data: {
            title:       zoomMeeting.topic,
            startTime,
            endTime,
            meetingUrl:  zoomMeeting.join_url,
            syncStatus:  'synced',
            lastSyncedAt: new Date(),
          }
        });
        break;
      }

      case 'meeting.ended': {
        const meetingId = payload.object?.id;
        if (!meetingId) break;

        await prisma.meeting.updateMany({
          where: { platformMeetingId: String(meetingId), platform: 'zoom' },
          data:  { status: 'completed', syncStatus: 'synced' }
        });
        break;
      }

      case 'meeting.deleted': {
        const meetingId = payload.object?.id;
        if (!meetingId) break;

        await prisma.meeting.updateMany({
          where: { platformMeetingId: String(meetingId), platform: 'zoom' },
          data:  { status: 'cancelled', cancelledAt: new Date(), syncStatus: 'synced' }
        });
        break;
      }
    }
  } catch (err: any) {
    console.error('Zoom webhook processing error:', err.message);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
