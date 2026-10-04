import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CrmLogger } from '@/lib/crm/logger'
import { reorderInColumn } from '@/lib/crm/reorder'
import { onSubjectCreated, onSubjectStageChanged } from '@/lib/crm/subject-events'
import { isWorkspaceMember } from '@/lib/crm/access'
import {
  ENERGY_RATINGS,
  ON_MARKET_STATUSES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  TRANSACTION_TYPES,
  parseStages,
  resolveStage,
  stageForStatus,
  statusForStage,
  type PropertyStatus,
} from '@/lib/crm/lifecycle'
import { onPropertyListed } from '@/lib/crm/matching'
import { sanitizeCustomFields } from '@/lib/product-custom-fields'
import { loadCustomFieldDefs } from '@/lib/products-server'
import { leadBelongsToWorkspace } from '@/lib/api/workspace'
import { ServiceError } from './errors'
import { resolveBoard } from './pipelines'
import { syncMandatePrice } from './mandate-price'
import { realizeCommissionForProperty } from './commissions'
import { defined, has, readBoolean, readEnum, readId, readNumber, readString } from './parse'

type Input = Record<string, unknown>

export interface PropertyContext {
  workspaceId: string
  userId: string
}

/** Everything a caller needs to render a property: the row plus its vendor. */
const propertyInclude = {
  vendor: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  owner: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PropertyInclude

/** Optional numeric columns and the bounds each must respect. */
const NUMBER_COLUMNS: { key: string; label: string; min?: number; integer?: boolean }[] = [
  { key: 'surfaceArea', label: 'Surface', min: 0 },
  { key: 'landArea', label: 'Land area', min: 0 },
  { key: 'rooms', label: 'Rooms', min: 0, integer: true },
  { key: 'bedrooms', label: 'Bedrooms', min: 0, integer: true },
  { key: 'bathrooms', label: 'Bathrooms', min: 0, integer: true },
  { key: 'floor', label: 'Floor', integer: true },
  { key: 'buildYear', label: 'Year built', min: 1000, integer: true },
  { key: 'soldPrice', label: 'Sold price', min: 0 },
]

const BOOLEAN_COLUMNS = [
  ['isAddressPublic', 'Address visibility'],
  ['hasElevator', 'Elevator'],
  ['hasParking', 'Parking'],
  ['hasBalcony', 'Balcony'],
  ['hasTerrace', 'Terrace'],
  ['hasGarden', 'Garden'],
  ['hasPool', 'Pool'],
  ['furnished', 'Furnished'],
  ['isPublished', 'Published'],
] as const

const TEXT_COLUMNS: { key: string; label: string; max: number }[] = [
  { key: 'description', label: 'Description', max: 10_000 },
  { key: 'addressLine', label: 'Street address', max: 200 },
  { key: 'district', label: 'District', max: 100 },
  { key: 'postalCode', label: 'Postal code', max: 20 },
]

/**
 * Validate and shape the columns a property body can set. `create` makes title
 * and city mandatory; `update` only touches what was sent.
 */
function parseFields(input: Input, mode: 'create' | 'update') {
  const required = mode === 'create'
  const data: Record<string, unknown> = {
    title: readString(input, 'title', 'Title', { max: 200, required }),
    city: readString(input, 'city', 'City', { max: 100, required }),
    propertyType: readEnum(input, 'propertyType', 'Property type', PROPERTY_TYPES),
    transactionType: readEnum(input, 'transactionType', 'Transaction type', TRANSACTION_TYPES),
    energyRating: readEnum(input, 'energyRating', 'Energy rating', ENERGY_RATINGS, { nullable: true }),
    price: readNumber(input, 'price', 'Price', { min: 0 }),
    latitude: readNumber(input, 'latitude', 'Latitude'),
    longitude: readNumber(input, 'longitude', 'Longitude'),
  }

  for (const col of NUMBER_COLUMNS) {
    data[col.key] = readNumber(input, col.key, col.label, { min: col.min, integer: col.integer })
  }
  for (const col of TEXT_COLUMNS) {
    data[col.key] = readString(input, col.key, col.label, { max: col.max })
  }
  for (const [key, label] of BOOLEAN_COLUMNS) {
    data[key] = readBoolean(input, key, label)
  }

  const currency = readString(input, 'currency', 'Currency', { max: 3 })
  data.currency = currency ? currency.toUpperCase() : currency

  const country = readString(input, 'countryCode', 'Country code', { max: 2 })
  data.countryCode = country ? country.toUpperCase() : country

  // A price of null is "unset", but the column is NOT NULL with a default of 0.
  if (data.price === null) data.price = 0

  if (typeof data.latitude === 'number' && Math.abs(data.latitude) > 90) {
    throw new ServiceError('Latitude must be between -90 and 90')
  }
  if (typeof data.longitude === 'number' && Math.abs(data.longitude) > 180) {
    throw new ServiceError('Longitude must be between -180 and 180')
  }
  if (typeof data.buildYear === 'number' && data.buildYear > new Date().getFullYear() + 10) {
    throw new ServiceError('Year built is too far in the future')
  }

  return defined(data)
}

/** A vendor must be a contact in this workspace; an owner must be one of its agents. */
async function checkPeople(workspaceId: string, vendorId: string | null | undefined, ownerId: string | null | undefined) {
  if (vendorId && !(await leadBelongsToWorkspace(vendorId, workspaceId))) {
    throw new ServiceError('Vendor not found in this workspace')
  }
  if (ownerId && !(await isWorkspaceMember(workspaceId, ownerId))) {
    throw new ServiceError('The listing agent must be a member of this workspace')
  }
}

/**
 * The next free reference, "PRP-0001" style. Counting is a starting point only:
 * references are also typed by hand and properties get deleted, so each candidate
 * is checked, and the unique index on (workspaceId, reference) remains the real
 * guard (the caller retries on a collision).
 */
async function generateReference(workspaceId: string, prefix = 'PRP'): Promise<string> {
  let n = (await prisma.property.count({ where: { workspaceId } })) + 1
  for (let attempts = 0; attempts < 100; attempts++, n++) {
    const candidate = `${prefix}-${String(n).padStart(4, '0')}`
    const taken = await prisma.property.findUnique({
      where: { workspaceId_reference: { workspaceId, reference: candidate } },
      select: { id: true },
    })
    if (!taken) return candidate
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`
}

function isReferenceConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    String((error.meta as any)?.target ?? '').includes('reference')
  )
}

/** Next `order` value at the end of a board column. */
async function endOfColumn(pipelineId: string, stage: string): Promise<number> {
  const last = await prisma.property.findFirst({
    where: { pipelineId, stage },
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  return (last?.order ?? -1) + 1
}

/** What the vendor's name is, for activity text. */
export function propertyLabel(p: { title: string; reference: string }): string {
  return p.title || p.reference
}

/**
 * Create a property and put it on the owner board.
 *
 * Status (lifecycle) and stage (board column) describe one thing at two
 * resolutions, so they are kept in step for the seeded stage names: an explicit
 * status wins and picks its column, otherwise the column picks the status, and a
 * property with neither starts as a prospect in the first column.
 */
export async function createProperty(ctx: PropertyContext, input: Input) {
  const fields = parseFields(input, 'create')
  const vendorId = readId(input, 'vendorId', 'Vendor')
  const ownerId = readId(input, 'ownerId', 'Listing agent')
  await checkPeople(ctx.workspaceId, vendorId, ownerId)

  const board = await resolveBoard(ctx.workspaceId, 'Property', readId(input, 'pipelineId', 'Board'))

  const requestedStage = readString(input, 'stage', 'Stage')
  let stage: string | null = null
  if (requestedStage) {
    stage = resolveStage(board.stages, requestedStage)
    if (!stage) throw new ServiceError(`"${requestedStage}" is not a stage on this board`)
  }

  const explicitStatus = readEnum(input, 'status', 'Status', PROPERTY_STATUSES) as PropertyStatus | null | undefined
  const status: PropertyStatus = explicitStatus ?? (stage ? statusForStage(stage) : null) ?? 'prospect'
  if (!stage) stage = stageForStatus(board.stages, status, '') ?? board.stages[0] ?? 'Prospect'

  const customDefs = await loadCustomFieldDefs(ctx.workspaceId, 'property')
  const custom = sanitizeCustomFields(customDefs, input.customFields)
  if (!custom.ok) throw new ServiceError(custom.message)

  const order = await endOfColumn(board.id, stage)
  const now = new Date()
  const givenReference = readString(input, 'reference', 'Reference', { max: 40 })

  let created
  for (let attempt = 0; ; attempt++) {
    const reference = givenReference ?? (await generateReference(ctx.workspaceId))
    try {
      created = await prisma.property.create({
        data: {
          ...(fields as Prisma.PropertyUncheckedCreateInput),
          title: fields.title as string,
          city: fields.city as string,
          propertyType: (fields.propertyType as string | undefined) ?? 'apartment',
          reference,
          workspaceId: ctx.workspaceId,
          status,
          pipelineId: board.id,
          stage,
          order,
          vendorId: vendorId ?? null,
          ownerId: ownerId ?? ctx.userId,
          createdById: ctx.userId,
          customFields: custom.values,
          listedAt: ON_MARKET_STATUSES.includes(status) ? now : null,
          publishedAt: fields.isPublished ? now : null,
        },
        include: propertyInclude,
      })
      break
    } catch (error) {
      // A hand-typed reference is the user's mistake to fix; a generated one is
      // ours, and a second writer may have taken it between check and insert.
      if (isReferenceConflict(error)) {
        if (givenReference) throw new ServiceError('A property with this reference already exists', 409)
        if (attempt < 3) continue
      }
      throw error
    }
  }

  await CrmLogger.logEntity({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    type: 'property_created',
    entityType: 'property',
    entityId: created.id,
    description: `${propertyLabel(created)} was added`,
    metadata: { title: created.title, reference: created.reference, status },
    propertyId: created.id,
    leadId: created.vendorId ?? undefined,
  })

  await onSubjectCreated({ subjectType: 'Property', subjectId: created.id, pipelineId: board.id, workspaceId: ctx.workspaceId })

  // A property created already live is a new listing: find the buyers it suits.
  if (status === 'live') await onPropertyListed(created.id, 'new')

  return created
}

export interface PropertyUpdateResult {
  property: Awaited<ReturnType<typeof loadProperty>>
  stageChange: { from: string; to: string } | null
  statusChange: { from: string; to: string } | null
  priceChange: { from: number; to: number } | null
}

async function loadProperty(id: string) {
  return prisma.property.findUniqueOrThrow({ where: { id }, include: propertyInclude })
}

/**
 * Update a property. Handles the board too: a drag sends { stage, order }, a form
 * sends fields, and either may change the lifecycle status, which in turn moves
 * the card (see statusForStage / stageForStatus). Every path that changes stage
 * fires the same exit-then-dispatch automation hook as the lead board.
 */
export async function updateProperty(id: string, ctx: PropertyContext, input: Input): Promise<PropertyUpdateResult> {
  const current = await prisma.property.findUnique({
    where: { id },
    include: { pipeline: { select: { id: true, stages: true } } },
  })
  if (!current || current.workspaceId !== ctx.workspaceId) throw new ServiceError('Property not found', 404)

  const fields = parseFields(input, 'update') as Record<string, any>
  const vendorId = readId(input, 'vendorId', 'Vendor')
  const ownerId = readId(input, 'ownerId', 'Listing agent')
  await checkPeople(ctx.workspaceId, vendorId, ownerId)

  const stages = parseStages(current.pipeline?.stages)
  const data: Record<string, any> = { ...fields }
  if (vendorId !== undefined) data.vendorId = vendorId
  if (ownerId !== undefined) data.ownerId = ownerId

  if (has(input, 'reference')) {
    const reference = readString(input, 'reference', 'Reference', { max: 40, required: true })
    if (reference !== current.reference) data.reference = reference
  }

  if (has(input, 'customFields')) {
    const defs = await loadCustomFieldDefs(ctx.workspaceId, 'property')
    const custom = sanitizeCustomFields(defs, input.customFields)
    if (!custom.ok) throw new ServiceError(custom.message)
    data.customFields = custom.values
  }

  // ── Status and stage, kept in step ────────────────────────────────────────
  const requestedStatus = readEnum(input, 'status', 'Status', PROPERTY_STATUSES) as PropertyStatus | null | undefined
  const requestedStageRaw = readString(input, 'stage', 'Stage')
  let nextStage = current.stage
  let nextStatus = current.status as PropertyStatus

  if (requestedStageRaw && requestedStageRaw !== current.stage) {
    const resolved = stages.length ? resolveStage(stages, requestedStageRaw) : requestedStageRaw
    if (!resolved) throw new ServiceError(`"${requestedStageRaw}" is not a stage on this board`)
    nextStage = resolved
    if (!requestedStatus) {
      const implied = statusForStage(resolved)
      if (implied) nextStatus = implied
    }
  }
  if (requestedStatus && requestedStatus !== current.status) {
    nextStatus = requestedStatus
    if (!requestedStageRaw) {
      const target = stageForStatus(stages, requestedStatus, current.stage)
      if (target) nextStage = target
    }
  }

  const statusChanged = nextStatus !== current.status
  const stageChanged = nextStage !== current.stage
  const now = new Date()

  if (statusChanged) {
    data.status = nextStatus
    if (ON_MARKET_STATUSES.includes(nextStatus) && !current.listedAt) data.listedAt = now
    if (nextStatus === 'sold') {
      data.soldAt = current.soldAt ?? now
      if (data.soldPrice === undefined && current.soldPrice == null) data.soldPrice = data.price ?? current.price
    }
  }
  if (data.isPublished === true && !current.publishedAt) data.publishedAt = now

  const newPrice = typeof data.price === 'number' ? data.price : undefined
  const priceChanged = newPrice !== undefined && newPrice !== current.price

  const orderRequested = typeof input.order === 'number' ? input.order : undefined

  // ── Write ────────────────────────────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    if (stageChanged) data.stage = nextStage
    // Moving to a new column without a drop position appends to it.
    if (stageChanged && orderRequested === undefined && current.pipelineId) {
      const last = await tx.property.findFirst({
        where: { pipelineId: current.pipelineId, stage: nextStage, id: { not: id } },
        orderBy: { order: 'desc' },
        select: { order: true },
      })
      data.order = (last?.order ?? -1) + 1
    }

    await tx.property.update({ where: { id }, data })

    if (orderRequested !== undefined && current.pipelineId) {
      await reorderInColumn(tx, 'Property', {
        id,
        pipelineId: current.pipelineId,
        stage: nextStage,
        order: orderRequested,
      })
    }

    if (priceChanged) {
      await syncMandatePrice(tx, {
        propertyId: id,
        workspaceId: ctx.workspaceId,
        from: current.price,
        to: newPrice!,
        userId: ctx.userId,
      })
    }
  })

  const property = await loadProperty(id)
  const label = propertyLabel(property)
  const base = {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    entityType: 'property' as const,
    entityId: id,
    propertyId: id,
    leadId: property.vendorId ?? undefined,
  }

  // Awaited rather than floated: on serverless the function may be frozen once
  // the response returns, and allSettled keeps a failed hook from failing the
  // update and bouncing the card back.
  await Promise.allSettled([
    stageChanged
      ? CrmLogger.logEntity({
          ...base,
          type: 'property_stage_changed',
          description: `${label} moved from "${current.stage}" to "${nextStage}"`,
          metadata: { title: label, from: current.stage, to: nextStage },
        })
      : undefined,
    statusChanged
      ? CrmLogger.logEntity({
          ...base,
          type: 'property_status_changed',
          description: `${label} moved from ${current.status} to ${nextStatus}`,
          metadata: { title: label, from: current.status, to: nextStatus },
        })
      : undefined,
    priceChanged
      ? CrmLogger.logEntity({
          ...base,
          type: 'price_changed',
          description: `Price of ${label} changed from ${current.price} to ${newPrice}`,
          metadata: { property: label, from: current.price, to: newPrice, currency: property.currency },
        })
      : undefined,
    // The sale closed: what was accrued is now earned.
    statusChanged && nextStatus === 'sold' ? realizeCommissionForProperty(id, now) : undefined,

    // A listing that just went live is news to every buyer whose brief it fits; a
    // price drop of 1% or more on one that is live is news to the ones who passed.
    statusChanged && nextStatus === 'live' && current.status !== 'live'
      ? onPropertyListed(id, 'new')
      : priceChanged && nextStatus === 'live' && newPrice! < current.price * 0.99
        ? onPropertyListed(id, 'price_drop')
        : undefined,
    stageChanged && current.pipelineId
      ? onSubjectStageChanged({
          subjectType: 'Property',
          subjectId: id,
          pipelineId: current.pipelineId,
          workspaceId: ctx.workspaceId,
          fromStage: current.stage,
          toStage: nextStage,
        })
      : undefined,
  ])

  return {
    property,
    stageChange: stageChanged ? { from: current.stage, to: nextStage } : null,
    statusChange: statusChanged ? { from: current.status, to: nextStatus } : null,
    priceChange: priceChanged ? { from: current.price, to: newPrice! } : null,
  }
}

export { propertyInclude }
