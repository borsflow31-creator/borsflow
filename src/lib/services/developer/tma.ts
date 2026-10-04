import { prisma } from '@/lib/prisma'
import { ServiceError } from '../errors'
import { readString, readNumber } from '../parse'
import { DeveloperContext } from './programs'

export const TMA_CATEGORIES = [
  'electrical',
  'plumbing',
  'partitions',
  'finishes',
  'other',
] as const

export const TMA_STATUSES = [
  'requested',
  'feasibility_approved',
  'quote_sent',
  'accepted',
  'rejected',
  'completed',
] as const

export interface CreateTMAInput {
  lotId: string
  category?: string
  title: string
  description: string
  costEstimate?: number
  priceQuote?: number
  buyerLeadId?: string
}

export interface ApproveTMAInput {
  techApproverNote?: string
  costEstimate?: number
  priceQuote?: number
}

export interface AcceptTMAInput {
  signedAddendumDoc?: string
}

export async function listTMARequests(
  ctx: DeveloperContext,
  options: { programId?: string; lotId?: string; status?: string; category?: string } = {}
) {
  const where: any = { workspaceId: ctx.workspaceId }
  if (options.status) where.status = options.status
  if (options.category) where.category = options.category
  if (options.lotId) where.lotId = options.lotId
  if (options.programId) {
    where.lot = { programId: options.programId }
  }

  return prisma.tMARequest.findMany({
    where,
    include: {
      lot: {
        select: {
          id: true,
          lotNumber: true,
          typology: true,
          totalPrice: true,
          program: { select: { id: true, name: true, reference: true } },
        },
      },
      buyerLead: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getTMARequest(ctx: DeveloperContext, id: string) {
  const request = await prisma.tMARequest.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      lot: {
        include: {
          program: true,
          building: true,
        },
      },
      buyerLead: true,
    },
  })

  if (!request) {
    throw new ServiceError('TMA request not found', 404)
  }

  return request
}

export async function createTMARequest(ctx: DeveloperContext, input: CreateTMAInput) {
  const lot = await prisma.developmentLot.findFirst({
    where: { id: input.lotId, workspaceId: ctx.workspaceId },
    include: { program: true },
  })
  if (!lot) throw new ServiceError('Lot not found', 404)

  const buyerLeadId = input.buyerLeadId || lot.buyerLeadId || lot.optionHolderLeadId
  if (!buyerLeadId) {
    throw new ServiceError('A buyer or option holder must be attached to the lot to submit TMA requests', 400)
  }

  const title = readString(input as any, 'title', 'Title', { required: true })!
  const description = readString(input as any, 'description', 'Description', { required: true })!
  const category = input.category || 'finishes'

  // Count existing TMAs for this lot to produce sequential reference
  const count = await prisma.tMARequest.count({
    where: { lotId: lot.id },
  })
  const reference = `TMA-${lot.lotNumber}-${String(count + 1).padStart(2, '0')}`

  const costEstimate = input.costEstimate !== undefined ? Number(input.costEstimate) : 0
  const priceQuote = input.priceQuote !== undefined ? Number(input.priceQuote) : 0

  const tma = await prisma.tMARequest.create({
    data: {
      workspaceId: ctx.workspaceId,
      lotId: lot.id,
      buyerLeadId,
      reference,
      category,
      title,
      description,
      status: priceQuote > 0 ? 'quote_sent' : 'requested',
      costEstimate,
      priceQuote,
    },
    include: {
      lot: true,
      buyerLead: true,
    },
  })

  return tma
}

/** Technical feasibility review and costing by the site manager / technical department */
export async function approveTMATechnical(
  ctx: DeveloperContext,
  id: string,
  input: ApproveTMAInput
) {
  const existing = await prisma.tMARequest.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  })
  if (!existing) throw new ServiceError('TMA request not found', 404)

  const data: any = {
    status: input.priceQuote && input.priceQuote > 0 ? 'quote_sent' : 'feasibility_approved',
    techApprovedAt: new Date(),
  }

  if (input.techApproverNote !== undefined) data.techApproverNote = input.techApproverNote?.trim() || null
  if (input.costEstimate !== undefined) data.costEstimate = Number(input.costEstimate)
  if (input.priceQuote !== undefined) data.priceQuote = Number(input.priceQuote)

  const updated = await prisma.tMARequest.update({
    where: { id },
    data,
    include: { lot: true, buyerLead: true },
  })

  return updated
}

/** Buyer acceptance and signing of the TMA addendum (Avenant TMA) */
export async function acceptTMARequest(
  ctx: DeveloperContext,
  id: string,
  input: AcceptTMAInput = {}
) {
  const tma = await prisma.tMARequest.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { lot: true },
  })
  if (!tma) throw new ServiceError('TMA request not found', 404)
  if (tma.status === 'accepted') {
    throw new ServiceError('This TMA request has already been accepted', 400)
  }

  const updated = await prisma.tMARequest.update({
    where: { id },
    data: {
      status: 'accepted',
      signedAt: new Date(),
      signedAddendumDoc: input.signedAddendumDoc?.trim() || null,
    },
    include: { lot: true, buyerLead: true },
  })

  // Automatically update the lot's total price by adding the signed TMA price quote
  if (tma.priceQuote > 0) {
    const newTotalPrice = Number((tma.lot.totalPrice + tma.priceQuote).toFixed(2))
    await prisma.developmentLot.update({
      where: { id: tma.lotId },
      data: { totalPrice: newTotalPrice },
    })
  }

  return updated
}

export async function rejectTMARequest(
  ctx: DeveloperContext,
  id: string,
  reason?: string
) {
  const tma = await prisma.tMARequest.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  })
  if (!tma) throw new ServiceError('TMA request not found', 404)

  return prisma.tMARequest.update({
    where: { id },
    data: {
      status: 'rejected',
      techApproverNote: reason ? `Rejected: ${reason}` : tma.techApproverNote,
    },
  })
}

export async function deleteTMARequest(ctx: DeveloperContext, id: string) {
  const tma = await prisma.tMARequest.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  })
  if (!tma) throw new ServiceError('TMA request not found', 404)

  await prisma.tMARequest.delete({ where: { id } })
  return { success: true }
}
