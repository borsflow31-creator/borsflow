import { prisma } from '@/lib/prisma'
import { CrmLogger } from '@/lib/crm/logger'
import { onSubjectCreated } from '@/lib/crm/subject-events'
import { isWorkspaceMember } from '@/lib/crm/access'
import {
  FEE_PAYERS,
  FEE_TYPES,
  MANDATE_STATUSES,
  MANDATE_TYPES,
  type MandateStatus,
} from '@/lib/crm/lifecycle'
import { leadBelongsToWorkspace } from '@/lib/api/workspace'
import { ServiceError } from './errors'
import { syncMandatePrice } from './mandate-price'
import { updateProperty } from './properties'
import { defined, has, readDate, readEnum, readId, readNumber, readString } from './parse'

type Input = Record<string, unknown>

export interface MandateContext {
  workspaceId: string
  userId: string
}

/**
 * Where a mandate may go next. A terminated or completed mandate is over; an
 * expired one can be revived by renewing it, because the commonest reason a
 * mandate lapses is that nobody rang the vendor in time.
 */
const TRANSITIONS: Record<MandateStatus, MandateStatus[]> = {
  draft: ['active', 'terminated'],
  active: ['expired', 'terminated', 'completed', 'draft'],
  expired: ['active', 'terminated'],
  terminated: [],
  completed: [],
}

export const mandateInclude = {
  property: { select: { id: true, title: true, reference: true, city: true, status: true, price: true, currency: true } },
  lead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  owner: { select: { id: true, name: true, email: true } },
} as const

async function generateReference(workspaceId: string): Promise<string> {
  let n = (await prisma.mandate.count({ where: { workspaceId } })) + 1
  for (let attempts = 0; attempts < 100; attempts++, n++) {
    const candidate = `MND-${String(n).padStart(4, '0')}`
    const taken = await prisma.mandate.findUnique({
      where: { workspaceId_reference: { workspaceId, reference: candidate } },
      select: { id: true },
    })
    if (!taken) return candidate
  }
  return `MND-${Date.now().toString(36).toUpperCase()}`
}

function parseFields(input: Input) {
  const data = defined({
    mandateType: readEnum(input, 'mandateType', 'Mandate type', MANDATE_TYPES),
    feeType: readEnum(input, 'feeType', 'Fee type', FEE_TYPES),
    feePayer: readEnum(input, 'feePayer', 'Fee payer', FEE_PAYERS),
    startDate: readDate(input, 'startDate', 'Start date'),
    endDate: readDate(input, 'endDate', 'End date'),
    signedAt: readDate(input, 'signedAt', 'Signed date'),
    renewalTerms: readString(input, 'renewalTerms', 'Renewal terms', { max: 1000 }),
    notes: readString(input, 'notes', 'Notes', { max: 5000 }),
    askingPrice: readNumber(input, 'askingPrice', 'Asking price', { min: 0 }),
    netToVendor: readNumber(input, 'netToVendor', 'Net to vendor', { min: 0 }),
    commissionPercent: readNumber(input, 'commissionPercent', 'Commission', { min: 0 }),
    feeFixed: readNumber(input, 'feeFixed', 'Fixed fee', { min: 0 }),
    reportEveryDays: readNumber(input, 'reportEveryDays', 'Report interval', { min: 1, integer: true }),
  }) as Record<string, any>

  if (typeof data.reportEveryDays === 'number' && data.reportEveryDays > 90) {
    throw new ServiceError('A vendor report can be sent at most every 90 days')
  }
  if (typeof data.commissionPercent === 'number' && data.commissionPercent > 100) {
    throw new ServiceError('Commission cannot be more than 100%')
  }
  if (data.askingPrice === null) data.askingPrice = 0
  return data
}

function checkDates(start: Date | null | undefined, end: Date | null | undefined) {
  if (start && end && end.getTime() <= start.getTime()) {
    throw new ServiceError('The end date must be after the start date')
  }
}

/** The one active mandate a property may have at a time. */
async function assertNoOtherActive(propertyId: string, exceptId?: string) {
  const other = await prisma.mandate.findFirst({
    where: { propertyId, status: 'active', ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true, reference: true },
  })
  if (other) throw new ServiceError(`This property already has an active mandate (${other.reference})`, 409)
}

