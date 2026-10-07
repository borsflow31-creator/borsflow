import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { ServiceError } from '../errors'
import { readString, readNumber } from '../parse'
import { syncProgramCounters } from './programs'
import { advanceBuyerLead } from './buyer-stage'
import { createTask } from './tasks'
import { fireLotEvent } from './alerts'
import { accrueLotCommission, cancelLotCommission, realizeLotCommission } from '../commissions'
import { DEVELOPER_STAGE_RESERVED, DEVELOPER_STAGE_WON } from '@/lib/crm/lifecycle'

export function generatePortalToken(): string {
  return randomBytes(20).toString('hex')
}

export async function ensureLotPublicToken(lotId: string): Promise<string> {
  const lot = await prisma.developmentLot.findUnique({
    where: { id: lotId },
    select: { id: true, publicToken: true },
  })
  if (!lot) throw new ServiceError('Lot not found', 404)
  if (lot.publicToken) return lot.publicToken

  const token = generatePortalToken()
  await prisma.developmentLot.update({
    where: { id: lotId },
    data: { publicToken: token, publicTokenCreatedAt: new Date() },
  })
  return token
}

export interface DeveloperContext {
  workspaceId: string
  userId: string
}

export const LOT_TYPES = ['apartment', 'house', 'parking', 'box', 'cellar', 'commercial'] as const
export const LOT_STATUSES = [
  'available',
  'optioned',
  'reserved',
  'contract_signed',
  'deed_signed',
  'delivered',
] as const

export interface CreateLotInput {
  programId: string
  buildingId?: string
  lotNumber: string
  type?: string
  typology?: string
  floor?: number
  orientation?: string
  bedrooms?: number
  surfaceArea?: number
  terraceArea?: number
  balconyArea?: number
  gardenArea?: number
  basePrice: number
  discount?: number
  taxRate?: number
  salesAgentId?: string
  parentLotId?: string
  customFields?: Record<string, any>
}

export interface UpdateLotInput {
  buildingId?: string | null
  lotNumber?: string
  type?: string
  typology?: string | null
  floor?: number
  orientation?: string | null
  bedrooms?: number | null
  surfaceArea?: number
  terraceArea?: number
  balconyArea?: number
  gardenArea?: number
  basePrice?: number
  discount?: number
  taxRate?: number
  salesAgentId?: string | null
  reservationFee?: number | null
  reservationFeePaidAt?: string | Date | null
  status?: string
  parentLotId?: string | null
  customFields?: Record<string, any>
}

export async function listLotsForProgram(
  ctx: DeveloperContext,
  programId: string,
  options: { buildingId?: string; status?: string; type?: string } = {}
) {
  const program = await prisma.program.findFirst({
    where: { id: programId, workspaceId: ctx.workspaceId },
  })
  if (!program) {
    throw new ServiceError('Program not found', 404)
  }

  const where: any = { programId, workspaceId: ctx.workspaceId }
  if (options.buildingId) where.buildingId = options.buildingId
  if (options.status) where.status = options.status
  if (options.type) where.type = options.type

  return prisma.developmentLot.findMany({
    where,
    include: {
      building: { select: { id: true, name: true } },
      salesAgent: { select: { id: true, name: true, email: true } },
      buyerLead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      optionHolderLead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      childLots: { select: { id: true, lotNumber: true, type: true, totalPrice: true } },
      parentLot: { select: { id: true, lotNumber: true, type: true } },
    },
    orderBy: [{ floor: 'desc' }, { lotNumber: 'asc' }],
  })
}

export interface InventoryFilters {
  programId?: string
  buildingId?: string
  status?: string
  type?: string
  agentId?: string
  minPrice?: number
  maxPrice?: number
}

/**
 * Every unit in the workspace, for the inventory page. Carries what a row shows:
 * the project and building, the buyer and agent, and a payment summary computed
 * from the unit's calls for funds so the page does not fetch them per row.
 */
