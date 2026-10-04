import { prisma } from '@/lib/prisma'
import { automationEngine } from '@/lib/automation-engine'
import { CrmLogger } from '@/lib/crm/logger'
import { onSubjectStageChanged } from '@/lib/crm/subject-events'
import {
  FINANCING_TYPES,
  INTEREST_STAGE,
  OFFER_CONDITION_TYPES,
  ON_MARKET_STATUSES,
  parseStages,
  resolveStage,
  stageForStatus,
  type OfferCondition,
} from '@/lib/crm/lifecycle'
import { notify } from '@/lib/notifications/notify'
import { ServiceError } from './errors'
import { readDate, readEnum, readId, readNumber } from './parse'
import { updateInterest } from './interests'
import { accrueCommission, cancelAccrual } from './commissions'

type Input = Record<string, unknown>

export interface OfferContext {
  workspaceId: string
  /** The person to attribute activity to. For a vendor-link decision, an agent on the listing. */
  userId: string
}

export type OfferDecisionVia = 'agent' | 'vendor_link'

export const offerInclude = {
  lead: { select: { id: true, firstName: true, lastName: true, email: true } },
  property: { select: { id: true, title: true, reference: true, status: true, price: true, currency: true, ownerId: true } },
  interest: { select: { id: true, stage: true, pipelineId: true, ownerId: true } },
} as const

function buyerName(lead: { firstName: string; lastName: string }): string {
  return `${lead.firstName} ${lead.lastName}`.trim()
}

/** Validate the conditions list: [{ type, note }], at most ten. */
function parseConditions(raw: unknown): OfferCondition[] | undefined {
  if (raw === undefined) return undefined
  if (raw === null) return []
  if (!Array.isArray(raw)) throw new ServiceError('Conditions must be a list')
  if (raw.length > 10) throw new ServiceError('An offer can have at most 10 conditions')
  return raw.map((item, i) => {
    const type = (item as any)?.type
    if (!(OFFER_CONDITION_TYPES as readonly string[]).includes(type)) {
      throw new ServiceError(`Condition ${i + 1} has an unknown type`)
    }
    const note = typeof (item as any)?.note === 'string' ? (item as any).note.trim().slice(0, 500) : ''
    return { type, note } as OfferCondition
  })
}

/**
 * Move an interest forward to a named stage, never back. A buyer who is already
 * "under contract" must not be dragged back to "offer" by recording a second
 * offer. Stage names are workspace data, so a pipeline without that stage simply
 * leaves the buyer where they are.
 */
async function advanceInterest(
  interest: { id: string; stage: string; pipelineId: string },
  stageName: string,
  ctx: OfferContext
) {
  const pipeline = await prisma.pipeline.findUnique({ where: { id: interest.pipelineId }, select: { stages: true } })
  const stages = parseStages(pipeline?.stages)
  const target = resolveStage(stages, stageName)
  if (!target) return
  if (stages.indexOf(target) <= stages.indexOf(interest.stage)) return
  await updateInterest(interest.id, ctx, { stage: target })
}

/**
 * Record an offer. The offer belongs to a buyer's interest in the property; an
 * interest can hold several (a revised bid is a new offer, and competing
 * siblings on the same property are the whole point of the model).
 */