/**
 * Side effects of a mandate becoming the property's authority to sell: a
 * prospect or valued property is now "mandate", and a vendor on the mandate is
 * the property's vendor if it had none.
 */
async function onActivated(mandate: { propertyId: string; leadId: string }, ctx: MandateContext) {
  const property = await prisma.property.findUnique({
    where: { id: mandate.propertyId },
    select: { status: true, vendorId: true },
  })
  if (!property) return
  const patch: Record<string, unknown> = {}
  if (property.status === 'prospect' || property.status === 'valuation') patch.status = 'mandate'
  if (!property.vendorId) patch.vendorId = mandate.leadId
  if (Object.keys(patch).length) await updateProperty(mandate.propertyId, ctx, patch)
}

/**
 * Side effects of a mandate ending: with no authority to sell, the listing comes
 * off the market. Only a property that is still waiting to sell is touched -- one
 * that is under offer or sold is mid-deal and keeps its status.
 */
async function onEnded(
  mandate: { propertyId: string },
  to: 'expired' | 'withdrawn',
  ctx: MandateContext
) {
  const property = await prisma.property.findUnique({
    where: { id: mandate.propertyId },
    select: { status: true },
  })
  if (!property || !['live', 'mandate'].includes(property.status)) return
  // Another active mandate on the same property keeps it on the market.
  const other = await prisma.mandate.count({ where: { propertyId: mandate.propertyId, status: 'active' } })
  if (other > 0) return
  await updateProperty(mandate.propertyId, ctx, { status: to })
}

async function logMandate(
  ctx: MandateContext,
  mandate: { id: string; reference: string; propertyId: string; leadId: string; property?: { title: string } | null },
  type: 'mandate_created' | 'mandate_status_changed' | 'mandate_renewed',
  description: string,
  metadata: Record<string, unknown>
) {
  await CrmLogger.logEntity({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    type,
    entityType: 'mandate',
    entityId: mandate.id,
    description,
    metadata: { reference: mandate.reference, property: mandate.property?.title, ...metadata },
    propertyId: mandate.propertyId,
    leadId: mandate.leadId,
  })
}

export async function createMandate(ctx: MandateContext, input: Input) {
  const propertyId = readId(input, 'propertyId', 'Property')
  if (!propertyId) throw new ServiceError('Property is required')

  const property = await prisma.property.findFirst({
    where: { id: propertyId, workspaceId: ctx.workspaceId },
    select: { id: true, title: true, price: true, vendorId: true, ownerId: true },
  })
  if (!property) throw new ServiceError('Property not found in this workspace')

  const leadId = readId(input, 'leadId', 'Vendor') ?? property.vendorId
  if (!leadId) throw new ServiceError('Vendor is required')
  if (!(await leadBelongsToWorkspace(leadId, ctx.workspaceId))) {
    throw new ServiceError('Vendor not found in this workspace')
  }

  const ownerId = readId(input, 'ownerId', 'Listing agent')
  if (ownerId && !(await isWorkspaceMember(ctx.workspaceId, ownerId))) {
    throw new ServiceError('The listing agent must be a member of this workspace')
  }

  const fields = parseFields(input)
  checkDates(fields.startDate, fields.endDate)

  const status = (readEnum(input, 'status', 'Status', MANDATE_STATUSES) as MandateStatus | undefined) ?? 'draft'
  if (status !== 'draft' && status !== 'active') {
    throw new ServiceError('A new mandate starts as a draft or active')
  }
  if (status === 'active') await assertNoOtherActive(propertyId)

  const reference = readString(input, 'reference', 'Reference', { max: 40 }) ?? (await generateReference(ctx.workspaceId))

  let mandate
  try {
    mandate = await prisma.mandate.create({
      data: {
        ...fields,
        reference,
        workspaceId: ctx.workspaceId,
        propertyId,
        leadId,
        status,
        askingPrice: fields.askingPrice ?? property.price,
        // An exclusive mandate is an exchange: the vendor owes sole authority, the
        // agency owes regular proof it is working. A weekly report is the default.
        reportEveryDays: fields.reportEveryDays !== undefined ? fields.reportEveryDays : (fields.mandateType === 'exclusive' ? 7 : null),
        // An active mandate starts today unless it says otherwise.
        startDate: fields.startDate ?? (status === 'active' ? new Date() : null),
        ownerId: ownerId ?? property.ownerId ?? ctx.userId,
        createdById: ctx.userId,
      },
      include: mandateInclude,
    })
  } catch (error: any) {
    if (error?.code === 'P2002') throw new ServiceError('A mandate with this reference already exists', 409)
    throw error
  }

  await logMandate(ctx, mandate, 'mandate_created', `Mandate ${mandate.reference} created for ${mandate.property.title}`, { status })
  await onSubjectCreated({ subjectType: 'Mandate', subjectId: mandate.id, pipelineId: null, workspaceId: ctx.workspaceId })
  if (status === 'active') await onActivated(mandate, ctx)

  return mandate
}

