import { prisma } from '@/lib/prisma'
import { escapeHtml } from '@/lib/html'
import { ensureUnsubscribeFooter } from '@/lib/email/render'
import { isSendable } from '@/lib/email/suppression'

/**
 * Queue one email to one contact outside a campaign or an automation step: a
 * new-listing digest, a vendor report.
 *
 * It follows the same path as every other send -- an Email row, its recipient, a
 * tracking row, an entry in the queue that process-email-queue drains -- so
 * provider selection, retries, bounces and unsubscribes all work as they do for a
 * campaign. Two things are checked here rather than left to the caller, because
 * both are the kind of check that gets forgotten on a new send path:
 *
 *  - suppression: a captured address must never resurrect a suppressed or
 *    unsubscribed one (isSendable);
 *  - the unsubscribe footer: every marketing-style send carries one.
 *
 * Returns the Email id, or null when the address is suppressed or empty.
 */
export async function queueDirectEmail(params: {
  workspaceId: string
  leadId: string | null
  email: string | null | undefined
  name?: string | null
  subject: string
  /** Body HTML. The unsubscribe footer is added. */
  html: string
  text?: string
}): Promise<string | null> {
  const email = params.email?.trim()
  if (!email) return null
  if (!(await isSendable(email, params.workspaceId))) return null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const trackingId = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  const pixel = `<img src="${appUrl}/api/email-tracking/open/${trackingId}" width="1" height="1" style="display:none;" alt="" />`
  const html = ensureUnsubscribeFooter(params.html, email, params.workspaceId) + pixel

  const created = await prisma.email.create({
    data: {
      workspaceId: params.workspaceId,
      subject: params.subject,
      htmlContent: html,
      textContent: params.text,
      status: 'pending',
    },
  })
  await prisma.emailRecipient.create({
    data: {
      emailId: created.id,
      leadId: params.leadId,
      recipientEmail: email,
      recipientName: params.name || null,
      status: 'pending',
    },
  })
  await prisma.emailTracking.create({
    data: { emailId: created.id, trackingId, openCount: 0, clickCount: 0 },
  })

  const { emailQueueService } = await import('@/lib/email-queue')
  await emailQueueService.enqueue(created.id, { priority: 5, scheduledFor: new Date() })

  return created.id
}

/** Wrap body content in the plain frame these mails share. Values must already be escaped. */
export function emailFrame(heading: string, inner: string): string {
  return `<div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1c1e2b;">
  <h1 style="font-size:20px;margin:0 0 16px;">${escapeHtml(heading)}</h1>
  ${inner}
</div>`
}
