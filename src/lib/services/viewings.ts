import { prisma } from '@/lib/prisma'
import { CrmLogger } from '@/lib/crm/logger'
import { INTEREST_STAGE, VERDICT_DIMENSIONS, VERDICTS, parseStages, resolveStage } from '@/lib/crm/lifecycle'
import { leadBelongsToWorkspace } from '@/lib/api/workspace'
import { notify } from '@/lib/notifications/notify'
import { ServiceError } from './errors'
import { createMeeting } from './meetings'
import { createInterest, updateInterest } from './interests'
import { readBoolean, readEnum, readId, readNumber, readString, has } from './parse'

type Input = Record<string, unknown>

export interface ViewingContext {
  workspaceId: string
  userId: string
}

/** A viewing as the app lists it: the meeting plus what it was a viewing of. */
export const viewingInclude = {
  property: { select: { id: true, title: true, reference: true, city: true, addressLine: true } },
  lead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  viewingFeedback: true,
} as const

/** Move a buyer's interest forward to a named stage, never back. */
async function advanceTo(interestId: string, stageName: string, ctx: ViewingContext) {
  const interest = await prisma.interest.findUnique({
    where: { id: interestId },
    select: { stage: true, pipeline: { select: { stages: true } } },
  })
  if (!interest) return
  const stages = parseStages(interest.pipeline.stages)
  const target = resolveStage(stages, stageName)
  if (!target || stages.indexOf(target) <= stages.indexOf(interest.stage)) return
  await updateInterest(interestId, ctx, { stage: target })
}

/**
 * Book a viewing: a Meeting plus the property shown and the buyer's interest in
 * it. There is no parallel appointment system, so calendar sync, attendees,
 * reminders and no-show tracking all work as they do for any meeting.
 *
 * Booking a viewing for a buyer implies they are interested in that property, so
 * if they are not attached yet they are, which keeps the board honest: a buyer
 * with a viewing on two properties has two interests, each progressing on its
 * own.
 */
export async function createViewing(ctx: ViewingContext, input: Input) {
  const propertyId = readId(input, 'propertyId', 'Property')
  if (!propertyId) throw new ServiceError('Pick a property')

  const property = await prisma.property.findFirst({
    where: { id: propertyId, workspaceId: ctx.workspaceId },
    select: { id: true, title: true, addressLine: true, city: true },
  })
  if (!property) throw new ServiceError('Property not found in this workspace')

  let interestId = readId(input, 'interestId', 'Interest')
  let leadId = readId(input, 'leadId', 'Buyer')

  if (interestId) {
    const interest = await prisma.interest.findFirst({
      where: { id: interestId, workspaceId: ctx.workspaceId, propertyId },
      select: { id: true, leadId: true },
    })
    if (!interest) throw new ServiceError('That buyer is not attached to this property')
    leadId = interest.leadId
  } else if (leadId) {
    if (!(await leadBelongsToWorkspace(leadId, ctx.workspaceId))) {
      throw new ServiceError('Buyer not found in this workspace')
    }
    const existing = await prisma.interest.findUnique({
      where: { propertyId_leadId: { propertyId, leadId } },
      select: { id: true },
    })
    interestId = existing?.id ?? (await createInterest(ctx, { leadId, propertyId, source: 'manual' })).id
  }

  const startTime = readString(input, 'startTime', 'Start time', { required: true })!
  const duration = readNumber(input, 'duration', 'Duration', { min: 5, integer: true }) ?? 30
  const location = [property.addressLine, property.city].filter(Boolean).join(', ')

  const meeting = await createMeeting({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    title: readString(input, 'title', 'Title', { max: 200 }) ?? `Viewing: ${property.title}`,
    startTime,
    duration,
    platform: null,
    leadId,
    propertyId,
    interestId,
    location,
    description: readString(input, 'notes', 'Notes', { max: 2000 }),
  })

  if (leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { firstName: true, lastName: true, email: true, phone: true },
    })
    // The buyer as an attendee, when we have an address to invite them at.
    if (lead?.email) {
      await prisma.meetingAttendee.create({
        data: {
          meetingId: meeting.id,
          name: `${lead.firstName} ${lead.lastName}`.trim(),
          email: lead.email,
          phone: lead.phone,
          type: 'lead',
          leadId,
        },
      }).catch(() => {})
    }
  }

  await Promise.allSettled([
    CrmLogger.logEntity({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      type: 'viewing_booked',
      entityType: 'viewing',
      entityId: meeting.id,
      description: `Viewing booked: ${property.title}`,
      metadata: { property: property.title, startTime: meeting.startTime.toISOString() },
      leadId: leadId ?? undefined,
      propertyId,
      interestId: interestId ?? undefined,
      meetingId: meeting.id,
    }),
    interestId ? advanceTo(interestId, INTEREST_STAGE.viewingBooked, ctx) : undefined,
  ])

  return prisma.meeting.findUniqueOrThrow({ where: { id: meeting.id }, include: viewingInclude })
}

