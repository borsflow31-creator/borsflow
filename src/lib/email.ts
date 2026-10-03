import { createHash } from 'crypto'
import { Resend, type CreateEmailOptions } from 'resend'
import nodemailer from 'nodemailer'
import { escapeHtml } from '@/lib/html'

// ─── Provider selection ──────────────────────────────────────────────────────
// Set EMAIL_PROVIDER=smtp in your .env to use SMTP instead of Resend.
// Defaults to "resend" when EMAIL_PROVIDER is not set.
const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase()

// Lazy-initialised so the app doesn't crash at startup when neither is configured.
let resendClient: Resend | null = null
function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

/**
 * Resend resolves with `{ data: null, error }` instead of throwing, so an
 * unverified sending domain, a rejected key or a provider outage all looked
 * like a successful send and the invitation UI reported "sent". Surface it as a
 * throw: every caller here already treats a throw as "not delivered".
 */
async function sendViaResend(payload: CreateEmailOptions, idempotencyKey?: string): Promise<void> {
  const { error } = await getResend().emails.send(payload, idempotencyKey ? { idempotencyKey } : undefined)
  if (error) {
    throw new Error(`${error.name}: ${error.message}`)
  }
}

/**
 * The From header. A bare EMAIL_FROM shows up in inboxes as "noreply", so give
 * it the product name unless the env value already carries a display name.
 */
function getFrom(): string {
  const address = process.env.EMAIL_FROM || 'noreply@yourdomain.com'
  return address.includes('<') ? address : `BorsFlow <${address}>`
}

/**
 * The origin emailed links point at. NEXT_PUBLIC_APP_URL is the deployed one,
 * but being a NEXT_PUBLIC_ var it has to be present at build time to be
 * reliable; NEXTAUTH_URL is already required for auth and names the same
 * origin, so prefer it over a localhost link the recipient cannot open.
 */
function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL
  if (configured) return configured.replace(/\/$/, '')

  // Falling through in production means every link we mail out points at the
  // recipient's own machine - a dead invitation that still looks sent. NextAuth
  // can infer its own origin from the request on Vercel, so a working sign-in
  // is not evidence that NEXTAUTH_URL is actually set; say so out loud rather
  // than let the invitation fail silently.
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[email] Neither NEXT_PUBLIC_APP_URL nor NEXTAUTH_URL is set. ' +
        'Emailed links will point at http://localhost:3000 and will not work. ' +
        'Set NEXT_PUBLIC_APP_URL at build time.'
    )
  }
  return 'http://localhost:3000'
}

function getSmtpTransporter() {
  const port = Number(process.env.SMTP_PORT) || 587
  // port 465 is always SSL; otherwise respect SMTP_SECURE env var
  const secure = port === 465 || process.env.SMTP_SECURE === 'true'
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })
}

// ─── Email template ──────────────────────────────────────────────────────────

interface InvitationEmailData {
  senderName: string
  senderEmail: string
  workspaceName: string
  workspaceIcon?: string
  role: string
  acceptUrl: string
  recipientEmail: string
}