export async function listInventory(ctx: DeveloperContext, filters: InventoryFilters = {}) {
  const where: any = { workspaceId: ctx.workspaceId }
  if (filters.programId) where.programId = filters.programId
  if (filters.buildingId) where.buildingId = filters.buildingId
  if (filters.status) where.status = filters.status
  if (filters.type) where.type = filters.type
  if (filters.agentId) where.salesAgentId = filters.agentId
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.totalPrice = {
      ...(filters.minPrice !== undefined && { gte: filters.minPrice }),
      ...(filters.maxPrice !== undefined && { lte: filters.maxPrice }),
    }
  }

  const lots = await prisma.developmentLot.findMany({
    where,
    include: {
      program: { select: { id: true, name: true, reference: true } },
      building: { select: { id: true, name: true } },
      salesAgent: { select: { id: true, name: true, email: true } },
      buyerLead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      optionHolderLead: { select: { id: true, firstName: true, lastName: true } },
      callsForFunds: { select: { amount: true, status: true, dueAt: true } },
    },
    orderBy: [{ program: { name: 'asc' } }, { floor: 'desc' }, { lotNumber: 'asc' }],
  })

  const now = Date.now()
  return lots.map(({ callsForFunds, ...lot }) => {
    const called = callsForFunds.filter((c) => c.status !== 'draft')
    const paid = called.filter((c) => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0)
    const calledTotal = called.reduce((sum, c) => sum + c.amount, 0)
    const overdue = called.some(
      (c) => c.status === 'overdue' || (c.status !== 'paid' && c.dueAt && c.dueAt.getTime() < now)
    )
    return {
      ...lot,
      payment: {
        called: calledTotal,
        paid,
        state: called.length === 0 ? 'none' : overdue ? 'overdue' : paid >= calledTotal ? 'paid' : 'partial',
      },
    }
  })
}

export async function getLot(ctx: DeveloperContext, id: string) {
  const lot = await prisma.developmentLot.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      program: { select: { id: true, name: true, reference: true } },
      building: true,
      salesAgent: { select: { id: true, name: true, email: true } },
      buyerLead: true,
      optionHolderLead: true,
      childLots: true,
      parentLot: true,
      callsForFunds: {
        include: { milestone: true, invoice: true },
        orderBy: { milestone: { order: 'asc' } },
      },
      tmaRequests: {
        orderBy: { createdAt: 'desc' },
      },
      snags: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!lot) {
    throw new ServiceError('Lot not found', 404)
  }

  return lot
}

/**
 * What the buyer pays: the list price less any negotiated discount, plus tax.
 * The discount comes off before tax, so the tax a buyer is charged shrinks with
 * it, which is how a developer's invoice is actually computed.
 */
export function computeTotalPrice(basePrice: number, discount: number, taxRate: number): number {
  return Math.max(0, basePrice - discount) * (1 + taxRate / 100)
}

function readDiscount(value: unknown, basePrice: number): number {
  const discount = value === undefined || value === null || value === '' ? 0 : Number(value)
  if (!Number.isFinite(discount) || discount < 0) {
    throw new ServiceError('Discount must be zero or more', 400)
  }
  if (discount > basePrice) {
    throw new ServiceError('Discount cannot be more than the list price', 400)
  }
  return discount
}

function readFee(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) throw new ServiceError('The reservation fee must be zero or more', 400)
  return n
}

function readFeeDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) throw new ServiceError('The date the fee was received is not valid', 400)
  return d
}

function readBedrooms(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 50) {
    throw new ServiceError('Bedrooms must be a whole number', 400)
  }
  return n
}

/** A sales agent must belong to the workspace: its owner or one of its members. */
async function assertAgentInWorkspace(workspaceId: string, userId: string): Promise<void> {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    select: { id: true },
  })
  if (!workspace) throw new ServiceError('Sales agent is not a member of this workspace', 400)
}

