/**
 * Automatic webhook setup on clients' own accounts.
 *
 * Clients connect their own email provider and their own Cal.com account. Rather
 * than have them copy a URL and a signing secret between dashboards, BorsFlow uses
 * the credentials they already gave it to create the webhook itself, and keeps
 * that webhook's secret (encrypted) to verify what arrives. When the credentials
 * may not manage webhooks, a plain-language reason is stored for the UI; sending
 * and hourly calendar sync are unaffected either way.
 *
 * API hosts can be overridden (SENDGRID_API_BASE, MAILGUN_API_BASE,
 * POSTMARK_API_BASE, CALCOM_API_BASE; Resend's SDK reads RESEND_BASE_URL) for
 * test runs and self-hosted instances.
 */

import { randomBytes } from 'crypto'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/encryption'
import { revealApiKey } from './provider-keys'
import { POSTMARK_WEBHOOK_USER } from './provider-webhooks'

export type WebhookStatus = 'active' | 'error' | 'unsupported' | 'waiting_public_url'

/** Provider types whose webhook BorsFlow can create automatically. */
export const AUTO_WEBHOOK_TYPES = ['resend', 'sendgrid', 'mailgun', 'postmark']

const LABELS: Record<string, string> = {
  resend: 'Resend',
  sendgrid: 'SendGrid',
  mailgun: 'Mailgun',
  postmark: 'Postmark',
  ses: 'Amazon SES',
  brevo: 'Brevo',
  calcom: 'Cal.com',
}

const TIMEOUT_MS = 10_000

const RESEND_EVENTS = ['email.bounced', 'email.complained'] as const
const MAILGUN_EVENTS = ['permanent_fail', 'temporary_fail', 'complained', 'unsubscribed']
const CALCOM_TRIGGERS = ['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED']

/** A setup failure whose message is shown to the client as-is. */
class SetupError extends Error {}

/**
 * The public address providers should call. They cannot reach a local machine,
 * so a localhost or plain-http app URL means "not yet"; WEBHOOK_BASE_URL overrides
 * this for a development tunnel or a test run.
 */
export function webhookBaseUrl(): string | null {
  const explicit = process.env.WEBHOOK_BASE_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const app = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL
  if (!app) return null
  try {
    const url = new URL(app)
    if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) return null
    return url.origin
  } catch {
    return null
  }
}

export const emailWebhookPath = (providerId: string) => `/api/email-marketing/webhooks/${providerId}`
export const calcomWebhookPath = (integrationId: string) => `/api/scheduling/webhooks/calcom/${integrationId}`

const base = (override: string | undefined, fallback: string) => (override || fallback).replace(/\/$/, '')
const sendgridApi = () => base(process.env.SENDGRID_API_BASE, 'https://api.sendgrid.com')
const postmarkApi = () => base(process.env.POSTMARK_API_BASE, 'https://api.postmarkapp.com')
const calcomApi = () => base(process.env.CALCOM_API_BASE, 'https://api.cal.com')
const mailgunApi = (region?: string | null) =>
  base(process.env.MAILGUN_API_BASE, region?.toLowerCase() === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net')

// ── HTTP ─────────────────────────────────────────────────────────────────────

async function request(url: string, init: RequestInit, label: string): Promise<{ status: number; body: any }> {
  let res: Response
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new SetupError(`${label} didn't respond. Try again in a moment.`)
  }
  const text = await res.text()
  let body: any = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {}
  return { status: res.status, body }
}

function explain(label: string, status: number, body: any): SetupError {
  if (status === 401 || status === 403) {
    return new SetupError(
      label === 'Cal.com'
        ? "Cal.com didn't allow BorsFlow to add a webhook to this account. Bookings still sync every hour."
        : `${label} didn't accept this API key for webhook setup. Use a key with full access, then retry.`
    )
  }
  const detail = body && typeof body === 'object'
    ? body.message || body.Message || body.error || body.errors?.[0]?.message
    : ''
  return new SetupError(`${label} couldn't add the webhook (${status}${detail ? `: ${detail}` : ''}). Try again in a moment.`)
}

