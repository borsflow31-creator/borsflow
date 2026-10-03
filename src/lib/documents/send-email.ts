/**
 * Sending a quote or invoice email, from either of two senders:
 *
 * - `platform` (default): BorsFlow's verified address, shown as
 *   "<Member name> via BorsFlow", with replies going to that member.
 * - `workspace`: the workspace's own connected email provider (the one set up
 *   under Email Marketing), shown as "<Member name> <sales@company.com>".
 *   Only offered when one is connected; a failure is reported, never silently
 *   re-sent from the platform address the user chose not to use.
 *
 * Every successful send is recorded as an Activity, so the workspace can see
 * which member sent which document, to whom, from which address and when.
 */

import { prisma } from '@/lib/prisma'
import { sendTransactionalEmail, type EmailAttachment } from '@/lib/email'
import { emailMarketingService } from '@/lib/email-marketing'
import { isSupportedProviderType } from '@/lib/email/provider-keys'

export type DocumentSender = 'platform' | 'workspace'
export type SentDocumentKind = 'quote' | 'invoice'

export class DocumentEmailError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/** The connected provider a workspace's documents would be sent through, if any. */
export async function findWorkspaceSender(workspaceId: string) {
  const providers = await prisma.emailProvider.findMany({
    where: { workspaceId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, type: true, fromEmail: true, fromName: true },
  })
  return providers.find((p) => isSupportedProviderType(p.type)) ?? null
}

/** A display name safe to put in a From header: no quotes, brackets, separators or line breaks. */
function cleanDisplayName(name: string | null | undefined): string {
  return (name || '').replace(/["\\\r\n<>,;]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export async function sendDocumentEmail({
  sendFrom = 'platform',
  workspaceId,
  userId,
  document,
  to,
  subject,
  html,
  attachments,
}: {
  sendFrom?: DocumentSender
  workspaceId: string
  /** The member sending it: their name is shown, replies go to them, and the send is attributed to them. */
  userId: string
  document: { kind: SentDocumentKind; id: string; number: string }
  to: string
  subject: string
  html: string
  attachments: EmailAttachment[]
}): Promise<{ from: string }> {
  const member = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
  const memberName = cleanDisplayName(member?.name) || cleanDisplayName(member?.email?.split('@')[0]) || 'BorsFlow'

  let from: string
  if (sendFrom === 'workspace') {
    const provider = await findWorkspaceSender(workspaceId)
    if (!provider) {
      throw new DocumentEmailError('This workspace has no connected email to send from. Connect one under Email Marketing, or send from BorsFlow.', 400)
    }
    await emailMarketingService.loadProviders(workspaceId)
    let result
    try {
      result = await emailMarketingService.sendEmail(
        { to, subject, html, attachments, fromName: memberName },
        { workspaceId, providerId: provider.id }
      )
    } catch (error: any) {
      result = { success: false, error: error?.message }
    }
    if (!result.success) {
      throw new DocumentEmailError(
        `Your connected email (${provider.fromEmail}) could not send this: ${result.error || 'unknown error'}`,
        502
      )
    }
    from = `${memberName} <${provider.fromEmail}>`
  } else {
    await sendTransactionalEmail({
      to,
      subject,
      html,
      attachments,
      senderName: memberName,
      replyTo: member?.email || undefined,
    })
    from = `${memberName} via BorsFlow`
  }

  // The email is out; a failed log write must not turn that into an error
  await prisma.activity
    .create({
      data: {
        workspaceId,
        userId,
        type: `${document.kind}_sent`,
        entityType: document.kind,
        entityId: document.id,
        description: `${document.kind === 'quote' ? 'Quote' : 'Invoice'} ${document.number} sent to ${to}`,
        metadata: JSON.stringify({ to, from, sendFrom, subject }),
      },
    })
    .catch((error) => console.error(`Failed to record ${document.kind} send:`, error))

  return { from }
}

/** Every recorded send of one document, newest first, with the member who sent it. */
export async function listDocumentSends(kind: SentDocumentKind, documentId: string, workspaceId: string) {
  const rows = await prisma.activity.findMany({
    where: { workspaceId, entityType: kind, entityId: documentId, type: `${kind}_sent` },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  return rows.map((row) => {
    let meta: Record<string, any> = {}
    try { meta = row.metadata ? JSON.parse(row.metadata) : {} } catch {}
    return {
      id: row.id,
      sentAt: row.createdAt,
      sentBy: row.user,
      to: meta.to ?? null,
      from: meta.from ?? null,
      sendFrom: meta.sendFrom ?? 'platform',
    }
  })
}
