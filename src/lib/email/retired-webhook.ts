import { NextResponse } from 'next/server'

/**
 * Answer for the old shared webhook addresses (one per provider type).
 *
 * They could only be verified with one platform-wide secret, which no client's
 * provider account uses, and they applied every event to every workspace. Each
 * connected provider now gets its own webhook, created on the client's account
 * automatically: /api/email-marketing/webhooks/<providerId>.
 */
export function retiredWebhook() {
  return NextResponse.json(
    {
      error:
        'This webhook address is no longer used. BorsFlow now creates a webhook for each connected email provider automatically.',
    },
    { status: 410 }
  )
}