/** Like `request`, but any non-2xx answer becomes a SetupError. */
async function call(url: string, init: RequestInit, label: string): Promise<any> {
  const { status, body } = await request(url, init, label)
  if (status < 200 || status >= 300) throw explain(label, status, body)
  return body
}

// ── Resend ───────────────────────────────────────────────────────────────────

function resendError(error: { message?: string; name?: string; statusCode?: number | null } | null): SetupError {
  const name = error?.name || ''
  if (name.includes('restricted') || name.includes('invalid_api_key') || error?.statusCode === 401 || error?.statusCode === 403) {
    return explain('Resend', 403, null)
  }
  return new SetupError(`Resend couldn't add the webhook${error?.message ? ` (${error.message})` : ''}. Try again in a moment.`)
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SetupError(`${label} didn't respond. Try again in a moment.`)), TIMEOUT_MS)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

async function setupResend(apiKey: string, url: string) {
  const { data, error } = await withTimeout(
    new Resend(apiKey).webhooks.create({ endpoint: url, events: [...RESEND_EVENTS] }),
    'Resend'
  )
  if (error || !data) throw resendError(error)
  if (!data.id || !data.signing_secret) throw new SetupError("Resend didn't return a signing secret. Try again in a moment.")
  return { webhookId: data.id, secret: data.signing_secret }
}

async function removeResend(apiKey: string, webhookId: string) {
  await withTimeout(new Resend(apiKey).webhooks.remove(webhookId), 'Resend')
}

// ── SendGrid ─────────────────────────────────────────────────────────────────

const sendgridHeaders = (apiKey: string) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' })

async function setupSendgrid(apiKey: string, url: string) {
  const created = await call(`${sendgridApi()}/v3/user/webhooks/event/settings`, {
    method: 'POST',
    headers: sendgridHeaders(apiKey),
    body: JSON.stringify({
      enabled: true,
      url,
      friendly_name: 'BorsFlow bounces and complaints',
      bounce: true,
      dropped: true,
      spam_report: true,
      unsubscribe: true,
      group_unsubscribe: true,
      delivered: false,
      processed: false,
      deferred: false,
      open: false,
      click: false,
      group_resubscribe: false,
    }),
  }, 'SendGrid')
  const webhookId = created?.id ? String(created.id) : ''
  if (!webhookId) throw new SetupError("SendGrid didn't return a webhook id. Try again in a moment.")

  // Signing can only be switched on after the webhook exists. Without it nothing
  // could be verified, so don't leave an unsigned webhook behind on failure.
  try {
    const signed = await call(`${sendgridApi()}/v3/user/webhooks/event/settings/signed/${webhookId}`, {
      method: 'PATCH',
      headers: sendgridHeaders(apiKey),
      body: JSON.stringify({ enabled: true }),
    }, 'SendGrid')
    if (!signed?.public_key) throw new SetupError("SendGrid didn't return a verification key. Try again in a moment.")
    return { webhookId, secret: String(signed.public_key) }
  } catch (err) {
    await removeSendgrid(apiKey, webhookId).catch(() => {})
    throw err
  }
}

async function removeSendgrid(apiKey: string, webhookId: string) {
  await call(`${sendgridApi()}/v3/user/webhooks/event/settings/${webhookId}`, {
    method: 'DELETE',
    headers: sendgridHeaders(apiKey),
  }, 'SendGrid')
}

// ── Mailgun ──────────────────────────────────────────────────────────────────

const mailgunAuth = (apiKey: string) => `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`

/**
 * The Mailgun domain to send from, found from the From address: the domain
 * itself, then a sending subdomain of it (mg.example.com for news@example.com),
 * then the account's only domain.
 */
