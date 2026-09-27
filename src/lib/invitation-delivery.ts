import { sendInvitationEmail } from '@/lib/email'

/** What sendInvitationEmail needs from an invitation loaded with its relations. */
export interface DeliverableInvitation {
  id: string
  email: string
  role: string
  token: string
  workspace: { name: string; icon: string | null }
  sender: { name: string | null; email: string }
}

export type DeliveryResult =
  | { emailSent: true }
  | { emailSent: false; reason: 'suppressed' | 'provider_error'; emailError: string }

/**
 * Send the invitation email without ever throwing.
 *
 * An invitation row is created (or revived) whether or not the mail goes out,
 * so the admin can still copy the link. This reports the *third* outcome -
 * "saved but not delivered" - and why, so callers can tell a bounced address
 * (`suppressed`) from a mail-provider outage (`provider_error`).
 *
 * `sendable` comes from the transactional suppression check; callers do that
 * lookup themselves so the bulk path can batch it.
 */
export async function deliverInvitationEmail(
  invitation: DeliverableInvitation,
  sendable: boolean
): Promise<DeliveryResult> {
  if (!sendable) {
    return {
      emailSent: false,
      reason: 'suppressed',
      emailError: 'This address has previously bounced, so no email was sent.',
    }
  }

  try {
    await sendInvitationEmail(
      invitation.email,
      invitation.workspace.name,
      invitation.workspace.icon,
      invitation.sender.name || invitation.sender.email,
      invitation.sender.email,
      invitation.role,
      invitation.token,
      invitation.id
    )
    return { emailSent: true }
  } catch (err: any) {
    console.error('Failed to send invitation email:', err)
    return {
      emailSent: false,
      reason: 'provider_error',
      emailError: err?.message ?? String(err),
    }
  }
}
