import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { ServiceError } from '../errors'
import { readString, readNumber } from '../parse'
import { syncProgramCounters } from './programs'

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
  surfaceArea?: number
  terraceArea?: number
  balconyArea?: number
  gardenArea?: number
  basePrice: number
  taxRate?: number
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
  surfaceArea?: number
  terraceArea?: number
  balconyArea?: number
  gardenArea?: number
  basePrice?: number
  taxRate?: number
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
      buyerLead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      optionHolderLead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      childLots: { select: { id: true, lotNumber: true, type: true, totalPrice: true } },
      parentLot: { select: { id: true, lotNumber: true, type: true } },
    },
    orderBy: [{ floor: 'desc' }, { lotNumber: 'asc' }],
  })
}

export async function getLot(ctx: DeveloperContext, id: string) {
  const lot = await prisma.developmentLot.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      program: { select: { id: true, name: true, reference: true } },
      building: true,
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
  const totalPrice = basePrice * (1 + taxRate / 100)

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
      surfaceArea: input.surfaceArea !== undefined ? Number(input.surfaceArea) : 0,
      terraceArea: input.terraceArea !== undefined ? Number(input.terraceArea) : 0,
      balconyArea: input.balconyArea !== undefined ? Number(input.balconyArea) : 0,
      gardenArea: input.gardenArea !== undefined ? Number(input.gardenArea) : 0,
      basePrice,
      taxRate,
      totalPrice,
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
  if (input.surfaceArea !== undefined) data.surfaceArea = Number(input.surfaceArea)
  if (input.terraceArea !== undefined) data.terraceArea = Number(input.terraceArea)
  if (input.balconyArea !== undefined) data.balconyArea = Number(input.balconyArea)
  if (input.gardenArea !== undefined) data.gardenArea = Number(input.gardenArea)
  if (input.parentLotId !== undefined) data.parentLotId = input.parentLotId
  if (input.customFields !== undefined) data.customFields = input.customFields

  let basePrice = existing.basePrice
  let taxRate = existing.taxRate
  let priceChanged = false

  if (input.basePrice !== undefined) {
    basePrice = Number(input.basePrice)
    data.basePrice = basePrice
    priceChanged = true
  }
  if (input.taxRate !== undefined) {
    taxRate = Number(input.taxRate)
    data.taxRate = taxRate
    priceChanged = true
  }
  if (priceChanged) {
    data.totalPrice = basePrice * (1 + taxRate / 100)
  }

  if (input.status !== undefined) {
    data.status = input.status
  }

  await prisma.developmentLot.update({
    where: { id },
    data,
  })

  await syncProgramCounters(existing.programId)
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
  input: { buyerLeadId: string }
) {
  const lot = await prisma.developmentLot.findFirst({
    where: { id: lotId, workspaceId: ctx.workspaceId },
  })
  if (!lot) throw new ServiceError('Lot not found', 404)

  const lead = await prisma.lead.findFirst({
    where: { id: input.buyerLeadId, pipeline: { workspaceId: ctx.workspaceId } },
  })
  if (!lead) throw new ServiceError('Buyer lead not found in this workspace', 404)

  await prisma.developmentLot.update({
    where: { id: lotId },
    data: {
      status: 'reserved',
      buyerLeadId: input.buyerLeadId,
      optionHolderLeadId: null,
      optionExpiresAt: null,
    },
  })

  await syncProgramCounters(lot.programId)
  return getLot(ctx, lotId)
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