// ─── Email layout ────────────────────────────────────────────────────────────
// BorsFlow's own mail (verification, invitations) wears DESIGN.md's paper
// palette and its one emerald signal. Paper, not obsidian: email is read on light
// grounds, and mail clients invert dark backgrounds unpredictably. Everything is
// inline and table-based because clients drop CSS variables, clamp(), flexbox and
// most <style> rules, so sizes are fixed steps from the documented type ramp.
const EMAIL = {
  ground: '#f7f7fa', // paper-base
  surface: '#ffffff', // paper-surface
  raised: '#f0f1f5', // paper-elevated
  hairline: '#e5e7ee', // paper-elevated-2, solid so Outlook draws it
  ink: '#0d0e15', // paper-text
  muted: '#52566b', // paper-muted
  signal: '#047857', // signal-emerald-paper
  display: "'Albert Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  text: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}

/** One paragraph of body copy (the "lead" role at its email size). */
function emailParagraph(html: string): string {
  return `<p style="margin:0 0 12px;font-family:${EMAIL.text};font-size:16px;line-height:1.6;color:${EMAIL.ink};">${html}</p>`
}

/**
 * The shared frame: wordmark, one card with a heading, the body, a single action
 * and a note, then a small footer saying why the mail arrived. Every argument
 * must already be escaped.
 */
function renderEmail(layout: {
  title: string
  preheader: string
  heading: string
  body: string
  action: { label: string; url: string }
  note: string
  footer: string
}): string {
  const { ground, surface, hairline, ink, muted, signal, display, text } = EMAIL
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${layout.title}</title>
</head>
<body style="margin:0;padding:0;background:${ground};">
  <div style="display:none;max-height:0;overflow:hidden;">${layout.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${ground};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 4px 20px;font-family:${display};font-size:17px;line-height:1.3;font-weight:700;letter-spacing:-0.02em;color:${ink};">BorsFlow</td>
          </tr>
          <tr>
            <td style="background:${surface};border:1px solid ${hairline};border-radius:20px;padding:32px;">
              <h1 style="margin:0 0 16px;font-family:${display};font-size:28px;line-height:1.25;font-weight:600;letter-spacing:-0.025em;color:${ink};">${layout.heading}</h1>
              ${layout.body}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                <tr>
                  <td style="border-radius:9999px;background:${signal};">
                    <a href="${layout.action.url}" style="display:inline-block;padding:14px 28px;font-family:${text};font-size:14px;line-height:1.4;font-weight:600;color:${surface};text-decoration:none;border-radius:9999px;">${layout.action.label}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-family:${text};font-size:14px;line-height:1.625;color:${muted};">${layout.note}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 4px 0;font-family:${text};font-size:12px;line-height:1.4;color:${muted};">${layout.footer}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function generateInvitationEmailTemplate(data: InvitationEmailData): string {
  // Every value is escaped: the workspace name, icon and sender name are user
  // input and were interpolated raw, so a workspace named with HTML injected
  // markup (links, images) into an email sent from our domain.
  const senderName = escapeHtml(data.senderName)
  const workspaceName = escapeHtml(data.workspaceName)
  const workspaceIcon = data.workspaceIcon ? escapeHtml(data.workspaceIcon) : undefined
  const role = escapeHtml(data.role.charAt(0).toUpperCase() + data.role.slice(1))
  const acceptUrl = escapeHtml(data.acceptUrl)
  const recipient = escapeHtml(data.recipientEmail)
  const { raised, hairline, ink, signal, display, text } = EMAIL

  const workspaceRow = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;border:1px solid ${hairline};border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;">
                    ${workspaceIcon ? `<span style="font-size:22px;line-height:1;vertical-align:middle;padding-right:8px;">${workspaceIcon}</span>` : ''}
                    <span style="font-family:${display};font-size:17px;line-height:1.3;font-weight:600;letter-spacing:-0.02em;color:${ink};vertical-align:middle;">${workspaceName}</span>
                    <span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:9999px;background:${raised};font-family:${text};font-size:12px;line-height:1.4;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:${signal};vertical-align:middle;">${role}</span>
                  </td>
                </tr>
              </table>`

  const senderEmail = escapeHtml(data.senderEmail)
  // Say plainly who invited whom, to what, and on which product: a bare
  // "Join Salam." read like spam to recipients who had never heard of BorsFlow.
  const sender =
    senderName === senderEmail ? `<strong>${senderName}</strong>` : `<strong>${senderName}</strong> (${senderEmail})`

  return renderEmail({
    title: `You're invited to the ${workspaceName} workspace on BorsFlow`,
    preheader: `${senderName} invited you to join the ${workspaceName} workspace on BorsFlow.`,
    heading: `You’re invited to the ${workspaceName} workspace on BorsFlow.`,
    body:
      emailParagraph(
        `${sender} invited you to join the <strong>${workspaceName}</strong> workspace on BorsFlow as ${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role}.`
      ) + workspaceRow,
    action: { label: 'Accept invitation', url: acceptUrl },
    note: 'The invitation expires in 7 days. No account yet? You’ll create one when you accept.',
    footer: `Sent to ${recipient} because ${senderName} invited you. Not expecting it? You can ignore this email.`,
  })
}

// ─── Send invitation ─────────────────────────────────────────────────────────

export async function sendInvitationEmail(
  email: string,
  workspaceName: string,
  workspaceIcon: string | null,
  senderName: string,
  senderEmail: string,
  role: string,
  token: string,
  invitationId: string
): Promise<void> {
  const appUrl = getAppUrl()
  const acceptUrl = `${appUrl}/invitations/${invitationId}?token=${token}`

  const emailData: InvitationEmailData = {
    senderName,
    senderEmail,
    workspaceName,
    workspaceIcon: workspaceIcon || undefined,
    role,
    acceptUrl,
    recipientEmail: email,
  }

  const html = generateInvitationEmailTemplate(emailData)
  const from = getFrom()
  const subject = `${senderName} invited you to the ${workspaceName} workspace on BorsFlow`

  if (EMAIL_PROVIDER === 'smtp') {
    const transporter = getSmtpTransporter()
    await transporter.sendMail({ from, to: email, subject, html })
  } else {
    // Default: Resend. Every (re)send mints a new token, so keying on it lets
    // Resend drop a duplicate of the same send without blocking a deliberate
    // resend. Hashed: the token is the invitee's bearer credential.
    const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 32)
    await sendViaResend({ from, to: email, subject, html }, `invitation-${invitationId}-${tokenHash}`)
  }
}

