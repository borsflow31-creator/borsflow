import { sendTransactionalEmail } from '@/lib/email'
import { isSendableTransactional } from '@/lib/email/suppression'

/**
 * Send a contractual or operational notice to a buyer: a payment reminder, a
 * document to sign.
 *
 * This is not a campaign, so it goes around the marketing opt-out. A buyer who
 * unsubscribed from the developer's newsletter still owes the payment that falls
 * due and must still be told about it; blocking the notice would hurt both of them.
 * It also carries no unsubscribe footer, which would offer an opt-out that does not
 * apply. What it does respect is `EmailSuppression` (hard bounces, spam complaints,
 * manual blocks): an address that has bounced is not mailed again whatever the
 * message is, because repeated bounces damage the sending domain for everyone.
 *
 * Returns 'suppressed' rather than throwing, since an undeliverable address is an
 * expected state to report, not an error to retry.
 */
export async function sendNoticeEmail(args: {
  workspaceId: string
  to: string
  subject: string
  html: string
  text: string
  /** Shown as "<name> via BorsFlow". */
  senderName: string
}): Promise<'sent' | 'suppressed'> {
  const to = args.to.trim().toLowerCase()
  if (!(await isSendableTransactional(to, args.workspaceId))) return 'suppressed'

  await sendTransactionalEmail({
    to,
    subject: args.subject,
    html: args.html,
    text: args.text,
    senderName: args.senderName,
  })
  return 'sent'
}