export async function createOffer(ctx: OfferContext, input: Input) {
  const interestId = readId(input, 'interestId', 'Interest')
  if (!interestId) throw new ServiceError('Pick the buyer this offer comes from')

  const interest = await prisma.interest.findFirst({
    where: { id: interestId, workspaceId: ctx.workspaceId },
    include: { property: true, lead: true },
  })
  if (!interest) throw new ServiceError('Interest not found in this workspace')
  if (interest.status === 'lost') throw new ServiceError('This buyer is marked lost; reopen them before recording an offer')

  const propertyId = readId(input, 'propertyId', 'Property')
  if (propertyId && propertyId !== interest.propertyId) {
    throw new ServiceError('This buyer is attached to a different property')
  }

  // Offers are made on the market. A second offer on a property already under
  // offer is allowed -- it is the competition the accept flow resolves.
  if (!ON_MARKET_STATUSES.includes(interest.property.status as any)) {
    throw new ServiceError('This property is not on the market', 409)
  }

  const amount = readNumber(input, 'amount', 'Offer amount', { min: 0, required: true })!
  if (amount <= 0) throw new ServiceError('Offer amount must be more than zero')

  const expiresAt = readDate(input, 'expiresAt', 'Valid until')
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new ServiceError('The offer must be valid until a future date')
  }

  const offer = await prisma.offer.create({
    data: {
      workspaceId: ctx.workspaceId,
      propertyId: interest.propertyId,
      interestId,
      leadId: interest.leadId,
      amount,
      currency: interest.property.currency,
      expiresAt: expiresAt ?? null,
      depositAmount: readNumber(input, 'depositAmount', 'Deposit', { min: 0 }) ?? null,
      financingType: readEnum(input, 'financingType', 'Financing', FINANCING_TYPES, { nullable: true }) ?? null,
      conditions: (parseConditions(input.conditions) ?? []) as any,
      createdById: ctx.userId,
    },
    include: offerInclude,
  })

  const name = buyerName(offer.lead)
  await Promise.allSettled([
    CrmLogger.logEntity({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      type: 'offer_made',
      entityType: 'offer',
      entityId: offer.id,
      description: `${name} offered ${amount} on ${offer.property.title}`,
      metadata: { buyer: name, property: offer.property.title, amount, currency: offer.currency },
      leadId: offer.leadId,
      propertyId: offer.propertyId,
      interestId: offer.interestId,
    }),
    advanceInterest(interest, INTEREST_STAGE.offer, ctx),
    notifyAgents(offer, 'crm.offer_received', `${name} offered ${amount} on ${offer.property.title}`, ctx.userId),
  ])

  return offer
}

/** Tell the people working the deal, except the person who just did the thing. */
async function notifyAgents(
  offer: { id: string; workspaceId: string; propertyId: string; property: { ownerId: string | null }; interest: { ownerId: string | null } },
  type: 'crm.offer_received' | 'crm.offer_accepted' | 'crm.offer_rejected',
  title: string,
  actorId: string | null
) {
  const workspace = await prisma.workspace.findUnique({ where: { id: offer.workspaceId }, select: { ownerId: true } })
  const recipients = Array.from(
    new Set([offer.property.ownerId, offer.interest.ownerId, workspace?.ownerId].filter((id): id is string => !!id))
  ).filter(id => id !== actorId)
  if (recipients.length === 0) return
  void notify({
    recipients,
    type,
    workspaceId: offer.workspaceId,
    title,
    href: `/properties/${offer.propertyId}?tab=offers`,
    dedupeKey: `offer.${type}:${offer.id}`,
  })
}

export interface AcceptOfferResult {
  offer: Awaited<ReturnType<typeof loadOffer>>
  /** The competing offers this acceptance rejected, in the same transaction. */
  rejected: { id: string; interestId: string; leadId: string; amount: number }[]
}

async function loadOffer(id: string) {
  return prisma.offer.findUniqueOrThrow({ where: { id }, include: offerInclude })
}

/**
 * Accept an offer and reject every competing offer on the property, atomically.
 *
 * The Property row is the mutex. The first statement claims it with a
 * conditional update ('live' -> 'under_offer'), and only one of two concurrent
 * accepts can move it off 'live'; the other's update matches nothing, throws, and
 * rolls back, so it can never get as far as rejecting the winner. Every other
 * write is likewise a conditional update whose affected-row count is the
 * decision, which is why plain READ COMMITTED isolation suffices: there is no
 * read-then-write on contended state to race.
 *
 * Network work (notifications, automation exits) happens after the transaction,
 * never inside it: it would hold the property lock for the length of an HTTP call.
 */
