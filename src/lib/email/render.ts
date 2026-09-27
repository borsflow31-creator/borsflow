/**
 * Merge-tag rendering
 *
 * Templates authored in EmailBlockEditor contain `{{token}}` placeholders. Nothing
 * substituted them before this module existed, so recipients received literal braces.
 * Both the campaign path and the automation path render through here so a template
 * behaves identically whichever one sends it.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { escapeHtml } from '@/lib/html'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || 'default-secret'

// The token signs the workspace as well as the address: an unsubscribe applies
// only to the client whose email carried the link, and the workspace in the URL
// cannot be swapped for another client's.
function unsubscribeToken(email: string, workspaceId: string): string {
  return createHmac('sha256', UNSUBSCRIBE_SECRET).update(`${workspaceId}:${email}`).digest('hex')
}

export function buildUnsubscribeUrl(email: string, workspaceId: string): string {
  const params = new URLSearchParams({ email, w: workspaceId, token: unsubscribeToken(email, workspaceId) })
  return `${APP_URL}/api/email-tracking/unsubscribe?${params.toString()}`
}

/** True when `token` is the signature buildUnsubscribeUrl put in this address's link for this workspace. */
export function verifyUnsubscribeToken(email: string, workspaceId: string, token: string | null | undefined): boolean {
  if (!token || !workspaceId) return false
  const expected = Buffer.from(unsubscribeToken(email, workspaceId))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/** Lead shape the tags read from. `pipeline` is optional so callers that didn't include it still work. */
export interface MergeLead {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  position?: string | null
  status?: string | null
  stage?: string | null
  source?: string | null
  value?: number | null
  pipeline?: { name?: string | null } | null
}

export interface MergeContext {
  lead: MergeLead
  /** Falls back to `lead.email`; needed for the unsubscribe token. */
  recipientEmail?: string
  /** The sending workspace; the unsubscribe link is scoped to it. */
  workspaceId: string
  workspaceName?: string | null
}

function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function buildTokenMap(ctx: MergeContext): Record<string, string> {
  const { lead } = ctx
  const first = (lead.firstName || '').trim()
  const last = (lead.lastName || '').trim()
  const recipientEmail = ctx.recipientEmail || lead.email || ''

  return {
    first_name: first,
    last_name: last,
    full_name: `${first} ${last}`.trim(),
    name: `${first} ${last}`.trim(),
    email: recipientEmail,
    phone: lead.phone || '',
    company: lead.company || '',
    position: lead.position || '',
    status: lead.status || '',
    stage: lead.stage || '',
    source: lead.source || '',
    value: formatValue(lead.value),
    pipeline_name: lead.pipeline?.name || '',
    company_name: ctx.workspaceName || '',
    unsubscribe_url: recipientEmail ? buildUnsubscribeUrl(recipientEmail, ctx.workspaceId) : '',
  }
}

// `{{ First_Name }}` and `{{first_name}}` resolve to the same token.
const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/**
 * Replaces every `{{token}}` in `content`. Unknown tokens collapse to an empty
 * string rather than leaking braces into the recipient's inbox.
 *
 * `escape` is off for URL-valued tokens (`unsubscribe_url`) since they are
 * generated here, not supplied by a user.
 */
export function renderMergeTags(content: string, ctx: MergeContext): string {
  if (!content) return content

  const tokens = buildTokenMap(ctx)

  return content.replace(TOKEN_PATTERN, (_match, rawToken: string) => {
    const key = rawToken.toLowerCase()
    if (!(key in tokens)) return ''
    const value = tokens[key]
    return key === 'unsubscribe_url' ? value : escapeHtml(value)
  })
}

/** Convenience for the three fields every send renders together. */
export function renderEmailFields(
  fields: { subject: string; html: string; text?: string | null },
  ctx: MergeContext
): { subject: string; html: string; text?: string } {
  return {
    subject: renderMergeTags(fields.subject, ctx),
    html: renderMergeTags(fields.html, ctx),
    text: fields.text ? renderMergeTags(fields.text, ctx) : undefined,
  }
}
