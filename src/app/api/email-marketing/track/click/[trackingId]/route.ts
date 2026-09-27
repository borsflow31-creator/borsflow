/**
 * Legacy click-tracking URL.
 *
 * This route redirected to whatever `?url=` it was given, so it worked as an open
 * redirect on our domain. It now forwards to /api/email-tracking/click, which
 * only redirects to links that were actually in the tracked email.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  const target = new URL(`/api/email-tracking/click/${encodeURIComponent(params.trackingId)}`, request.url)
  const url = request.nextUrl.searchParams.get('url')
  if (url) target.searchParams.set('url', url)
  return NextResponse.redirect(target, 302)
}
