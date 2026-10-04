import { prisma } from '@/lib/prisma'
import { ServiceError } from '../errors'
import { readString, readNumber } from '../parse'
import { DeveloperContext, createProgram } from './programs'

export const LAND_DEAL_STATUSES = [
  'prospecting',
  'feasibility',
  'unilateral_agreement',
  'permit_filed',
  'permit_cleared',
  'deed_signed',
  'abandoned',
] as const

export interface CreateLandDealInput {
  reference: string
  title: string
  description?: string
  address?: string
  city: string
  postalCode?: string
  cadastralRef?: string
  plotArea?: number
  zoning?: string
  status?: string
  targetUnits?: number
  sellableArea?: number
  landPrice?: number
  estimatedRevenue?: number
  estimatedCost?: number
  vendorLeadId?: string
  assignedToId?: string
  permitNumber?: string
  notes?: string
}

export interface UpdateLandDealInput {
  reference?: string
  title?: string
  description?: string
  address?: string
  city?: string
  postalCode?: string
  cadastralRef?: string
  plotArea?: number
  zoning?: string
  status?: string
  targetUnits?: number
  sellableArea?: number
  landPrice?: number
  estimatedRevenue?: number
  estimatedCost?: number
  vendorLeadId?: string | null
  assignedToId?: string | null
  permitNumber?: string | null
  permitFiledAt?: string | Date | null
  permitGrantedAt?: string | Date | null
  permitClearedAt?: string | Date | null
  deedSignedAt?: string | Date | null
  notes?: string
}

function calculateMargin(revenue?: number | null, cost?: number | null): number | undefined {
  if (revenue && cost && revenue > 0) {
    return Number((((revenue - cost) / revenue) * 100).toFixed(2))
  }
  return undefined
}

