import { NextResponse } from 'next/server';

/**
 * Retired shared Cal.com webhook address.
 *
 * It was verified with one platform-wide secret that no client's Cal.com account
 * uses, picked the workspace from the organizer's email, and cancelled bookings by
 * id across every workspace. Connecting Cal.com now creates a webhook on the
 * client's account automatically: /api/scheduling/webhooks/calcom/<integrationId>.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'This webhook address is no longer used. BorsFlow creates a webhook for each connected Cal.com account automatically.' },
    { status: 410 }
  );
}
