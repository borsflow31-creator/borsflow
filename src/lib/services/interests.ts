import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CrmLogger } from '@/lib/crm/logger'
import { reorderInColumn } from '@/lib/crm/reorder'
import { onSubjectCreated, onSubjectStageChanged } from '@/lib/crm/subject-events'
import { isWorkspaceMember } from '@/lib/crm/access'
import { INTEREST_SOURCES, INTEREST_STATUSES, parseStages, resolveStage, type InterestStatus } from '@/lib/crm/lifecycle'
import { leadBelongsToWorkspace } from '@/lib/api/workspace'
import { ServiceError } from './errors'
import { resolveBoard } from './pipelines'
import { defined, has, readEnum, readId, readNumber, readString } from './parse'

type Input = Record<string, unknown>

export interface InterestContext {
  workspaceId: string
  userId: string
}

/** An interest with the buyer and property a card or a list row needs. */
export const interestInclude = {
  lead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  property: { select: { id: true, title: true, reference: true, city: true, price: true, currency: true, status: true } },
  owner: { select: { id: true, name: true, email: true } },
} satisfies Prisma.InterestInclude

function buyerName(lead: { firstName: string; lastName: string }): string {
  return `${lead.firstName} ${lead.lastName}`.trim()
}

/**
 * Attach a buyer to a property. This row, not the lead, is what moves across the
 * buyer board, so one buyer can sit at "offer" on one property and "viewing
 * booked" on another at the same time.
 *
 * A buyer and a property can be joined once: a second attempt is a 409 rather
 * than a duplicate card.
 */