export async function listLandDeals(
  ctx: DeveloperContext,
  options: { status?: string; search?: string } = {}
) {
  const where: any = { workspaceId: ctx.workspaceId }
  if (options.status) where.status = options.status
  if (options.search) {
    where.OR = [
      { title: { contains: options.search, mode: 'insensitive' } },
      { reference: { contains: options.search, mode: 'insensitive' } },
      { city: { contains: options.search, mode: 'insensitive' } },
      { cadastralRef: { contains: options.search, mode: 'insensitive' } },
    ]
  }

  return prisma.landDeal.findMany({
    where,
    include: {
      vendorLead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      program: { select: { id: true, name: true, reference: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getLandDeal(ctx: DeveloperContext, id: string) {
  const deal = await prisma.landDeal.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      vendorLead: true,
      assignedTo: true,
      program: true,
      createdBy: { select: { id: true, name: true } },
    },
  })
  if (!deal) throw new ServiceError('Land deal not found', 404)
  return deal
}

export async function createLandDeal(ctx: DeveloperContext, input: CreateLandDealInput) {
  const reference = readString(input as any, 'reference', 'Reference', { required: true })!
  const title = readString(input as any, 'title', 'Title', { required: true })!
  const city = readString(input as any, 'city', 'City', { required: true })!

  const existing = await prisma.landDeal.findFirst({
    where: { workspaceId: ctx.workspaceId, reference },
  })
  if (existing) {
    throw new ServiceError(`A land deal with reference "${reference}" already exists`, 409)
  }

  const projectedMargin = calculateMargin(input.estimatedRevenue, input.estimatedCost)

  const deal = await prisma.landDeal.create({
    data: {
      workspaceId: ctx.workspaceId,
      reference,
      title,
      description: input.description?.trim() || null,
      address: input.address?.trim() || null,
      city,
      postalCode: input.postalCode?.trim() || null,
      cadastralRef: input.cadastralRef?.trim() || null,
      plotArea: input.plotArea !== undefined ? Number(input.plotArea) : null,
      zoning: input.zoning?.trim() || null,
      status: input.status || 'prospecting',
      targetUnits: input.targetUnits !== undefined ? Number(input.targetUnits) : null,
      sellableArea: input.sellableArea !== undefined ? Number(input.sellableArea) : null,
      landPrice: input.landPrice !== undefined ? Number(input.landPrice) : null,
      estimatedRevenue: input.estimatedRevenue !== undefined ? Number(input.estimatedRevenue) : null,
      estimatedCost: input.estimatedCost !== undefined ? Number(input.estimatedCost) : null,
      projectedMargin: projectedMargin !== undefined ? projectedMargin : null,
      vendorLeadId: input.vendorLeadId || null,
      assignedToId: input.assignedToId || null,
      permitNumber: input.permitNumber?.trim() || null,
      notes: input.notes?.trim() || null,
      createdById: ctx.userId,
    },
  })

  return getLandDeal(ctx, deal.id)
}

export async function updateLandDeal(ctx: DeveloperContext, id: string, input: UpdateLandDealInput) {
  const existing = await prisma.landDeal.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  })
  if (!existing) throw new ServiceError('Land deal not found', 404)

  const data: any = {}
  if (input.reference !== undefined) data.reference = input.reference.trim()
  if (input.title !== undefined) data.title = input.title.trim()
  if (input.description !== undefined) data.description = input.description?.trim() || null
  if (input.address !== undefined) data.address = input.address?.trim() || null
  if (input.city !== undefined) data.city = input.city.trim()
  if (input.postalCode !== undefined) data.postalCode = input.postalCode?.trim() || null
  if (input.cadastralRef !== undefined) data.cadastralRef = input.cadastralRef?.trim() || null
  if (input.plotArea !== undefined) data.plotArea = input.plotArea !== null ? Number(input.plotArea) : null
  if (input.zoning !== undefined) data.zoning = input.zoning?.trim() || null
  if (input.status !== undefined) data.status = input.status
  if (input.targetUnits !== undefined) data.targetUnits = input.targetUnits !== null ? Number(input.targetUnits) : null
  if (input.sellableArea !== undefined) data.sellableArea = input.sellableArea !== null ? Number(input.sellableArea) : null
  if (input.landPrice !== undefined) data.landPrice = input.landPrice !== null ? Number(input.landPrice) : null
  if (input.estimatedRevenue !== undefined) data.estimatedRevenue = input.estimatedRevenue !== null ? Number(input.estimatedRevenue) : null
  if (input.estimatedCost !== undefined) data.estimatedCost = input.estimatedCost !== null ? Number(input.estimatedCost) : null

  const newRevenue = input.estimatedRevenue !== undefined ? input.estimatedRevenue : existing.estimatedRevenue
  const newCost = input.estimatedCost !== undefined ? input.estimatedCost : existing.estimatedCost
  data.projectedMargin = calculateMargin(newRevenue, newCost) ?? existing.projectedMargin

  if (input.vendorLeadId !== undefined) data.vendorLeadId = input.vendorLeadId
  if (input.assignedToId !== undefined) data.assignedToId = input.assignedToId
  if (input.permitNumber !== undefined) data.permitNumber = input.permitNumber?.trim() || null
  if (input.permitFiledAt !== undefined) data.permitFiledAt = input.permitFiledAt ? new Date(input.permitFiledAt) : null
  if (input.permitGrantedAt !== undefined) data.permitGrantedAt = input.permitGrantedAt ? new Date(input.permitGrantedAt) : null
  if (input.permitClearedAt !== undefined) data.permitClearedAt = input.permitClearedAt ? new Date(input.permitClearedAt) : null
  if (input.deedSignedAt !== undefined) data.deedSignedAt = input.deedSignedAt ? new Date(input.deedSignedAt) : null
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null

  await prisma.landDeal.update({ where: { id }, data })
  return getLandDeal(ctx, id)
}

/** One-click conversion of an acquired land deal into a full development Program */
export async function convertLandDealToProgram(ctx: DeveloperContext, landDealId: string) {
  const deal = await getLandDeal(ctx, landDealId)
  if (deal.program) {
    throw new ServiceError('This land deal is already linked to a program', 400)
  }

  const program = await createProgram(ctx, {
    reference: `PRG-${deal.reference}`,
    name: deal.title,
    addressLine: deal.address || undefined,
    city: deal.city,
    postalCode: deal.postalCode || undefined,
    permitNumber: deal.permitNumber || undefined,
    landDealId: deal.id,
    status: 'study',
  })

  return program
}