export async function createLot(ctx: DeveloperContext, input: CreateLotInput) {
  const program = await prisma.program.findFirst({
    where: { id: input.programId, workspaceId: ctx.workspaceId },
  })
  if (!program) {
    throw new ServiceError('Program not found', 404)
  }

  const lotNumber = readString(input as any, 'lotNumber', 'Lot number', { required: true })!
  const basePrice = readNumber(input as any, 'basePrice', 'Base price', { min: 0, required: true })!
  const taxRate = input.taxRate !== undefined ? Number(input.taxRate) : 20.0
  const discount = readDiscount(input.discount, basePrice)
  const totalPrice = computeTotalPrice(basePrice, discount, taxRate)
  const bedrooms = readBedrooms(input.bedrooms)
  if (input.salesAgentId) await assertAgentInWorkspace(ctx.workspaceId, input.salesAgentId)

  // Verify unique lot number per program
  const existing = await prisma.developmentLot.findUnique({
    where: {
      programId_lotNumber: {
        programId: input.programId,
        lotNumber,
      },
    },
  })
  if (existing) {
    throw new ServiceError(`Lot ${lotNumber} already exists in this program`, 409)
  }

  const lot = await prisma.developmentLot.create({
    data: {
      workspaceId: ctx.workspaceId,
      programId: input.programId,
      buildingId: input.buildingId || null,
      lotNumber,
      type: input.type || 'apartment',
      typology: input.typology || null,
      floor: input.floor !== undefined ? Number(input.floor) : 0,
      orientation: input.orientation || null,
      bedrooms,
      surfaceArea: input.surfaceArea !== undefined ? Number(input.surfaceArea) : 0,
      terraceArea: input.terraceArea !== undefined ? Number(input.terraceArea) : 0,
      balconyArea: input.balconyArea !== undefined ? Number(input.balconyArea) : 0,
      gardenArea: input.gardenArea !== undefined ? Number(input.gardenArea) : 0,
      basePrice,
      discount,
      taxRate,
      totalPrice,
      salesAgentId: input.salesAgentId || null,
      status: 'available',
      publicToken: generatePortalToken(),
      publicTokenCreatedAt: new Date(),
      parentLotId: input.parentLotId || null,
      customFields: input.customFields || {},
    },
  })

  await syncProgramCounters(input.programId)
  return getLot(ctx, lot.id)
}

export async function updateLot(ctx: DeveloperContext, id: string, input: UpdateLotInput) {
  const existing = await prisma.developmentLot.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  })
  if (!existing) {
    throw new ServiceError('Lot not found', 404)
  }

  const data: any = {}
  if (input.buildingId !== undefined) data.buildingId = input.buildingId
  if (input.type !== undefined) data.type = input.type
  if (input.typology !== undefined) data.typology = input.typology
  if (input.floor !== undefined) data.floor = Number(input.floor)
  if (input.orientation !== undefined) data.orientation = input.orientation
  if (input.bedrooms !== undefined) data.bedrooms = readBedrooms(input.bedrooms)
  if (input.salesAgentId !== undefined) {
    if (input.salesAgentId) await assertAgentInWorkspace(ctx.workspaceId, input.salesAgentId)
    data.salesAgentId = input.salesAgentId || null
  }
  if (input.reservationFee !== undefined) data.reservationFee = readFee(input.reservationFee)
  if (input.reservationFeePaidAt !== undefined) data.reservationFeePaidAt = readFeeDate(input.reservationFeePaidAt)
  if (input.surfaceArea !== undefined) data.surfaceArea = Number(input.surfaceArea)
  if (input.terraceArea !== undefined) data.terraceArea = Number(input.terraceArea)
  if (input.balconyArea !== undefined) data.balconyArea = Number(input.balconyArea)
  if (input.gardenArea !== undefined) data.gardenArea = Number(input.gardenArea)
  if (input.parentLotId !== undefined) data.parentLotId = input.parentLotId
  if (input.customFields !== undefined) data.customFields = input.customFields

  let basePrice = existing.basePrice
  let discount = existing.discount
  let taxRate = existing.taxRate
  let priceChanged = false

  if (input.basePrice !== undefined) {
    basePrice = Number(input.basePrice)
    data.basePrice = basePrice
    priceChanged = true
  }
  if (input.discount !== undefined) {
    discount = readDiscount(input.discount, basePrice)
    data.discount = discount
    priceChanged = true
  }
  if (input.taxRate !== undefined) {
    taxRate = Number(input.taxRate)
    data.taxRate = taxRate
    priceChanged = true
  }
  if (priceChanged) {
    // A lowered list price can leave an old discount larger than the price.
    readDiscount(discount, basePrice)
    data.totalPrice = computeTotalPrice(basePrice, discount, taxRate)
  }

  if (input.status !== undefined) {
    data.status = input.status
    // Stamp the dates the dashboard reports sales by, the first time a unit gets
    // there. Never overwritten, so editing a status back and forth cannot move a
    // sale into a different month.
    if (input.status !== existing.status) {
      if (input.status === 'reserved' && !existing.reservedAt) data.reservedAt = new Date()
      if (input.status === 'contract_signed' && !existing.contractSignedAt) {
        data.contractSignedAt = new Date()
        if (!existing.reservedAt) data.reservedAt = data.contractSignedAt
      }
    }
  }

  await prisma.developmentLot.update({
    where: { id },
    data,
  })

  await syncProgramCounters(existing.programId)

  // The buyer's card follows the unit.
  if (existing.buyerLeadId && input.status !== undefined && input.status !== existing.status) {
    if (input.status === 'reserved') {
      await advanceBuyerLead(ctx, existing.buyerLeadId, DEVELOPER_STAGE_RESERVED)
    } else if (input.status === 'contract_signed' || input.status === 'deed_signed') {
      await advanceBuyerLead(ctx, existing.buyerLeadId, DEVELOPER_STAGE_WON)
    }
  }

  // The commission follows the sale: promised at the contract, earned at the deed.
  // Neither may undo the status change that was just saved, so a failure is logged.
  if (input.status !== undefined && input.status !== existing.status) {
    try {
      if (input.status === 'contract_signed') {
        await accrueLotCommission(id, ctx.userId)
        await fireLotEvent(ctx.workspaceId, 'contract_signed', id, ctx.userId)
      }
      if (input.status === 'deed_signed') {
        await accrueLotCommission(id, ctx.userId)
        await realizeLotCommission(id)
      }
    } catch (error) {
      console.error('Could not update the unit commission:', error)
    }
  }

  return getLot(ctx, id)
}