export async function acceptOffer(
  offerId: string,
  ctx: OfferContext,
  via: OfferDecisionVia = 'agent'
): Promise<AcceptOfferResult> {
  const found = await prisma.offer.findFirst({
    where: { id: offerId, workspaceId: ctx.workspaceId },
    select: {
      id: true, propertyId: true, interestId: true,
      property: { select: { pipelineId: true, stage: true, pipeline: { select: { stages: true } } } },
    },
  })
  if (!found) throw new ServiceError('Offer not found', 404)

  // Where the card goes, worked out before the transaction so it stays short.
  const stages = parseStages(found.property.pipeline?.stages)
  const nextPropertyStage = stageForStatus(stages, 'under_offer', found.property.stage)
  let nextPropertyOrder: number | undefined
  if (nextPropertyStage && found.property.pipelineId) {
    const last = await prisma.property.findFirst({
      where: { pipelineId: found.property.pipelineId, stage: nextPropertyStage },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    nextPropertyOrder = (last?.order ?? -1) + 1
  }

  const now = new Date()

  const rejected = await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.findUnique({
      where: { id: offerId },
      select: { id: true, status: true, propertyId: true, interestId: true, expiresAt: true, amount: true, currency: true },
    })
    if (!offer) throw new ServiceError('Offer not found', 404)
    if (offer.status !== 'pending') throw new ServiceError('This offer has already been decided', 409)
    if (offer.expiresAt && offer.expiresAt.getTime() < now.getTime()) {
      throw new ServiceError('This offer has expired', 409)
    }

    // 1. Claim the property. This single statement is the lock.
    const claimed = await tx.property.updateMany({
      where: { id: offer.propertyId, status: 'live' },
      data: {
        status: 'under_offer',
        ...(nextPropertyStage ? { stage: nextPropertyStage, order: nextPropertyOrder } : {}),
      },
    })
    if (claimed.count === 0) throw new ServiceError('This property is no longer available', 409)

    // 2. Accept this offer, guarded on 'pending' so a double submit cannot
    //    accept it twice.
    const accepted = await tx.offer.updateMany({
      where: { id: offerId, status: 'pending' },
      data: {
        status: 'accepted',
        decidedAt: now,
        decidedVia: via,
        decidedById: via === 'agent' ? ctx.userId : null,
      },
    })
    if (accepted.count === 0) throw new ServiceError('This offer has already been decided', 409)

    // 3. Reject every competing pending offer on the property.
    const competing = await tx.offer.findMany({
      where: { propertyId: offer.propertyId, status: 'pending', id: { not: offerId } },
      select: { id: true, interestId: true, leadId: true, amount: true },
    })
    if (competing.length > 0) {
      await tx.offer.updateMany({
        where: { id: { in: competing.map(c => c.id) }, status: 'pending' },
        data: {
          status: 'rejected',
          decidedAt: now,
          decidedVia: via,
          decidedById: via === 'agent' ? ctx.userId : null,
          decisionReason: 'another_offer_accepted',
        },
      })

      // 4. Their buyers lost this property. Buyers who only viewed, and made no
      //    offer, stay active: they are the backups if this sale falls through.
      await tx.interest.updateMany({
        where: { id: { in: competing.map(c => c.interestId) }, status: 'active', NOT: { id: offer.interestId } },
        data: { status: 'lost', lostReason: 'another_offer_accepted', lastActivityAt: now },
      })
    }

    await tx.interest.update({ where: { id: offer.interestId }, data: { lastActivityAt: now } })

    // 5. The commission accrues with the sale, in the same transaction: an accepted
    //    offer without its commission, or the reverse, cannot exist.
    await accrueCommission(tx, {
      workspaceId: ctx.workspaceId,
      propertyId: offer.propertyId,
      interestId: offer.interestId,
      offerId: offer.id,
      amount: offer.amount,
      currency: offer.currency,
      userId: via === 'agent' ? ctx.userId : null,
    })

    return competing
  })

  const offer = await loadOffer(offerId)
  const winner = buyerName(offer.lead)

  // Post-transaction side effects. allSettled: a failure here must not undo,
  // or report as failed, a sale that is already recorded.
  await Promise.allSettled([
    CrmLogger.logEntity({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      type: 'offer_accepted',
      entityType: 'offer',
      entityId: offerId,
      description: `Offer of ${offer.amount} by ${winner} accepted on ${offer.property.title}`,
      metadata: { buyer: winner, property: offer.property.title, amount: offer.amount, currency: offer.currency, via },
      leadId: offer.leadId,
      propertyId: offer.propertyId,
      interestId: offer.interestId,
    }),
    advanceInterest(offer.interest, INTEREST_STAGE.underContract, ctx),
    nextPropertyStage && found.property.pipelineId
      ? onSubjectStageChanged({
          subjectType: 'Property',
          subjectId: offer.propertyId,
          pipelineId: found.property.pipelineId,
          workspaceId: ctx.workspaceId,
          fromStage: found.property.stage,
          toStage: nextPropertyStage,
        })
      : undefined,
    notifyAgents(offer, 'crm.offer_accepted', `${winner}'s offer on ${offer.property.title} was accepted`, via === 'agent' ? ctx.userId : null),
    ...rejected.flatMap(r => [
      CrmLogger.logEntity({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        type: 'offer_rejected',
        entityType: 'offer',
        entityId: r.id,
        description: `Offer of ${r.amount} rejected on ${offer.property.title}: another offer was accepted`,
        metadata: { property: offer.property.title, amount: r.amount, currency: offer.currency, reason: 'another_offer_accepted' },
        leadId: r.leadId,
        propertyId: offer.propertyId,
        interestId: r.interestId,
      }),
      // 'exited', never 'completed': an automation closed as completed keeps its
      // queued mail, so the buyer who just lost would still be sent "we're
      // considering your offer".
      automationEngine.exitEnrollments('Interest', r.interestId, 'offer_lost'),
    ]),
  ])

  return {
    offer,
    rejected: rejected.map(r => ({ id: r.id, interestId: r.interestId, leadId: r.leadId, amount: r.amount })),
  }
}

