import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { automationEngine } from '@/lib/automation-engine'
import { notify } from '@/lib/notifications/notify'
import { MANDATE_EXPIRY_WINDOW_DAYS } from '@/lib/crm/lifecycle'
import { expireDueMandates } from '@/lib/services/mandates'

const DAY_MS = 86_400_000

/**
 * The renewal work queue: active mandates ending within the window, plus any
 * active one already past its end date that the expiry sweep has not reached yet.
 * One definition, shared by the queue page and the watch, so "expiring" means the
 * same thing in the list an agent works and in the warnings they receive.
 */
export function expiringMandatesWhere(workspaceId: string | undefined, now = new Date()): Prisma.MandateWhereInput {
  const horizon = new Date(now.getTime() + MANDATE_EXPIRY_WINDOW_DAYS * DAY_MS)
  return { ...(workspaceId ? { workspaceId } : {}), status: 'active', endDate: { not: null, lte: horizon } }
}

/**
 * Everything that has to happen *because time passed* on a mandate.
 *
 * A mandate's expiry is not an event anything emits, so it has to be watched. One
 * run does three things, in an order that matters:
 *
 *  1. warn agents about mandates ending within the window -- the renewal calls;
 *  2. start any `mandate_expiring` automation for those mandates (the vendor
 *     reminder, the internal checklist);
 *  3. expire the mandates whose end date has passed, which de-lists the property.
 *
 * Expiry comes last on purpose: it follows the warning and never replaces it, so a
 * mandate that lapses overnight still got its reminders first.
 *
 * Each step is idempotent, so the cron can run as often as it likes: the
 * notification is deduplicated on (mandate, end date), enrollment on the unique
 * (automation, subject), and expiry only touches mandates still marked active.
 */
export async function runMandateWatch(now = new Date()): Promise<{ warned: number; enrolled: number; expired: number }> {
  const horizon = new Date(now.getTime() + MANDATE_EXPIRY_WINDOW_DAYS * DAY_MS)

  const expiring = await prisma.mandate.findMany({
    where: { status: 'active', endDate: { not: null, gt: now, lte: horizon } },
    select: {
      id: true, workspaceId: true, reference: true, endDate: true, ownerId: true,
      property: { select: { title: true, ownerId: true } },
      workspace: { select: { ownerId: true } },
    },
  })

  let warned = 0
  for (const m of expiring) {
    const days = Math.ceil((m.endDate!.getTime() - now.getTime()) / DAY_MS)
    const recipients = Array.from(new Set([m.ownerId, m.property.ownerId].filter((id): id is string => !!id)))
    if (recipients.length === 0) recipients.push(m.workspace.ownerId)

    void notify({
      recipients,
      type: 'crm.mandate_expiring',
      workspaceId: m.workspaceId,
      title: `Mandate ${m.reference} on ${m.property.title} ends in ${days} day${days === 1 ? '' : 's'}`,
      href: `/mandates?queue=expiring`,
      // One warning per end date: renewing and approaching a new one warns again.
      dedupeKey: `mandate.expiring:${m.id}:${m.endDate!.toISOString().slice(0, 10)}`,
    })
    warned++
  }

  const enrolled = await automationEngine.dispatchMandateExpiring(now)
  const { expired } = await expireDueMandates(now)

  return { warned, enrolled, expired }
}