/** Locks a lot under temporary option with TTL (e.g., 48 hours) */
export async function setLotOption(
  ctx: DeveloperContext,
  lotId: string,
  input: { leadId: string; durationHours?: number }
) {
  const lot = await prisma.developmentLot.findFirst({
    where: { id: lotId, workspaceId: ctx.workspaceId },
  })
  if (!lot) throw new ServiceError('Lot not found', 404)
  if (lot.status !== 'available') {
    throw new ServiceError(`Lot cannot be optioned because it is currently ${lot.status}`, 400)
  }

  // Verify lead belongs to workspace
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, pipeline: { workspaceId: ctx.workspaceId } },
  })
  if (!lead) throw new ServiceError('Lead not found in this workspace', 404)

  const hours = input.durationHours ?? 48
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000)

  await prisma.developmentLot.update({
    where: { id: lotId },
    data: {
      status: 'optioned',
      optionHolderLeadId: input.leadId,
      optionExpiresAt: expiresAt,
    },
  })

  await syncProgramCounters(lot.programId)
  return getLot(ctx, lotId)
}

/** Releases an option hold and returns the lot to available status */
export async function releaseLotOption(ctx: DeveloperContext, lotId: string) {
  const lot = await prisma.developmentLot.findFirst({
    where: { id: lotId, workspaceId: ctx.workspaceId },
  })
  if (!lot) throw new ServiceError('Lot not found', 404)

  await prisma.developmentLot.update({
    where: { id: lotId },
    data: {
      status: 'available',
      optionHolderLeadId: null,
      optionExpiresAt: null,
    },
  })

  await syncProgramCounters(lot.programId)
  return getLot(ctx, lotId)
}

/** Converts an option or available lot into a firm reservation */
export async function reserveLot(
  ctx: DeveloperContext,
  lotId: string,
  input: {
    buyerLeadId: string
    salesAgentId?: string
    reservationFee?: number | string | null
    /** When the deposit arrived; omit if it has not yet. */
    reservationFeePaidAt?: string | Date | null
  }
) {
  const lot = await prisma.developmentLot.findFirst({
    where: { id: lotId, workspaceId: ctx.workspaceId },
  })
  if (!lot) throw new ServiceError('Lot not found', 404)

  const lead = await prisma.lead.findFirst({
    where: { id: input.buyerLeadId, pipeline: { workspaceId: ctx.workspaceId } },
  })
  if (!lead) throw new ServiceError('Buyer lead not found in this workspace', 404)

  if (input.salesAgentId) await assertAgentInWorkspace(ctx.workspaceId, input.salesAgentId)

  // Credit the deal to whoever was named, else to whoever recorded it, unless the
  // unit already has an agent from earlier in the sale.
  const salesAgentId = input.salesAgentId || lot.salesAgentId || ctx.userId

  await prisma.developmentLot.update({
    where: { id: lotId },
    data: {
      status: 'reserved',
      buyerLeadId: input.buyerLeadId,
      optionHolderLeadId: null,
      optionExpiresAt: null,
      reservedAt: new Date(),
      salesAgentId,
      ...(input.reservationFee !== undefined && { reservationFee: readFee(input.reservationFee) }),
      ...(input.reservationFeePaidAt !== undefined && { reservationFeePaidAt: readFeeDate(input.reservationFeePaidAt) }),
    },
  })

  await syncProgramCounters(lot.programId)
  await advanceBuyerLead(ctx, input.buyerLeadId, DEVELOPER_STAGE_RESERVED)

  // A reservation is the point a deal is most likely to stall -- paperwork, the
  // bank, a change of mind -- so it books its own chase two days out rather than
  // relying on someone remembering. A failure here must not undo the reservation.
  try {
    await createTask(ctx, {
      leadId: input.buyerLeadId,
      type: 'reservation',
      title: `Follow up on the reservation of ${lot.lotNumber}`,
      dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      assigneeId: salesAgentId,
    })
  } catch (error) {
    console.error('Could not create the reservation follow-up:', error)
  }

  // Tell the managers. A failed alert must not undo a reservation that has happened.
  try {
    await fireLotEvent(ctx.workspaceId, 'reservation_created', lotId, ctx.userId)
  } catch (error) {
    console.error('Could not raise the reservation alert:', error)
  }
  return getLot(ctx, lotId)
}

