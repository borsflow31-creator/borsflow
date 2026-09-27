/**
 * Incoming email-provider webhooks, one per client.
 *
 * Every client sends through their own provider account, and BorsFlow creates a
 * webhook on that account pointing at /api/email-marketing/webhooks/<providerId>
 * (see webhook-setup.ts). The id in the URL says which client an event belongs
 * to, the secret stored with that provider verifies it, and every effect stays in
 * that client's workspace.
 *
 * The old endpoints were one per provider type, verified with a single
 * platform-wide secret that no client's account used, and applied each bounce,
 * complaint and unsubscribe to every workspace.
 */

import { createHmac, createPublicKey, createVerify, timingSafeEqual, type KeyObject } from 'crypto'
import { prisma } from '@/lib/prisma'

/** Username BorsFlow registers for Postmark's basic auth; the password is per provider. */
export const POSTMARK_WEBHOOK_USER = 'borsflow'

export type ProviderEvent =
  | { kind: 'bounce'; email: string; hard: boolean; reason: string; raw: unknown }
  | { kind: 'complaint'; email: string; raw: unknown }
  | { kind: 'unsubscribe'; email: string; raw: unknown }

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Refuses signatures older than `maxAgeSeconds`, so a captured request cannot be replayed later. */
function isFresh(timestampSeconds: unknown, maxAgeSeconds: number): boolean {
  const ts = Number(timestampSeconds)
  return Number.isFinite(ts) && Math.abs(Date.now() / 1000 - ts) <= maxAgeSeconds
}

// ── Verification ─────────────────────────────────────────────────────────────

/** Resend signs with Svix: base64 HMAC-SHA256 of "<id>.<timestamp>.<body>", keyed with the whsec_ secret. */
function verifyResend(secret: string, body: string, headers: Headers): boolean {
  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signatures = headers.get('svix-signature')
  if (!id || !timestamp || !signatures || !isFresh(timestamp, 5 * 60)) return false

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')}`
  return signatures.split(' ').some(sig => safeEqual(sig, expected))
}

/**
 * SendGrid shows the verification key as base64 DER (the "MFkw..." string), which
 * Node's verifier cannot read as-is. Accept that form, or a PEM key.
 */
function loadPublicKey(raw: string): KeyObject {
  if (raw.includes('BEGIN PUBLIC KEY')) return createPublicKey(raw)
  return createPublicKey({ key: Buffer.from(raw.trim(), 'base64'), format: 'der', type: 'spki' })
}

/** SendGrid signs "<timestamp><body>" with ECDSA; the public key comes back when signing is enabled. */
function verifySendgrid(publicKey: string, body: string, headers: Headers): boolean {
  const signature = headers.get('x-twilio-email-event-webhook-signature')
  const timestamp = headers.get('x-twilio-email-event-webhook-timestamp')
  if (!signature || !timestamp || !isFresh(timestamp, 5 * 60)) return false

  try {
    const verifier = createVerify('SHA256')
    verifier.update(timestamp + body)
    return verifier.verify(loadPublicKey(publicKey), signature, 'base64')
  } catch {
    return false
  }
}

/**
 * Mailgun puts the signature in the body: hex HMAC-SHA256 of timestamp + token,
 * keyed with the account's webhook signing key. Retries are re-signed, but allow
 * for clock skew on Mailgun's side.
 */
function verifyMailgun(signingKey: string, payload: any): boolean {
  const sig = payload?.signature
  if (!sig?.timestamp || !sig?.token || !sig?.signature || !isFresh(sig.timestamp, 15 * 60)) return false

  const expected = createHmac('sha256', signingKey).update(String(sig.timestamp) + String(sig.token)).digest('hex')
  return safeEqual(String(sig.signature), expected)
}

/** Postmark sends the basic-auth credentials BorsFlow registered with the webhook. */
function verifyPostmark(password: string, headers: Headers): boolean {
  const expected = `Basic ${Buffer.from(`${POSTMARK_WEBHOOK_USER}:${password}`).toString('base64')}`
  return safeEqual(headers.get('authorization') || '', expected)
}