export async function updateMandate(id: string, ctx: MandateContext, input: Input) {
  const current = await prisma.mandate.findUnique({ where: { id }, include: mandateInclude })
  if (!current || current.workspaceId !== ctx.workspaceId) throw new ServiceError('Mandate not found', 404)

  const fields = parseFields(input)
  checkDates(
    (fields.startDate as Date | null | undefined) ?? current.startDate,
    (fields.endDate as Date | null | undefined) ?? current.endDate
  )

  const leadId = readId(input, 'leadId', 'Vendor')
  if (leadId && !(await leadBelongsToWorkspace(leadId, ctx.workspaceId))) {
    throw new ServiceError('Vendor not found in this workspace')
  }
  const ownerId = readId(input, 'ownerId', 'Listing agent')
  if (ownerId && !(await isWorkspaceMember(ctx.workspaceId, ownerId))) {
    throw new ServiceError('The listing agent must be a member of this workspace')
  }

  const data: Record<string, any> = { ...fields }
  if (leadId) data.leadId = leadId
  if (ownerId !== undefined) data.ownerId = ownerId
  if (has(input, 'reference')) {
    data.reference = readString(input, 'reference', 'Reference', { max: 40, required: true })
  }

  // The asking price is changed through changeAskingPrice so its history is kept.
  if (data.askingPrice !== undefined && data.askingPrice !== current.askingPrice) {
    throw new ServiceError('Use the price change action to change the asking price, so the history is kept')
  }
  delete data.askingPrice

  const nextStatus = readEnum(input, 'status', 'Status', MANDATE_STATUSES) as MandateStatus | undefined
  const statusChanged = !!nextStatus && nextStatus !== current.status
  if (statusChanged) {
    if (!TRANSITIONS[current.status as MandateStatus].includes(nextStatus!)) {
      throw new ServiceError(`A ${current.status} mandate cannot become ${nextStatus}`)
    }
    if (nextStatus === 'active') await assertNoOtherActive(current.propertyId, id)
    data.status = nextStatus
    if (nextStatus === 'active') {
      data.startDate = data.startDate ?? current.startDate ?? new Date()
      const type = (data.mandateType as string | undefined) ?? current.mandateType
      if (type === 'exclusive' && data.reportEveryDays === undefined && current.reportEveryDays == null) data.reportEveryDays = 7
      data.terminatedAt = null
      data.terminationReason = null
    }
    if (nextStatus === 'terminated') {
      data.terminatedAt = new Date()
      data.terminationReason = readString(input, 'terminationReason', 'Reason', { max: 500 }) ?? null
    }
  }

  let mandate
  try {
    mandate = await prisma.mandate.update({ where: { id }, data, include: mandateInclude })
  } catch (error: any) {
    if (error?.code === 'P2002') throw new ServiceError('A mandate with this reference already exists', 409)
    throw error
  }

  if (statusChanged) {
    await logMandate(
      ctx,
      mandate,
      'mandate_status_changed',
      `Mandate ${mandate.reference} is now ${nextStatus}`,
      { from: current.status, to: nextStatus, status: nextStatus }
    )
    if (nextStatus === 'active') await onActivated(mandate, ctx)
    if (nextStatus === 'expired') await onEnded(mandate, 'expired', ctx)
    if (nextStatus === 'terminated') await onEnded(mandate, 'withdrawn', ctx)
  }

  return mandate
}