/**
 * Cancels a reservation or sale: the unit goes back on the market and the deal is
 * kept as a LotCancellation, which is what the cancellation rate counts.
 *
 * Only units that actually have a deal can be cancelled. An available unit has
 * nothing to cancel, and an optioned one is a hold that expires or is released
 * (releaseLotOption), not a lost sale.
 *
 * Calls for funds already issued are left alone. They are legal and financial
 * records, possibly already paid, and unwinding them is a decision for finance
 * rather than a side effect of this button.
 */
export async function cancelLotSale(
  ctx: DeveloperContext,
  lotId: string,
  input: { reason?: string; refundAmount?: number | string | null } = {}
) {
  const lot = await prisma.developmentLot.findFirst({
    where: { id: lotId, workspaceId: ctx.workspaceId },
  })
  if (!lot) throw new ServiceError('Lot not found', 404)

  if (!['reserved', 'contract_signed', 'deed_signed'].includes(lot.status)) {
    throw new ServiceError(`Only a reserved or sold unit can be cancelled; this one is ${lot.status}`, 400)
  }

  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 500) : ''
  const refundAmount = readFee(input.refundAmount) ?? 0

  await prisma.$transaction([
    prisma.lotCancellation.create({
      data: {
        workspaceId: ctx.workspaceId,
        lotId: lot.id,
        programId: lot.programId,
        leadId: lot.buyerLeadId,
        previousStatus: lot.status,
        reason: reason || null,
        refundAmount,
        amount: lot.totalPrice,
        salesAgentId: lot.salesAgentId,
      },
    }),
    prisma.developmentLot.update({
      where: { id: lot.id },
      data: {
        status: 'available',
        buyerLeadId: null,
        optionHolderLeadId: null,
        optionExpiresAt: null,
        reservedAt: null,
        contractSignedAt: null,
        salesAgentId: null,
        reservationFee: null,
        reservationFeePaidAt: null,
      },
    }),
    // A form or contract not yet accepted belongs to a sale that no longer
    // exists; leaving it open would let the buyer accept it into a dead deal.
    prisma.salesDocument.updateMany({
      where: { lotId, status: { in: ['draft', 'sent'] } },
      data: { status: 'void' },
    }),
  ])

  await syncProgramCounters(lot.programId)

  // Reported back rather than quietly rewritten: money that has been earned or
  // called is a decision for finance, and the person cancelling should know it stands.
  const [commission, remainingCalls] = await Promise.all([
    cancelLotCommission(lotId).catch((error) => {
      console.error('Could not cancel the unit commission:', error)
      return { cancelled: 0, settled: 0 }
    }),
    prisma.callForFunds.count({ where: { lotId, status: { not: 'draft' } } }),
  ])

  return {
    lot: await getLot(ctx, lotId),
    remainingCalls,
    commissionWithdrawn: commission.cancelled > 0,
    commissionSettled: commission.settled > 0,
  }
}

export async function deleteLot(ctx: DeveloperContext, id: string) {
  const lot = await prisma.developmentLot.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  })
  if (!lot) throw new ServiceError('Lot not found', 404)

  await prisma.developmentLot.delete({ where: { id } })
  await syncProgramCounters(lot.programId)
  return { success: true }
}
