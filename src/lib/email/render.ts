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
 * Where the rendered text is going, which decides whether values are escaped.
 *
 * A subject line and a plain-text part are not HTML: escaping them means a lead
 * at "Smith & Co" gets mail addressed to "Smith &amp; Co", and an apostrophe in
 * a name arrives as `&#39;`. Only the HTML part can afford — and needs — the
 * escaping that stops a lead's own fields injecting markup.
 */
export type MergeTarget = 'html' | 'text'

/**
 * Replaces every `{{token}}` in `content`. Unknown tokens collapse to an empty
 * string rather than leaking braces into the recipient's inbox.
 *
 * Values are escaped for `target: 'html'` only. URL-valued tokens
 * (`unsubscribe_url`) are never escaped: they are generated here, not supplied
 * by a user.
 */
export function renderMergeTags(content: string, ctx: MergeContext, target: MergeTarget = 'html'): string {
  if (!content) return content

  const tokens = buildTokenMap(ctx)

  return content.replace(TOKEN_PATTERN, (_match, rawToken: string) => {
    const key = rawToken.toLowerCase()
    if (!(key in tokens)) return ''
    const value = tokens[key]
    if (target === 'text' || key === 'unsubscribe_url') return value
    return escapeHtml(value)
  })
}

/**
 * True when the HTML already offers the recipient a way out.
 *
 * Both editors put one there themselves — the block editor's own footer carries
 * `{{unsubscribe_url}}`, and the simple editor has a toggle for it — so a send
 * that appends one unconditionally ships two, which reads as a mistake and
 * invites the spam button we are trying to avoid.
 */
function hasUnsubscribeLink(html: string): boolean {
  return /\/email-tracking\/unsubscribe|\{\{\s*unsubscribe_url\s*\}\}|>\s*unsubscribe\b/i.test(html)
}

/**
 * Guarantee one unsubscribe link, never two.
 *
 * Call this after merge tags are rendered, so a `{{unsubscribe_url}}` the
 * template supplied has already become a real URL and is found here.
 */
export function ensureUnsubscribeFooter(html: string, recipientEmail: string, workspaceId: string): string {
  if (hasUnsubscribeLink(html)) return html

  const unsubUrl = buildUnsubscribeUrl(recipientEmail, workspaceId)
  // Says which list, in the recipient's terms: "you signed up or were added to
  // our list" is the sending workspace talking, but the mail is read next to
  // everything else in an inbox, where "our" means nothing.
  const footer = `
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7ee;text-align:center;font-family:'DM Sans',-apple-system,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.5;color:#52566b;">
  <p style="margin:0 0 6px;">You received this because ${escapeHtml(recipientEmail)} is on this mailing list.</p>
  <p style="margin:0;"><a href="${unsubUrl}" style="color:#52566b;">Unsubscribe from these emails</a></p>
</div>`

  if (html.includes('</body>')) {
    return html.replace('</body>', `${footer}</body>`)
  }
  return html + footer
}

/** Convenience for the three fields every send renders together. */
export function renderEmailFields(
  fields: { subject: string; html: string; text?: string | null },
  ctx: MergeContext
): { subject: string; html: string; text?: string } {
  return {
    subject: renderMergeTags(fields.subject, ctx, 'text'),
    html: renderMergeTags(fields.html, ctx),
    text: fields.text ? renderMergeTags(fields.text, ctx, 'text') : undefined,
  }
}