export async function findMailgunDomain(apiKey: string, region: string | null | undefined, fromEmail: string): Promise<string> {
  const data = await call(`${mailgunApi(region)}/v4/domains?limit=1000`, {
    headers: { Authorization: mailgunAuth(apiKey) },
  }, 'Mailgun')
  const names: string[] = (data?.items || []).map((d: any) => String(d?.name || '')).filter(Boolean)
  const fromDomain = (fromEmail.split('@')[1] || '').toLowerCase()

  const match =
    names.find(n => n.toLowerCase() === fromDomain) ||
    names.find(n => n.toLowerCase().endsWith(`.${fromDomain}`)) ||
    (names.length === 1 ? names[0] : undefined)

  if (!match) {
    throw new SetupError(
      names.length
        ? `None of your Mailgun domains matches ${fromDomain || 'the From address'}. Send from an address on ${names.slice(0, 3).join(', ')}${names.length > 3 ? ' or another of your domains' : ''}.`
        : 'This Mailgun account has no sending domain yet. Add one in Mailgun, then retry.'
    )
  }
  return match
}

async function mailgunUrls(apiRoot: string, auth: string, domain: string, event: string): Promise<string[] | null> {
  const { status, body } = await request(`${apiRoot}/v3/domains/${encodeURIComponent(domain)}/webhooks/${event}`, {
    headers: { Authorization: auth },
  }, 'Mailgun')
  if (status === 404) return null
  if (status < 200 || status >= 300) throw explain('Mailgun', status, body)
  const webhook = body?.webhook || {}
  return Array.isArray(webhook.urls) ? webhook.urls : webhook.url ? [webhook.url] : []
}

function urlsForm(urls: string[]): URLSearchParams {
  const form = new URLSearchParams()
  for (const u of urls) form.append('url', u)
  return form
}

