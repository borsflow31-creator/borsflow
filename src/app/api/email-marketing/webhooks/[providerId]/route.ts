/**
 * Bounce, complaint and unsubscribe events from one client's email provider.
 *
 * BorsFlow creates this webhook on the client's own provider account when they
 * save the provider (lib/email/webhook-setup.ts), so the client never handles the
 * URL or the secret. The provider id in the path picks the secret that verifies
 * the request and the workspace every effect is limited to.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { applyProviderEvent, parseProviderEvents, verifyProviderWebhook } from '@/lib/email/provider-webhooks'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: { providerId: string } }
) {
  // One answer for an unknown provider and a bad signature, so this endpoint
  // doesn't reveal which provider ids exist.
  const denied = () => NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  const provider = await prisma.emailProvider.findUnique({
    where: { id: params.providerId },
    select: { workspaceId: true, type: true, webhookSecret: true },
  })
  if (!provider?.webhookSecret) return denied()

  let secret: string
  try {
    secret = decrypt(provider.webhookSecret)
  } catch {
    return denied()
  }

  const body = await request.text()
  if (!verifyProviderWebhook(provider.type, secret, body, request.headers)) return denied()

  const events = parseProviderEvents(provider.type, body)
  if (!events) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  for (const event of events) {
    try {
      await applyProviderEvent(provider.workspaceId, provider.type, event)
    } catch (err) {
      console.error(`[webhook/${provider.type}] event error:`, err)
    }
  }

  return NextResponse.json({ received: true })
}
