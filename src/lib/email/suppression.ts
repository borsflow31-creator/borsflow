/**
 * Send-time suppression guard
 *
 * `EmailSuppression` and `EmailUnsubscribe` were written by the provider webhooks
 * and the unsubscribe link but never read before a send, so unsubscribed and
 * hard-bounced addresses kept receiving mail. Every send path now filters here.
 *
 * Both lists are per workspace. Each client sends through their own provider
 * account, so a bounce or opt-out only means something for the client whose mail
 * caused it; a global list let one client stop every other client from emailing
 * an address. Rows without a workspace predate that and are ignored.
 *
 * Note this checks `expiresAt`, which `emailTrackingService.isEmailSuppressed()`
 * ignores — a soft-bounce suppression is meant to lapse.
 */

import { prisma } from '@/lib/prisma'

/** True when `workspaceId` may send to this address. */
export async function isSendable(email: string, workspaceId: string): Promise<boolean> {
  if (!email) return false
  return (await filterSendable([email], workspaceId)).size === 1
}

/**
 * Batch form for campaign fan-out — two queries instead of 2N.
 * Returns the subset of `emails` that `workspaceId` may send to.
 */
export async function filterSendable(emails: string[], workspaceId: string): Promise<Set<string>> {
  const candidates = Array.from(new Set(emails.filter(Boolean)))
  if (candidates.length === 0) return new Set()

  const now = new Date()

  const [suppressed, unsubscribed] = await Promise.all([
    prisma.emailSuppression.findMany({
      where: {
        workspaceId,
        email: { in: candidates },
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { email: true },
    }),
    prisma.emailUnsubscribe.findMany({
      where: { workspaceId, email: { in: candidates } },
      select: { email: true },
    }),
  ])

  const blocked = new Set<string>()
  for (const row of suppressed) blocked.add(row.email)
  for (const row of unsubscribed) blocked.add(row.email)

  return new Set(candidates.filter(email => !blocked.has(email)))
}

/**
 * Transactional variants - for mail the recipient did not sign up to receive as
 * a campaign, such as a workspace invitation a colleague sent them.
 *
 * These consult `EmailSuppression` only (bounces, complaints, manual blocks) and
 * deliberately ignore `EmailUnsubscribe`, which records a marketing opt-out.
 * Someone who unsubscribed from a newsletter must still be able to receive an
 * invitation; an address that hard-bounces must not be mailed again, whatever
 * the message is, because repeated bounces damage the sending domain.
 *
 * Only the sending workspace's own suppressions count, so no client can block
 * another client's invitations by reporting an address as bounced.
 *
 * Suppression rows are written by provider webhooks and may not be lowercase,
 * so matching here is case-insensitive. `emails` are expected pre-normalised.
 */
export async function filterSendableTransactional(emails: string[], workspaceId: string): Promise<Set<string>> {
  const candidates = Array.from(new Set(emails.filter(Boolean)))
  if (candidates.length === 0) return new Set()

  const suppressed = await prisma.emailSuppression.findMany({
    where: {
      workspaceId,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      // Prisma has no case-insensitive `in`, so expand to one clause per address.
      AND: [
        {
          OR: candidates.map(email => ({
            email: { equals: email, mode: 'insensitive' as const },
          })),
        },
      ],
    },
    select: { email: true },
  })

  const blocked = new Set(suppressed.map(row => row.email.toLowerCase()))
  return new Set(candidates.filter(email => !blocked.has(email.toLowerCase())))
}

/** Single-address form of {@link filterSendableTransactional}. */
export async function isSendableTransactional(email: string, workspaceId: string): Promise<boolean> {
  if (!email) return false
  return (await filterSendableTransactional([email], workspaceId)).size === 1
}
