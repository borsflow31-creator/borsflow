/**
 * Legacy open-tracking URL.
 *
 * Campaign and automation emails use /api/email-tracking/open. This older route
 * ran Prisma on the edge runtime and wrote fields that do not exist on
 * EmailTracking, so it never recorded anything. It now forwards to the real
 * tracker; mail clients follow redirects for images.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  const target = new URL(`/api/email-tracking/open/${encodeURIComponent(params.trackingId)}`, request.url)
  return NextResponse.redirect(target, 302)
}
