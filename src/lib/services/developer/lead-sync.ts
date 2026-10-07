import { prisma } from '@/lib/prisma'
import { parseStages } from '@/lib/crm/lifecycle'
import { scoreLead } from '@/lib/crm/lead-score'

/**
 * Keeps the derived columns on a lead in step with what drives them.
 *
 * Lead.nextFollowUpAt, lastContactedAt and score are stored so the board and the
 * "my leads" list can sort and filter on them without a join per card. Stored
 * derived data goes stale unless every path that changes its inputs also
 * refreshes it, so those paths -- tasks, call logs, site visits -- call these
 * rather than each writing the columns their own way.
 */

/** Points the lead's nextFollowUpAt at its earliest open task, or clears it. */
export async function syncLeadFollowUp(leadId: string): Promise<void> {
  const next = await prisma.leadTask.findFirst({
    where: { leadId, completedAt: null },
    orderBy: { dueAt: 'asc' },
    select: { dueAt: true },
  })
  await prisma.lead.update({
    where: { id: leadId },
    data: { nextFollowUpAt: next?.dueAt ?? null },
  })
}

/** Recomputes and stores a lead's score from its current state. */
export async function refreshLeadScore(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      email: true,
      phone: true,
      budgetMin: true,
      budgetMax: true,
      interestedProgramId: true,
      interestedTypology: true,
      source: true,
      stage: true,
      lastContactedAt: true,
      pipeline: { select: { stages: true } },
    },
  })
  if (!lead) return
  const { score } = scoreLead({
    ...lead,
    stages: parseStages(lead.pipeline.stages),
  })
  await prisma.lead.update({ where: { id: leadId }, data: { score } })
}

/**
 * Records that someone just spoke to the lead: a logged call, a completed
 * follow-up. Moves lastContactedAt forward (never back, so logging an old call
 * after a newer one does not rewind it) and rescored, since recency is part of the
 * score.
 */
export async function touchLead(leadId: string, at: Date = new Date()): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { lastContactedAt: true } })
  if (!lead) return
  if (!lead.lastContactedAt || lead.lastContactedAt < at) {
    await prisma.lead.update({ where: { id: leadId }, data: { lastContactedAt: at } })
  }
  await refreshLeadScore(leadId)
}