async function addMailgunUrl(apiRoot: string, auth: string, domain: string, event: string, url: string) {
  const headers = { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' }
  const existing = await mailgunUrls(apiRoot, auth, domain, event)
  if (existing === null) {
    await call(`${apiRoot}/v3/domains/${encodeURIComponent(domain)}/webhooks`, {
      method: 'POST',
      headers,
      body: new URLSearchParams({ id: event, url }),
    }, 'Mailgun')
    return
  }
  // The client already has a webhook for this event: add ours next to theirs.
  if (existing.includes(url)) return
  await call(`${apiRoot}/v3/domains/${encodeURIComponent(domain)}/webhooks/${event}`, {
    method: 'PUT',
    headers,
    body: urlsForm([...existing, url]),
  }, 'Mailgun')
}

async function removeMailgunUrl(apiRoot: string, auth: string, domain: string, event: string, url: string) {
  const existing = await mailgunUrls(apiRoot, auth, domain, event)
  if (!existing || !existing.includes(url)) return
  const others = existing.filter(u => u !== url)
  const endpoint = `${apiRoot}/v3/domains/${encodeURIComponent(domain)}/webhooks/${event}`
  if (others.length === 0) {
    await call(endpoint, { method: 'DELETE', headers: { Authorization: auth } }, 'Mailgun')
  } else {
    // Leave the client's own URLs for this event in place.
    await call(endpoint, {
      method: 'PUT',
      headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: urlsForm(others),
    }, 'Mailgun')
  }
}

async function mailgunSigningKey(apiRoot: string, auth: string): Promise<string> {
  const current = await request(`${apiRoot}/v5/accounts/http_signing_key`, { headers: { Authorization: auth } }, 'Mailgun')
  if (current.status >= 200 && current.status < 300 && current.body?.http_signing_key) {
    return String(current.body.http_signing_key)
  }
  if (current.status !== 404) throw explain('Mailgun', current.status, current.body)
  // No key on the account yet. Only create one when none exists: regenerating
  // would break any other integration the client verifies with it.
  const created = await call(`${apiRoot}/v5/accounts/http_signing_key`, { method: 'POST', headers: { Authorization: auth } }, 'Mailgun')
  if (!created?.http_signing_key) throw new SetupError("Mailgun didn't return a signing key. Try again in a moment.")
  return String(created.http_signing_key)
}

async function setupMailgun(apiKey: string, url: string, region: string | null, fromEmail: string) {
  const apiRoot = mailgunApi(region)
  const auth = mailgunAuth(apiKey)
  const domain = await findMailgunDomain(apiKey, region, fromEmail)
  const secret = await mailgunSigningKey(apiRoot, auth)

  const added: string[] = []
  try {
    for (const event of MAILGUN_EVENTS) {
      await addMailgunUrl(apiRoot, auth, domain, event, url)
      added.push(event)
    }
  } catch (err) {
    for (const event of added) await removeMailgunUrl(apiRoot, auth, domain, event, url).catch(() => {})
    throw err
  }
  return { webhookId: JSON.stringify(MAILGUN_EVENTS), secret, domain }
}

// ── Postmark ─────────────────────────────────────────────────────────────────

const postmarkHeaders = (serverToken: string) => ({
  'X-Postmark-Server-Token': serverToken,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})

async function setupPostmark(serverToken: string, url: string) {
  // Postmark does not sign webhooks; it sends these basic-auth credentials.
  const password = randomBytes(24).toString('base64url')
  const created = await call(`${postmarkApi()}/webhooks`, {
    method: 'POST',
    headers: postmarkHeaders(serverToken),
    body: JSON.stringify({
      Url: url,
      MessageStream: 'outbound', // the stream PostmarkProvider sends on
      HttpAuth: { Username: POSTMARK_WEBHOOK_USER, Password: password },
      Triggers: {
        Bounce: { Enabled: true, IncludeContent: false },
        SpamComplaint: { Enabled: true, IncludeContent: false },
        SubscriptionChange: { Enabled: true },
        Open: { Enabled: false },
        Click: { Enabled: false },
        Delivery: { Enabled: false },
      },
    }),
  }, 'Postmark')
  if (created?.ID === undefined || created?.ID === null) throw new SetupError("Postmark didn't return a webhook id. Try again in a moment.")
  return { webhookId: String(created.ID), secret: password }
}

async function removePostmark(serverToken: string, webhookId: string) {
  await call(`${postmarkApi()}/webhooks/${webhookId}`, { method: 'DELETE', headers: postmarkHeaders(serverToken) }, 'Postmark')
}

// ── Email providers ──────────────────────────────────────────────────────────

type ProviderRow = {
  id: string
  type: string
  apiKey: string | null
  region: string | null
  fromEmail: string
  domain: string | null
  webhookId: string | null
}

/** Removes the webhook BorsFlow created on the client's account, if any. Never throws. */
export async function disconnectProviderWebhook(provider: ProviderRow): Promise<void> {
  if (!provider.webhookId) return
  const apiKey = revealApiKey(provider.apiKey)
  const url = (webhookBaseUrl() || '') + emailWebhookPath(provider.id)
  try {
    switch (provider.type) {
      case 'resend':
        await removeResend(apiKey, provider.webhookId)
        break
      case 'sendgrid':
        await removeSendgrid(apiKey, provider.webhookId)
        break
      case 'postmark':
        await removePostmark(apiKey, provider.webhookId)
        break
      case 'mailgun': {
        if (!provider.domain) break
        const events: string[] = JSON.parse(provider.webhookId)
        const apiRoot = mailgunApi(provider.region)
        for (const event of events) {
          await removeMailgunUrl(apiRoot, mailgunAuth(apiKey), provider.domain, event, url).catch(() => {})
        }
        break
      }
    }
  } catch (err) {
    // The webhook may already be gone, or the key revoked; nothing else to do.
    console.warn(`[webhook-setup] could not remove ${provider.type} webhook for provider ${provider.id}:`, (err as Error).message)
  }
}

/**
 * Creates (or re-creates) the bounce/complaint webhook on the client's provider
 * account and stores the outcome. Never throws: a failure is saved as a status
 * the UI shows, with a Retry button.
 */
export async function connectProviderWebhook(providerId: string) {
  const provider = await prisma.emailProvider.findUnique({ where: { id: providerId } })
  if (!provider) return null

  const label = LABELS[provider.type] || provider.type
  let status: WebhookStatus
  let error: string | null = null
  let setup: { webhookId: string; secret: string; domain?: string } | null = null

  const publicBase = webhookBaseUrl()
  if (!AUTO_WEBHOOK_TYPES.includes(provider.type)) {
    status = 'unsupported'
    error = `Bounce and complaint tracking isn't available for ${label} yet. Sending works normally.`
  } else if (!publicBase) {
    status = 'waiting_public_url'
    error = 'Tracking turns on automatically once BorsFlow runs on its public HTTPS address.'
  } else {
    // Replace whatever this provider had before, e.g. on Retry.
    await disconnectProviderWebhook(provider)
    const url = publicBase + emailWebhookPath(provider.id)
    const apiKey = revealApiKey(provider.apiKey)
    try {
      switch (provider.type) {
        case 'resend':
          setup = await setupResend(apiKey, url)
          break
        case 'sendgrid':
          setup = await setupSendgrid(apiKey, url)
          break
        case 'mailgun':
          setup = await setupMailgun(apiKey, url, provider.region, provider.fromEmail)
          break
        case 'postmark':
          setup = await setupPostmark(apiKey, url)
          break
      }
      status = 'active'
    } catch (err) {
      status = 'error'
      error = err instanceof SetupError ? err.message : `Tracking couldn't be set up on ${label}. Try again in a moment.`
      if (!(err instanceof SetupError)) console.error(`[webhook-setup] ${provider.type} setup failed:`, err)
    }
  }

  return prisma.emailProvider.update({
    where: { id: provider.id },
    data: {
      webhookStatus: status,
      webhookError: error,
      webhookId: setup?.webhookId ?? null,
      webhookSecret: setup ? encrypt(setup.secret) : null,
      webhookUpdatedAt: new Date(),
      ...(setup?.domain ? { domain: setup.domain } : {}),
    },
  })
}

// ── Cal.com ──────────────────────────────────────────────────────────────────

type CalendarRow = { id: string; type: string; accessToken: string | null; webhookId: string | null }

function calcomToken(integration: CalendarRow): string {
  if (!integration.accessToken) return ''
  try {
    return decrypt(integration.accessToken)
  } catch {
    return ''
  }
}

/** Removes the booking webhook BorsFlow created on the client's Cal.com account. Never throws. */
export async function disconnectCalcomWebhook(integration: CalendarRow): Promise<void> {
  if (integration.type !== 'calcom' || !integration.webhookId) return
  try {
    await call(`${calcomApi()}/v2/webhooks/${integration.webhookId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${calcomToken(integration)}` },
    }, 'Cal.com')
  } catch (err) {
    console.warn(`[webhook-setup] could not remove Cal.com webhook for integration ${integration.id}:`, (err as Error).message)
  }
}