/**
 * Renew a mandate: a new end date, and active again. This is the action the
 * renewal queue exists for, so it also revives an expired mandate.
 */
export async function renewMandate(id: string, ctx: MandateContext, input: Input) {
  const endDate = readDate(input, 'endDate', 'New end date', { required: true })!
  const current = await prisma.mandate.findUnique({ where: { id }, include: mandateInclude })
  if (!current || current.workspaceId !== ctx.workspaceId) throw new ServiceError('Mandate not found', 404)
  if (!['active', 'expired'].includes(current.status)) {
    throw new ServiceError(`A ${current.status} mandate cannot be renewed`)
  }
  if (current.endDate && endDate.getTime() <= current.endDate.getTime() && current.status === 'active') {
    throw new ServiceError('The new end date must be after the current one')
  }
  if (endDate.getTime() <= Date.now()) throw new ServiceError('The new end date must be in the future')

  if (current.status === 'expired') await assertNoOtherActive(current.propertyId, id)

  const renewalTerms = readString(input, 'renewalTerms', 'Renewal terms', { max: 1000 })
  const mandate = await prisma.mandate.update({
    where: { id },
    data: {
      endDate,
      status: 'active',
      ...(renewalTerms !== undefined ? { renewalTerms } : {}),
    },
    include: mandateInclude,
  })

  await logMandate(
    ctx,
    mandate,
    'mandate_renewed',
    `Mandate ${mandate.reference} renewed until ${endDate.toISOString().slice(0, 10)}`,
    { date: endDate.toISOString().slice(0, 10) }
  )
  if (current.status === 'expired') await onActivated(mandate, ctx)

  return mandate
}

/**
 * Change the asking price. Updates the mandate, appends to its price history and
 * moves the property's price to match, in one transaction.
 */
export async function changeAskingPrice(id: string, ctx: MandateContext, input: Input) {
  const newPrice = readNumber(input, 'price', 'New price', { min: 0, required: true })!
  const reason = readString(input, 'reason', 'Reason', { max: 500 })

  const mandate = await prisma.mandate.findUnique({ where: { id }, include: mandateInclude })
  if (!mandate || mandate.workspaceId !== ctx.workspaceId) throw new ServiceError('Mandate not found', 404)
  if (mandate.status !== 'active') throw new ServiceError('Only an active mandate has a price to change')
  if (newPrice === mandate.askingPrice) throw new ServiceError('That is already the asking price')

  const from = mandate.askingPrice
  await prisma.$transaction(async (tx) => {
    await syncMandatePrice(tx, {
      propertyId: mandate.propertyId,
      workspaceId: ctx.workspaceId,
      from,
      to: newPrice,
      userId: ctx.userId,
      reason,
    })
    await tx.property.update({ where: { id: mandate.propertyId }, data: { price: newPrice } })
  })

  await CrmLogger.logEntity({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    type: 'price_changed',
    entityType: 'mandate',
    entityId: id,
    description: `Price of ${mandate.property.title} changed from ${from} to ${newPrice}`,
    metadata: { property: mandate.property.title, from, to: newPrice, currency: mandate.property.currency },
    propertyId: mandate.propertyId,
    leadId: mandate.leadId,
  })

  return prisma.mandate.findUniqueOrThrow({ where: { id }, include: { ...mandateInclude, priceChanges: { orderBy: { changedAt: 'desc' } } } })
}

/**
 * Mark every active mandate whose end date has passed as expired and de-list its
 * property. Run by the expiry cron, with no user in the loop, so the actor is the
 * mandate's agent (or the workspace owner when it has none).
 */
export async function expireDueMandates(now = new Date()): Promise<{ expired: number }> {
  const due = await prisma.mandate.findMany({
    where: { status: 'active', endDate: { lt: now } },
    select: { id: true, workspaceId: true, ownerId: true, workspace: { select: { ownerId: true } } },
  })

  let expired = 0
  for (const row of due) {
    const ctx = { workspaceId: row.workspaceId, userId: row.ownerId ?? row.workspace.ownerId }
    try {
      await updateMandate(row.id, ctx, { status: 'expired' })
      expired++
    } catch (error) {
      console.error(`[mandates] could not expire ${row.id}:`, error)
    }
  }
  return { expired }
}
