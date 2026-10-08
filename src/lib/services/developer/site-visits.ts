import { prisma } from '@/lib/prisma'
import { isWorkspaceMember } from '@/lib/crm/access'
import { CrmLogger } from '@/lib/crm/logger'
import { DEVELOPER_STAGE_SITE_VISIT, isSiteVisitOutcome } from '@/lib/crm/lifecycle'
import { ServiceError } from '../errors'
import { readBoolean, readNumber, readString } from '../parse'
import { createMeeting } from '../meetings'
import type { DeveloperContext } from './programs'
import { advanceBuyerLead } from './buyer-stage'
import { touchLead } from './lead-sync'
import { createTask } from './tasks'
import { autoTaskTitle } from '@/lib/crm/task-titles'

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_VISIT_MINUTES = 45

/**
 * A site visit is a Meeting with a project (and optionally a unit) attached, not
 * a parallel appointment system: the calendar, reminders and the Meetings page
 * already work, and a visit simply shows up in them. Agency viewings point at a
 * Property; these point at a Program, which is why they never appear in the
 * agency's viewings list.
 */

const visitInclude = {
  lead: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  program: { select: { id: true, name: true, city: true } },
  lot: { select: { id: true, lotNumber: true } },
  user: { select: { id: true, name: true, email: true } },
} as const

export type VisitWhen = 'upcoming' | 'past' | 'needs_outcome' | 'all'

export async function listSiteVisits(
  ctx: DeveloperContext,
  filters: { when?: VisitWhen; programId?: string; hostId?: string; leadId?: string } = {}
) {
  const now = new Date()
  const where: any = { workspaceId: ctx.workspaceId, programId: { not: null } }
  if (filters.programId) where.programId = filters.programId
  if (filters.hostId) where.userId = filters.hostId
  if (filters.leadId) where.leadId = filters.leadId

  const when = filters.when ?? 'upcoming'
  if (when === 'upcoming') {
    where.startTime = { gte: now }
    where.status = { in: ['scheduled', 'in_progress'] }
  } else if (when === 'past') {
    where.startTime = { lt: now }
  } else if (when === 'needs_outcome') {
    where.startTime = { lt: now }
    where.status = { in: ['scheduled', 'in_progress'] }
  }

  return prisma.meeting.findMany({
    where,
    include: visitInclude,
    orderBy: { startTime: when === 'upcoming' ? 'asc' : 'desc' },
    take: 300,
  })
}