/**
 * Creates the booking webhook on the client's Cal.com account so new, moved and
 * cancelled bookings arrive right away. Never throws; hourly sync still runs
 * when this fails.
 */
export async function connectCalcomWebhook(integrationId: string) {
  const integration = await prisma.calendarIntegration.findUnique({ where: { id: integrationId } })
  if (!integration || integration.type !== 'calcom') return null

  let status: WebhookStatus
  let error: string | null = null
  let webhookId: string | null = null
  let secret: string | null = null

  const publicBase = webhookBaseUrl()
  if (!publicBase) {
    status = 'waiting_public_url'
    error = 'Live updates turn on automatically once BorsFlow runs on its public HTTPS address. Bookings still sync every hour.'
  } else {
    await disconnectCalcomWebhook(integration)
    try {
      // Cal.com signs each delivery with a secret chosen here, one per integration.
      const chosen = randomBytes(32).toString('hex')
      const created = await call(`${calcomApi()}/v2/webhooks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${calcomToken(integration)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriberUrl: publicBase + calcomWebhookPath(integration.id),
          triggers: CALCOM_TRIGGERS,
          active: true,
          secret: chosen,
        }),
      }, 'Cal.com')
      const id = created?.data?.id ?? created?.webhook?.id
      if (id === undefined || id === null) throw new SetupError("Cal.com didn't return a webhook id. Bookings still sync every hour.")
      webhookId = String(id)
      secret = chosen
      status = 'active'
    } catch (err) {
      status = 'error'
      error = err instanceof SetupError ? err.message : "Live updates couldn't be set up. Bookings still sync every hour."
      if (!(err instanceof SetupError)) console.error('[webhook-setup] Cal.com setup failed:', err)
    }
  }

  return prisma.calendarIntegration.update({
    where: { id: integration.id },
    data: {
      webhookStatus: status,
      webhookError: error,
      webhookId,
      webhookSecret: secret ? encrypt(secret) : null,
    },
  })
}