export async function createInterest(ctx: InterestContext, input: Input) {
  const leadId = readId(input, 'leadId', 'Buyer')
  const propertyId = readId(input, 'propertyId', 'Property')
  if (!leadId) throw new ServiceError('Buyer is required')
  if (!propertyId) throw new ServiceError('Property is required')

  if (!(await leadBelongsToWorkspace(leadId, ctx.workspaceId))) {
    throw new ServiceError('Buyer not found in this workspace')
  }
  const property = await prisma.property.findFirst({
    where: { id: propertyId, workspaceId: ctx.workspaceId },
    select: { id: true, title: true, ownerId: true },
  })
  if (!property) throw new ServiceError('Property not found in this workspace')

  const ownerId = readId(input, 'ownerId', 'Selling agent')
  if (ownerId && !(await isWorkspaceMember(ctx.workspaceId, ownerId))) {
    throw new ServiceError('The selling agent must be a member of this workspace')
  }

  const board = await resolveBoard(ctx.workspaceId, 'Interest', readId(input, 'pipelineId', 'Board'))
  const requestedStage = readString(input, 'stage', 'Stage')
  const stage = requestedStage ? resolveStage(board.stages, requestedStage) : board.stages[0]
  if (!stage) throw new ServiceError(requestedStage ? `"${requestedStage}" is not a stage on this board` : 'The buyer board has no stages')

  const last = await prisma.interest.findFirst({
    where: { pipelineId: board.id, stage },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  let interest
  try {
    interest = await prisma.interest.create({
      data: {
        workspaceId: ctx.workspaceId,
        pipelineId: board.id,
        stage,
        order: (last?.order ?? -1) + 1,
        leadId,
        propertyId,
        status: 'active',
        source: readEnum(input, 'source', 'Source', INTEREST_SOURCES, { nullable: true }) ?? 'manual',
        searchBriefId: readId(input, 'searchBriefId', 'Search brief') ?? null,
        matchScore: readNumber(input, 'matchScore', 'Match score', { min: 0 }) ?? null,
        notes: readString(input, 'notes', 'Notes', { max: 5000 }) ?? null,
        // The selling agent defaults to whoever attached the buyer: attribution is
        // captured here, not inferred when the commission is worked out.
        ownerId: ownerId ?? ctx.userId,
        createdById: ctx.userId,
        lastActivityAt: new Date(),
      },
      include: interestInclude,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ServiceError('This buyer is already attached to this property', 409)
    }
    throw error
  }

  const name = buyerName(interest.lead)
  await CrmLogger.logEntity({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    type: 'interest_created',
    entityType: 'interest',
    entityId: interest.id,
    description: `${name} is now interested in ${interest.property.title}`,
    metadata: { buyer: name, property: interest.property.title, stage },
    leadId,
    propertyId,
    interestId: interest.id,
  })

  // A new interest is a creation and also its first stage entry: a sequence can
  // key on either ("when an interest is created", "when it enters Enquiry").
  await onSubjectCreated({ subjectType: 'Interest', subjectId: interest.id, pipelineId: board.id, workspaceId: ctx.workspaceId })
  await onSubjectStageChanged({
    subjectType: 'Interest',
    subjectId: interest.id,
    pipelineId: board.id,
    workspaceId: ctx.workspaceId,
    fromStage: '',
    toStage: stage,
  })

  return interest
}

export async function updateInterest(id: string, ctx: InterestContext, input: Input) {
  const current = await prisma.interest.findUnique({
    where: { id },
    include: { ...interestInclude, pipeline: { select: { stages: true } } },
  })
  if (!current || current.workspaceId !== ctx.workspaceId) throw new ServiceError('Interest not found', 404)

  const stages = parseStages(current.pipeline.stages)
  const data: Record<string, any> = defined({
    notes: readString(input, 'notes', 'Notes', { max: 5000 }),
    source: readEnum(input, 'source', 'Source', INTEREST_SOURCES, { nullable: true }),
    lostReason: readString(input, 'lostReason', 'Lost reason', { max: 500 }),
  })

  const ownerId = readId(input, 'ownerId', 'Selling agent')
  if (ownerId && !(await isWorkspaceMember(ctx.workspaceId, ownerId))) {
    throw new ServiceError('The selling agent must be a member of this workspace')
  }
  if (ownerId !== undefined) data.ownerId = ownerId

  const requestedStage = readString(input, 'stage', 'Stage')
  let nextStage = current.stage
  if (requestedStage && requestedStage !== current.stage) {
    const resolved = resolveStage(stages, requestedStage)
    if (!resolved) throw new ServiceError(`"${requestedStage}" is not a stage on this board`)
    nextStage = resolved
  }
  const stageChanged = nextStage !== current.stage

  const requestedStatus = readEnum(input, 'status', 'Status', INTEREST_STATUSES) as InterestStatus | undefined
  const statusChanged = !!requestedStatus && requestedStatus !== current.status
  if (statusChanged) {
    data.status = requestedStatus
    // A reopened interest has no reason to stay marked lost.
    if (requestedStatus !== 'lost') data.lostReason = null
  }

  const orderRequested = typeof input.order === 'number' ? input.order : undefined
  if (stageChanged || has(input, 'status') || has(input, 'stage')) data.lastActivityAt = new Date()
  if (stageChanged) data.stage = nextStage

  await prisma.$transaction(async (tx) => {
    if (stageChanged && orderRequested === undefined) {
      const last = await tx.interest.findFirst({
        where: { pipelineId: current.pipelineId, stage: nextStage, id: { not: id } },
        orderBy: { order: 'desc' },
        select: { order: true },
      })
      data.order = (last?.order ?? -1) + 1
    }
    await tx.interest.update({ where: { id }, data })
    if (orderRequested !== undefined) {
      await reorderInColumn(tx, 'Interest', { id, pipelineId: current.pipelineId, stage: nextStage, order: orderRequested })
    }
  })

  const interest = await prisma.interest.findUniqueOrThrow({ where: { id }, include: interestInclude })
  const name = buyerName(interest.lead)
  const base = {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    entityType: 'interest' as const,
    entityId: id,
    leadId: interest.leadId,
    propertyId: interest.propertyId,
    interestId: id,
  }

  await Promise.allSettled([
    stageChanged
      ? CrmLogger.logEntity({
          ...base,
          type: 'interest_stage_changed',
          description: `${name} moved from "${current.stage}" to "${nextStage}" on ${interest.property.title}`,
          metadata: { buyer: name, property: interest.property.title, from: current.stage, to: nextStage },
        })
      : undefined,
    statusChanged
      ? CrmLogger.logEntity({
          ...base,
          type: 'interest_status_changed',
          description: `${name}: ${interest.property.title} is now ${requestedStatus}`,
          metadata: { buyer: name, property: interest.property.title, status: requestedStatus },
        })
      : undefined,
    stageChanged
      ? onSubjectStageChanged({
          subjectType: 'Interest',
          subjectId: id,
          pipelineId: current.pipelineId,
          workspaceId: ctx.workspaceId,
          fromStage: current.stage,
          toStage: nextStage,
        })
      : undefined,
  ])

  return interest
}