const interestLevel = (input: Input) => {
  const level = readNumber(input, 'interestLevel', 'Interest level', { min: 1, integer: true })
  if (typeof level === 'number' && level > 5) throw new ServiceError('Interest level must be between 1 and 5')
  return level
}

/**
 * Record (or revise) the structured feedback on a viewing: a verdict per
 * dimension, an interest level and free text.
 *
 * Load-bearing twice: it refines the buyer's search brief, and it is the
 * substance of the vendor report. One row per viewing, so revising it is an
 * update, not a second row that would double-count in the report.
 *
 * Recording it also settles the meeting (completed, or a no-show if the buyer
 * did not come) and moves the buyer's interest to "viewing done".
 */
export async function recordViewingFeedback(meetingId: string, ctx: ViewingContext, input: Input) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, workspaceId: ctx.workspaceId },
    select: { id: true, propertyId: true, interestId: true, leadId: true, status: true, property: { select: { title: true, ownerId: true } } },
  })
  if (!meeting) throw new ServiceError('Viewing not found', 404)
  if (!meeting.propertyId || !meeting.property) throw new ServiceError('This meeting is not a viewing')
  if (!meeting.leadId) throw new ServiceError('This viewing has no buyer to record feedback for')

  const verdicts: Record<string, string | null | undefined> = {}
  for (const dimension of VERDICT_DIMENSIONS) {
    verdicts[`${dimension}Verdict`] = readEnum(input, `${dimension}Verdict`, `${dimension} verdict`, VERDICTS, { nullable: true })
  }
  const attended = readBoolean(input, 'attended', 'Attended')
  const comments = readString(input, 'comments', 'Comments', { max: 5000 })
  const level = interestLevel(input)

  const data = {
    ...(attended !== undefined ? { attended } : {}),
    ...(comments !== undefined ? { comments } : {}),
    ...(level !== undefined ? { interestLevel: level } : {}),
    ...Object.fromEntries(Object.entries(verdicts).filter(([, v]) => v !== undefined)),
    recordedById: ctx.userId,
  }

  const feedback = await prisma.viewingFeedback.upsert({
    where: { meetingId },
    create: {
      ...data,
      workspaceId: ctx.workspaceId,
      meetingId,
      propertyId: meeting.propertyId,
      interestId: meeting.interestId,
      leadId: meeting.leadId,
    },
    update: data,
  })

  // Settle the meeting. Only a still-open one: an agent who already marked it
  // cancelled keeps that.
  if (['scheduled', 'in_progress'].includes(meeting.status)) {
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: feedback.attended ? 'completed' : 'no_show' },
    })
  }

  const label = meeting.property.title
  await Promise.allSettled([
    CrmLogger.logEntity({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      type: 'viewing_feedback',
      entityType: 'viewing',
      entityId: meetingId,
      description: `Feedback on ${label}: interest ${feedback.interestLevel ?? '-'}/5`,
      metadata: {
        property: label,
        level: feedback.interestLevel,
        price: feedback.priceVerdict,
        condition: feedback.conditionVerdict,
        location: feedback.locationVerdict,
        layout: feedback.layoutVerdict,
        attended: feedback.attended,
      },
      leadId: meeting.leadId,
      propertyId: meeting.propertyId,
      interestId: meeting.interestId ?? undefined,
      meetingId,
    }),
    meeting.interestId && feedback.attended ? advanceTo(meeting.interestId, INTEREST_STAGE.viewingDone, ctx) : undefined,
    meeting.property.ownerId && meeting.property.ownerId !== ctx.userId
      ? Promise.resolve(
          notify({
            recipients: [meeting.property.ownerId],
            type: 'crm.viewing_feedback',
            workspaceId: ctx.workspaceId,
            actorId: ctx.userId,
            title: `Viewing feedback on ${label}`,
            href: `/properties/${meeting.propertyId}?tab=viewings`,
            dedupeKey: `viewing.feedback:${meetingId}`,
          })
        )
      : undefined,
  ])

  return feedback
}

export function hasFeedbackFields(input: Input): boolean {
  return ['attended', 'comments', 'interestLevel', ...VERDICT_DIMENSIONS.map(d => `${d}Verdict`)].some(k => has(input, k))
}
