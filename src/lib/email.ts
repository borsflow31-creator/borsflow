import { Resend } from 'resend'
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

function generateInvitationEmailTemplate(data: InvitationEmailData): string {
  // Every value is escaped: the workspace name, icon and sender name are user
  // input and were interpolated raw, so a workspace named with HTML injected
  // markup (links, images) into an email sent from our domain.
  const senderName = escapeHtml(data.senderName)
  const workspaceName = escapeHtml(data.workspaceName)
  const workspaceIcon = data.workspaceIcon ? escapeHtml(data.workspaceIcon) : undefined
  const role = escapeHtml(data.role)
  const acceptUrl = escapeHtml(data.acceptUrl)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to join ${workspaceName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 30px 20px; background: #f9fafb; border-radius: 0 0 8px 8px; }
    .invitation-card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
    .workspace-info { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; }
    .workspace-icon { font-size: 32px; }
    .workspace-name { font-size: 20px; font-weight: 600; color: #1f2937; }
    .role-badge { display: inline-block; padding: 4px 12px; background: #e0e7ff; color: #4338ca; border-radius: 9999px; font-size: 14px; font-weight: 500; }
    .button {
      display: inline-block;
      padding: 12px 32px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);
    }
    .button:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(99, 102, 241, 0.4); }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 13px; }
    .divider { height: 1px; background: #e5e7eb; margin: 20px 0; }
    .text-muted { color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 You're Invited!</h1>
    </div>
    <div class="content">
      <div class="invitation-card">
        <p style="margin-top: 0;">Hi there,</p>
        <p><strong>${senderName}</strong> has invited you to join the <strong>${workspaceName}</strong> workspace.</p>

        <div class="workspace-info">
          ${workspaceIcon ? `<span class="workspace-icon">${workspaceIcon}</span>` : ''}
          <div>
            <div class="workspace-name">${workspaceName}</div>
            <span class="role-badge">${role.charAt(0).toUpperCase() + role.slice(1)}</span>
          </div>
        </div>

        <div style="text-align: center;">
          <a href="${acceptUrl}" class="button">Accept Invitation</a>
        </div>

        <p class="text-muted" style="margin-bottom: 0;">
          This invitation will expire in 7 days. If you don't have an account yet, you'll be able to create one when you accept the invitation.
        </p>
      </div>

      <div class="divider"></div>

      <p class="text-muted" style="margin-bottom: 0;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0;">© 2026 BorsFlow. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
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
  const from = process.env.EMAIL_FROM || 'noreply@yourdomain.com'
  const subject = `You're invited to join ${workspaceName}`

  if (EMAIL_PROVIDER === 'smtp') {
    const transporter = getSmtpTransporter()
    await transporter.sendMail({ from, to: email, subject, html })
  } else {
    // Default: Resend
    await getResend().emails.send({ from, to: email, subject, html })
  }
}

// ─── Send verification ───────────────────────────────────────────────────────

export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  // The page, not the API route: /api/auth/verify-email only accepts POST, so a
  // link straight to it answered every click with 405. The page reads the token
  // from the query string and POSTs it for us.
  const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email address</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 30px 20px; background: #f9fafb; border-radius: 0 0 8px 8px; text-align: center; }
    .button {
      display: inline-block;
      padding: 12px 32px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to BorsFlow!</h1>
    </div>
    <div class="content">
      <p>Please click the button below to verify your email address and get started.</p>
      <a href="${verifyUrl}" class="button">Verify Email</a>
    </div>
  </div>
</body>
</html>`

  const from = process.env.EMAIL_FROM || 'noreply@yourdomain.com'
  const subject = `Verify your email address`

  if (EMAIL_PROVIDER === 'smtp') {
    const transporter = getSmtpTransporter()
    await transporter.sendMail({ from, to: email, subject, html })
  } else {
    // Default: Resend
    await getResend().emails.send({ from, to: email, subject, html })
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

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string
  subject: string
  html: string
  attachments?: EmailAttachment[]
}): Promise<void> {
  const from = process.env.EMAIL_FROM || 'noreply@yourdomain.com'

  if (EMAIL_PROVIDER === 'smtp') {
    const transporter = getSmtpTransporter()
    await transporter.sendMail({
      from,
      to,
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
    await getResend().emails.send({
      from,
      to,
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