/** True when `body` really came from this provider's webhook. */
export function verifyProviderWebhook(type: string, secret: string, body: string, headers: Headers): boolean {
  switch (type) {
    case 'resend':
      return verifyResend(secret, body, headers)
    case 'sendgrid':
      return verifySendgrid(secret, body, headers)
    case 'mailgun': {
      try {
        return verifyMailgun(secret, JSON.parse(body))
      } catch {
        return false
      }
    }
    case 'postmark':
      return verifyPostmark(secret, headers)
    default:
      return false
  }
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function parseResend(event: any): ProviderEvent[] {
  const data = event?.data || {}
  const email: string = data.to?.[0] || ''
  if (!email) return []

  if (event.type === 'email.bounced') {
    // Transient bounces (full mailbox, greylisting) are worth recording, not suppressing.
    const hard = data.bounce?.type !== 'Transient'
    return [{ kind: 'bounce', email, hard, reason: data.bounce?.message || 'Bounce reported by Resend', raw: event }]
  }
  if (event.type === 'email.complained') return [{ kind: 'complaint', email, raw: event }]
  return []
}

function parseSendgrid(events: any): ProviderEvent[] {
  const list = Array.isArray(events) ? events : [events]
  const out: ProviderEvent[] = []
  for (const event of list) {
    const email: string = event?.email || ''
    if (!email) continue
    switch (event.event) {
      case 'bounce': {
        // SendGrid: type "bounce" is a permanent rejection, "blocked" a temporary one.
        const hard = event.type !== 'blocked'
        out.push({ kind: 'bounce', email, hard, reason: event.reason || event.response || 'Bounce', raw: event })
        break
      }
      case 'dropped':
        out.push({ kind: 'bounce', email, hard: true, reason: event.reason || 'Dropped', raw: event })
        break
      case 'spamreport':
        out.push({ kind: 'complaint', email, raw: event })
        break
      case 'unsubscribe':
      case 'group_unsubscribe':
        out.push({ kind: 'unsubscribe', email, raw: event })
        break
    }
  }
  return out
}

function parseMailgun(payload: any): ProviderEvent[] {
  const data = payload?.['event-data'] || {}
  const email: string = data.recipient || ''
  if (!email) return []

  switch (data.event) {
    case 'failed':
      return [{
        kind: 'bounce',
        email,
        hard: (data.severity || 'permanent') === 'permanent',
        reason: data['delivery-status']?.message || data.reason || 'Failed',
        raw: data,
      }]
    case 'complained':
      return [{ kind: 'complaint', email, raw: data }]
    case 'unsubscribed':
      return [{ kind: 'unsubscribe', email, raw: data }]
    default:
      return []
  }
}

// Postmark bounce types that mean the address itself is bad, not a passing failure.
const POSTMARK_HARD_BOUNCES = new Set(['HardBounce', 'BadEmailAddress', 'ManuallyDeactivated'])

function parsePostmark(event: any): ProviderEvent[] {
  const email: string = event?.Email || event?.Recipient || ''
  if (!email) return []

  switch (event.RecordType) {
    case 'Bounce':
      return [{
        kind: 'bounce',
        email,
        hard: POSTMARK_HARD_BOUNCES.has(event.Type),
        reason: event.Description || event.Name || 'Bounce',
        raw: event,
      }]
    case 'SpamComplaint':
      return [{ kind: 'complaint', email, raw: event }]
    case 'SubscriptionChange':
      return event.SuppressSending ? [{ kind: 'unsubscribe', email, raw: event }] : []
    default:
      return []
  }
}

/** The events in a verified webhook body, or null when it is not JSON. */
export function parseProviderEvents(type: string, body: string): ProviderEvent[] | null {
  let payload: any
  try {
    payload = JSON.parse(body)
  } catch {
    return null
  }

  switch (type) {
    case 'resend':
      return parseResend(payload)
    case 'sendgrid':
      return parseSendgrid(payload)
    case 'mailgun':
      return parseMailgun(payload)
    case 'postmark':
      return parsePostmark(payload)
    default:
      return []
  }
}

// ── Effects, scoped to the provider's workspace ──────────────────────────────

async function recordUnsubscribe(workspaceId: string, email: string, reason: string) {
  await prisma.emailUnsubscribe.upsert({
    where: { workspaceId_email: { workspaceId, email } },
    update: { unsubscribedAt: new Date() },
    create: { workspaceId, email, source: 'api', reason },
  })
}

async function suppress(workspaceId: string, email: string, type: 'bounce' | 'complaint', reason: string, source: string) {
  await prisma.emailSuppression.upsert({
    where: { workspaceId_email_type: { workspaceId, email, type } },
    update: { isActive: true, suppressedAt: new Date(), reason, source },
    create: { workspaceId, email, type, reason, source },
  })
}

export async function applyProviderEvent(workspaceId: string, providerType: string, event: ProviderEvent): Promise<void> {
  const { email } = event
  // Only this workspace's recipients; another client may have mailed the same address.
  const recipients = { recipientEmail: email, email: { workspaceId } }

  switch (event.kind) {
    case 'bounce': {
      await prisma.emailBounce.create({
        data: {
          workspaceId,
          email,
          recipientEmail: email,
          type: event.hard ? 'hard' : 'soft',
          reason: event.reason,
          providerType,
          providerMessage: JSON.stringify(event.raw).slice(0, 10_000),
        },
      })
      if (event.hard) {
        await suppress(workspaceId, email, 'bounce', event.reason, providerType)
        await prisma.emailRecipient.updateMany({
          where: recipients,
          data: { status: 'bounced', bouncedAt: new Date(), bounceReason: event.reason },
        })
      }
      return
    }
    case 'complaint':
      await suppress(workspaceId, email, 'complaint', 'Marked as spam', providerType)
      await recordUnsubscribe(workspaceId, email, 'spam_complaint')
      return
    case 'unsubscribe':
      await recordUnsubscribe(workspaceId, email, 'unsubscribe_event')
      await prisma.emailRecipient.updateMany({
        where: recipients,
        data: { status: 'unsubscribed', unsubscribedAt: new Date() },
      })
      return
  }
}