// ─── Send verification ───────────────────────────────────────────────────────

export async function sendVerificationEmail(
  email: string,
  token: string,
  /**
   * Where to send the user once the address is confirmed. An invited user signs
   * up mid-invitation, so without this they verify and land on the dashboard
   * with the invitation abandoned. Callers must pass a validated local path
   * (see `safeCallbackUrl`).
   */
  callbackUrl?: string | null
): Promise<void> {
  const appUrl = getAppUrl()
  // The page, not the API route: /api/auth/verify-email only accepts POST, so a
  // link straight to it answered every click with 405. The page reads the token
  // from the query string and POSTs it for us.
  const verifyUrl =
    `${appUrl}/verify-email?token=${encodeURIComponent(token)}` +
    (callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : '')

  // The copy says what happens next: the link verifies the address, then the
  // user signs in; it lasts as long as the token does (24 hours, see register).
  const html = renderEmail({
    title: 'Confirm your email',
    preheader: 'Confirm your email to finish creating your BorsFlow account.',
    heading: 'Confirm your email.',
    body: emailParagraph('Confirm this address to finish creating your BorsFlow account, then sign in.'),
    action: { label: 'Verify email', url: escapeHtml(verifyUrl) },
    note: 'The link works for 24 hours.',
    footer: `Sent to ${escapeHtml(email)} because it was used to sign up for BorsFlow. Didn’t sign up? You can ignore this email.`,
  })

  const from = getFrom()
  const subject = `Verify your email address`

  if (EMAIL_PROVIDER === 'smtp') {
    const transporter = getSmtpTransporter()
    await transporter.sendMail({ from, to: email, subject, html })
  } else {
    // Default: Resend
    await sendViaResend({ from, to: email, subject, html })
  }
}

// ─── Transactional email helper ──────────────────────────────────────────────
// Use this for one-off emails (invoices, quotes, invitations).
// Routes to SMTP when EMAIL_PROVIDER=smtp, otherwise uses Resend.

export interface EmailAttachment {
  /** Filename the recipient sees, e.g. `INV-2026-0001.pdf`. */
  filename: string
  content: Buffer
  contentType?: string
}

/**
 * "Acme Ltd via BorsFlow <noreply@…>": the workspace's name, sent from the
 * platform's verified address so it still passes SPF/DKIM. Quotes and invoices
 * go out on behalf of a workspace, so its name is what the recipient expects.
 */
function getFromOnBehalfOf(senderName: string): string {
  const configured = process.env.EMAIL_FROM || 'noreply@yourdomain.com'
  const address = configured.match(/<([^>]+)>/)?.[1] || configured
  // Quotes, backslashes and line breaks would break or inject header fields
  const name = senderName.replace(/["\\\r\n<>]/g, '').trim().slice(0, 80)
  return name ? `"${name} via BorsFlow" <${address}>` : getFrom()
}

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  attachments,
  senderName,
  replyTo,
}: {
  to: string
  subject: string
  html: string
  attachments?: EmailAttachment[]
  /** Shown as "<senderName> via BorsFlow"; omit for platform emails. */
  senderName?: string
  /** Where the recipient's reply goes, e.g. the user who sent the quote. */
  replyTo?: string
}): Promise<void> {
  const from = senderName ? getFromOnBehalfOf(senderName) : getFrom()

  if (EMAIL_PROVIDER === 'smtp') {
    const transporter = getSmtpTransporter()
    await transporter.sendMail({
      from,
      to,
      replyTo,
      subject,
      html,
      // Nodemailer takes the buffer directly.
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    })
  } else {
    await sendViaResend({
      from,
      to,
      replyTo,
      subject,
      html,
      // Resend's API expects the file contents base64-encoded.
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString('base64'),
      })),
    })
  }
}

// ─── SMTP connection check ────────────────────────────────────────────────────

export async function checkSmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const transporter = getSmtpTransporter()
    await transporter.verify()
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
