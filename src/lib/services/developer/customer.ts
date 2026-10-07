import { prisma } from '@/lib/prisma'
import { parseStages } from '@/lib/crm/lifecycle'
import { scoreLead } from '@/lib/crm/lead-score'
import { visibleDocumentsWhere } from '@/lib/crm/document-access'
import { ServiceError } from '../errors'
import type { DeveloperContext } from './programs'

/**
 * Everything the Customer tab shows about one buyer, in a single round trip.
 *
 * The queries run in parallel and each reads only what its section prints. The
 * tab shows an overview and links outward for detail (the timeline and files are
 * their own components with their own paging), so this returns counts for those
 * rather than their contents.
 */
export async function getCustomerOverview(
  ctx: DeveloperContext,
  leadId: string,
  /** Owners and admins see managers-only documents; everyone else's count leaves them out. */
  canModerate = false
) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, pipeline: { workspaceId: ctx.workspaceId } },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      interestedProgram: { select: { id: true, name: true } },
      pipeline: { select: { stages: true } },
    },
  })
  if (!lead) throw new ServiceError('Lead not found in this workspace', 404)

  const [lots, visits, tasks, modifications, cancellations, fileCount, callCount, noteCount] = await Promise.all([
    prisma.developmentLot.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        OR: [{ buyerLeadId: leadId }, { optionHolderLeadId: leadId }],
      },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        type: true,
        typology: true,
        totalPrice: true,
        optionExpiresAt: true,
        reservedAt: true,
        contractSignedAt: true,
        buyerLeadId: true,
        program: { select: { id: true, name: true } },
        callsForFunds: { select: { id: true, amount: true, status: true, dueAt: true } },
        snags: { select: { id: true, room: true, trade: true, description: true, status: true, warrantyType: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.meeting.findMany({
      where: { workspaceId: ctx.workspaceId, leadId, programId: { not: null } },
      select: {
        id: true,
        startTime: true,
        status: true,
        outcome: true,
        program: { select: { id: true, name: true } },
        lot: { select: { id: true, lotNumber: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 20,
    }),
    prisma.leadTask.findMany({
      where: { workspaceId: ctx.workspaceId, leadId },
      include: { assignee: { select: { id: true, name: true, email: true } } },
      // Open ones first, soonest due; finished ones after, most recent.
      orderBy: [{ completedAt: { sort: 'asc', nulls: 'first' } }, { dueAt: 'asc' }],
      take: 30,
    }),
    prisma.tMARequest.findMany({
      where: { workspaceId: ctx.workspaceId, buyerLeadId: leadId },
      select: { id: true, reference: true, title: true, status: true, priceQuote: true, lot: { select: { lotNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.lotCancellation.findMany({
      where: { workspaceId: ctx.workspaceId, leadId },
      select: { id: true, previousStatus: true, reason: true, amount: true, cancelledAt: true, lot: { select: { lotNumber: true } } },
      orderBy: { cancelledAt: 'desc' },
      take: 10,
    }),
    prisma.leadFile.count({ where: { leadId, ...visibleDocumentsWhere(canModerate) } }),
    prisma.activity.count({ where: { leadId, type: 'call_logged' } }),
    prisma.activity.count({ where: { leadId, type: 'note_added' } }),
  ])

  const { breakdown } = scoreLead({
    ...lead,
    stages: parseStages(lead.pipeline.stages),
  })

  const now = Date.now()
  const units = lots.map(({ callsForFunds, snags, ...lot }) => {
    const called = callsForFunds.filter((c) => c.status !== 'draft')
    const paid = called.filter((c) => c.status === 'paid').reduce((t, c) => t + c.amount, 0)
    const calledTotal = called.reduce((t, c) => t + c.amount, 0)
    const overdue = called
      .filter((c) => c.status !== 'paid' && (c.status === 'overdue' || (c.dueAt !== null && c.dueAt.getTime() < now)))
      .reduce((t, c) => t + c.amount, 0)
    return {
      ...lot,
      // The unit's status says whether they hold it (optioned) or bought it.
      relation: lot.buyerLeadId === leadId ? ('buyer' as const) : ('option' as const),
      payments: { called: calledTotal, paid, overdue, due: calledTotal - paid },
      snags,
    }
  })

  const { pipeline: _pipeline, ...leadFields } = lead
  return {
    lead: leadFields,
    scoreBreakdown: breakdown,
    units,
    siteVisits: visits,
    tasks,
    modifications,
    cancellations,
    // The timeline and files are separate components; these are for their tab badges.
    counts: { files: fileCount, calls: callCount, notes: noteCount },
    totals: {
      contractValue: units.filter((u) => u.relation === 'buyer').reduce((t, u) => t + u.totalPrice, 0),
      paid: units.reduce((t, u) => t + u.payments.paid, 0),
      due: units.reduce((t, u) => t + u.payments.due, 0),
      overdue: units.reduce((t, u) => t + u.payments.overdue, 0),
    },
  }
}