/** Reject one offer, leaving the rest of the field alone. */
export async function rejectOffer(
  offerId: string,
  ctx: OfferContext,
  options: { via?: OfferDecisionVia; reason?: string } = {}
) {
  const via = options.via ?? 'agent'
  const now = new Date()
  const result = await prisma.offer.updateMany({
    where: { id: offerId, workspaceId: ctx.workspaceId, status: 'pending' },
    data: {
      status: 'rejected',
      decidedAt: now,
      decidedVia: via,
      decidedById: via === 'agent' ? ctx.userId : null,
      decisionReason: options.reason?.trim().slice(0, 500) || 'declined',
    },
  })
  if (result.count === 0) {
    const exists = await prisma.offer.findFirst({ where: { id: offerId, workspaceId: ctx.workspaceId }, select: { id: true } })
    throw new ServiceError(exists ? 'This offer has already been decided' : 'Offer not found', exists ? 409 : 404)
  }

  const offer = await loadOffer(offerId)
  const name = buyerName(offer.lead)
  await Promise.allSettled([
    CrmLogger.logEntity({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      type: 'offer_rejected',
      entityType: 'offer',
      entityId: offerId,
      description: `Offer of ${offer.amount} by ${name} rejected on ${offer.property.title}`,
      metadata: { buyer: name, property: offer.property.title, amount: offer.amount, currency: offer.currency, via },
      leadId: offer.leadId,
      propertyId: offer.propertyId,
      interestId: offer.interestId,
    }),
    notifyAgents(offer, 'crm.offer_rejected', `${name}'s offer on ${offer.property.title} was rejected`, via === 'agent' ? ctx.userId : null),
  ])
  return offer
}

/**
 * Withdraw an offer. Withdrawing one that had been accepted collapses the sale,
 * so the property goes back on the market in the same transaction -- otherwise a
 * fallen-through deal would leave a listing nobody can make an offer on.
 */
export async function withdrawOffer(offerId: string, ctx: OfferContext) {
  const now = new Date()

  const wasAccepted = await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.findFirst({
      where: { id: offerId, workspaceId: ctx.workspaceId },
      select: { id: true, status: true, propertyId: true, property: { select: { pipelineId: true, stage: true, pipeline: { select: { stages: true } } } } },
    })
    if (!offer) throw new ServiceError('Offer not found', 404)

    const updated = await tx.offer.updateMany({
      where: { id: offerId, status: { in: ['pending', 'accepted'] } },
      data: { status: 'withdrawn', decidedAt: now, decidedVia: 'agent', decidedById: ctx.userId, decisionReason: 'withdrawn' },
    })
    if (updated.count === 0) throw new ServiceError('This offer has already been decided', 409)

    if (offer.status === 'accepted') {
      const stages = parseStages(offer.property.pipeline?.stages)
      const backTo = stageForStatus(stages, 'live', offer.property.stage)
      await tx.property.updateMany({
        where: { id: offer.propertyId, status: 'under_offer' },
        data: { status: 'live', ...(backTo ? { stage: backTo } : {}) },
      })
      // The sale collapsed, so what it would have earned is no longer expected.
      await cancelAccrual(tx, offerId)
    }
    return offer.status === 'accepted'
  })

  const offer = await loadOffer(offerId)
  const name = buyerName(offer.lead)
  await CrmLogger.logEntity({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    type: 'offer_withdrawn',
    entityType: 'offer',
    entityId: offerId,
    description: `Offer of ${offer.amount} by ${name} withdrawn on ${offer.property.title}`,
    metadata: { buyer: name, property: offer.property.title, amount: offer.amount, currency: offer.currency, wasAccepted },
    leadId: offer.leadId,
    propertyId: offer.propertyId,
    interestId: offer.interestId,
  })
  return offer
}

/** Mark pending offers whose validity has passed. Run by the offer-expiry cron. */
export async function expireDueOffers(now = new Date()): Promise<{ expired: number }> {
  const result = await prisma.offer.updateMany({
    where: { status: 'pending', expiresAt: { lt: now } },
    data: { status: 'expired', decidedAt: now, decisionReason: 'expired' },
  })
  return { expired: result.count }
}
