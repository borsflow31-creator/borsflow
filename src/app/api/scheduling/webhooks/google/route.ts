import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/scheduling/webhooks/google
 * Receives Google Calendar push notifications (channel + resource IDs).
 * Google sends a POST with X-Goog-Resource-State header.
 */
export async function POST(request: NextRequest) {
  const resourceState  = request.headers.get('x-goog-resource-state');
  const channelId      = request.headers.get('x-goog-channel-id');
  const resourceId     = request.headers.get('x-goog-resource-id');

  // Ignore sync/initial notifications
  if (resourceState === 'sync') {
    return NextResponse.json({ received: true });
  }

  if (!channelId || !resourceId) {
    return NextResponse.json({ error: 'Missing channel/resource headers' }, { status: 400 });
  }

  // Find the integration connected to this channel
  // In a full implementation, you'd store channelId → integrationId mapping
  // For now, mark integrations needing resync
  try {
    const integrations = await prisma.calendarIntegration.findMany({
      where: { type: 'google_calendar', isActive: true, syncEnabled: true }
    });

    for (const integration of integrations) {
      // Flag for next scheduled sync cycle
      await prisma.calendarIntegration.update({
        where: { id: integration.id },
        data:  { syncStatus: 'active' } // sync scheduler will pick this up
      });
    }
  } catch (err: any) {
    console.error('Google webhook processing error:', err.message);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
