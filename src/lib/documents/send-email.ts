/**
 * Sending a quote or invoice email, from either of two senders:
 *
 * - `platform` (default): BorsFlow's verified address, shown as
 *   "<Workspace> via BorsFlow", with replies going to the user who sent it.
 * - `workspace`: the workspace's own connected email provider (the one set up
 *   under Email Marketing), so the email comes from the workspace's address.
 *   Only offered when one is connected; a failure is reported, never silently
 *   re-sent from the platform address the user chose not to use.
 */

import { prisma } from '@/lib/prisma'
import { sendTransactionalEmail, type EmailAttachment } from '@/lib/email'
import { emailMarketingService } from '@/lib/email-marketing'
import { isSupportedProviderType } from '@/lib/email/provider-keys'

export type DocumentSender = 'platform' | 'workspace'

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

export async function sendDocumentEmail({
  sendFrom = 'platform',
  workspaceId,
  workspaceName,
  replyTo,
  to,
  subject,
  html,
  attachments,
}: {
  sendFrom?: DocumentSender
  workspaceId: string
  workspaceName: string
  /** The sending user's address; used as Reply-To for platform sends. */
  replyTo?: string | null
  to: string
  subject: string
  html: string
  attachments: EmailAttachment[]
}): Promise<{ from: string }> {
  if (sendFrom === 'workspace') {
    const provider = await findWorkspaceSender(workspaceId)
    if (!provider) {
      throw new DocumentEmailError('This workspace has no connected email to send from. Connect one under Email Marketing, or send from BorsFlow.', 400)
    }
    await emailMarketingService.loadProviders(workspaceId)
    let result
    try {
      result = await emailMarketingService.sendEmail(
        { to, subject, html, attachments },
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
    return { from: provider.fromEmail }
  }

  await sendTransactionalEmail({
    to,
    subject,
    html,
    attachments,
    senderName: workspaceName,
    replyTo: replyTo || undefined,
  })
  return { from: `${workspaceName} via BorsFlow` }
}