export async function createSiteVisit(ctx: DeveloperContext, input: Record<string, unknown>) {
  const leadId = readString(input, 'leadId', 'Buyer', { required: true })!
  const programId = readString(input, 'programId', 'Project', { required: true })!
  const lotId = readString(input, 'lotId', 'Unit') ?? null
  const startTime = readString(input, 'startTime', 'Start time', { required: true })!
  const duration = readNumber(input, 'duration', 'Duration', { min: 5, integer: true }) ?? DEFAULT_VISIT_MINUTES
  const notes = readString(input, 'notes', 'Notes', { max: 2000 }) ?? null
  const hostId = readString(input, 'hostId', 'Host') ?? ctx.userId

  if (!(await isWorkspaceMember(ctx.workspaceId, hostId))) {
    throw new ServiceError('The host must be a member of this workspace')
  }

  const [lead, program] = await Promise.all([
    prisma.lead.findFirst({
      where: { id: leadId, pipeline: { workspaceId: ctx.workspaceId } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    }),
    prisma.program.findFirst({
      where: { id: programId, workspaceId: ctx.workspaceId },
      select: { id: true, name: true, addressLine: true, city: true },
    }),
  ])
  if (!lead) throw new ServiceError('Buyer not found in this workspace', 404)
  if (!program) throw new ServiceError('Project not found in this workspace', 404)

  // A unit has to belong to the project being visited.
  const lot = lotId
    ? await prisma.developmentLot.findFirst({
        where: { id: lotId, programId, workspaceId: ctx.workspaceId },
        select: { id: true, lotNumber: true },
      })
    : null
  if (lotId && !lot) throw new ServiceError('That unit is not part of this project', 404)

  const buyer = `${lead.firstName} ${lead.lastName}`.trim()
  const meeting = await createMeeting({
    workspaceId: ctx.workspaceId,
    userId: hostId,
    title: `Site visit: ${program.name}${lot ? ` · ${lot.lotNumber}` : ''} (${buyer})`,
    startTime,
    duration,
    platform: null,
    leadId,
    programId,
    lotId: lot?.id ?? null,
    location: [program.addressLine, program.city].filter(Boolean).join(', '),
    description: notes,
  })

  // The buyer as an attendee, when there is an address to invite them at.
  if (lead.email) {
    await prisma.meetingAttendee
      .create({
        data: {
          meetingId: meeting.id,
          name: buyer,
          email: lead.email,
          phone: lead.phone,
          type: 'lead',
          leadId,
        },
      })
      .catch(() => {})
  }

  await Promise.allSettled([
    CrmLogger.logEntity({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      type: 'site_visit_booked',
      entityType: 'lead',
      entityId: leadId,
      description: `Site visit booked: ${program.name}${lot ? ` · ${lot.lotNumber}` : ''}`,
      metadata: { program: program.name, unit: lot?.lotNumber ?? null, startTime: meeting.startTime.toISOString() },
      leadId,
      meetingId: meeting.id,
    }),
    advanceBuyerLead(ctx, leadId, DEVELOPER_STAGE_SITE_VISIT),
  ])

  return prisma.meeting.findUniqueOrThrow({ where: { id: meeting.id }, include: visitInclude })
}

/**
 * Records how a visit went.
 *
 * Attended or not is Meeting.status (completed / no_show); how it went is
 * Meeting.outcome, only meaningful for a visit that happened. What it triggers:
 *   interested / needs_follow_up  a follow-up task for tomorrow, so a warm buyer is
 *                                 not left waiting on someone to remember
 *   a no-show                     a task to rebook, for the same reason
 * and an attended visit counts as contact with the buyer.
 */
export async function recordSiteVisitOutcome(
  ctx: DeveloperContext,
  meetingId: string,
  input: Record<string, unknown>
) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, workspaceId: ctx.workspaceId, programId: { not: null } },
    include: { lead: { select: { id: true, firstName: true, lastName: true } }, program: { select: { name: true } } },
  })
  if (!meeting) throw new ServiceError('Site visit not found', 404)
  if (meeting.status === 'cancelled') throw new ServiceError('A cancelled visit has no outcome')

  const attended = readBoolean(input, 'attended', 'Attended')
  if (attended === undefined) throw new ServiceError('Say whether the buyer came')
  const comments = readString(input, 'comments', 'Comments', { max: 2000 }) ?? null

  let outcome: string | null = null
  if (attended) {
    const raw = readString(input, 'outcome', 'Outcome', { required: true })!
    if (!isSiteVisitOutcome(raw)) throw new ServiceError('Unknown outcome')
    outcome = raw
  }

  await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: attended ? 'completed' : 'no_show', outcome },
  })

  const leadId = meeting.leadId
  if (leadId) {
    const buyer = meeting.lead ? `${meeting.lead.firstName} ${meeting.lead.lastName}`.trim() : ''
    await CrmLogger.logEntity({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      type: 'site_visit_completed',
      entityType: 'lead',
      entityId: leadId,
      description: attended
        ? `Site visit done at ${meeting.program?.name ?? 'the project'}: ${outcome!.replace(/_/g, ' ')}`
        : `${buyer || 'Buyer'} did not attend the site visit at ${meeting.program?.name ?? 'the project'}`,
      metadata: { attended, outcome, comments },
      leadId,
      meetingId,
    })

    if (attended) await touchLead(leadId)

    // Whoever hosted it follows up, falling back to whoever recorded the outcome.
    const assigneeId = meeting.userId ?? ctx.userId
    const dueAt = new Date(Date.now() + DAY_MS)
    if (!attended) {
      await createTask(ctx, { leadId, type: 'call', title: autoTaskTitle('visitRebook', { name: buyer }), dueAt, assigneeId })
    } else if (outcome === 'interested' || outcome === 'needs_follow_up') {
      await createTask(ctx, { leadId, type: 'follow_up', title: autoTaskTitle('visitFollowUp', { name: buyer }), dueAt, assigneeId })
    }
  }

  return prisma.meeting.findUniqueOrThrow({ where: { id: meetingId }, include: visitInclude })
}
