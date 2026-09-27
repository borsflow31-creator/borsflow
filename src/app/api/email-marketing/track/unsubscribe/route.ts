/**
 * Legacy unsubscribe URL.
 *
 * This route verified the signed token but then wrote a field that does not exist
 * (EmailTracking.recipientEmail) and omitted a required one, so every valid click
 * failed with a 500. The token scheme is the same one /api/email-tracking/
 * unsubscribe checks, so forward there. Links from before unsubscribes were
 * scoped to a workspace carry no `w` and are refused there.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const target = new URL('/api/email-tracking/unsubscribe', request.url)
  for (const key of ['email', 'w', 'token', 'campaign']) {
    const value = request.nextUrl.searchParams.get(key)
    if (value) target.searchParams.set(key, value)
  }
  return NextResponse.redirect(target, 302)
}
