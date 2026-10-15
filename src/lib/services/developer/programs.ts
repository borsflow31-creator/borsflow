import { prisma } from '@/lib/prisma'
import { CALL_INVOICE_MONEY_SELECT, callAmounts } from './call-balance'
import { ServiceError } from '../errors'
import { readString } from '../parse'
import { bucketForLotStatus, isProjectType } from '@/lib/crm/projects'
import { signMediaPaths } from '@/lib/crm/media-urls'

export interface DeveloperContext {
  workspaceId: string
  userId: string
}

export const PROGRAM_STATUSES = [
  'study',
  'commercialization',
  'construction',
  'delivery',
  'completed',
] as const

export type ProgramStatus = (typeof PROGRAM_STATUSES)[number]

export interface CreateProgramInput {
  reference: string
  name: string
  commercialName?: string
  description?: string
  projectType?: string
  developerName?: string
  websiteUrl?: string
  addressLine?: string
  city: string
  postalCode?: string
  countryCode?: string
  status?: string
  permitNumber?: string
  architectName?: string
  gfaBank?: string
  notaryName?: string
  notaryEmail?: string
  targetDeliveryDate?: string | Date
  launchDate?: string | Date
  salesTargetUnits?: number
  revenueTarget?: number
  commissionPercent?: number
  landDealId?: string
}

export interface UpdateProgramInput {
  reference?: string
  name?: string
  commercialName?: string
  description?: string
  projectType?: string
  developerName?: string
  websiteUrl?: string
  addressLine?: string
  city?: string
  postalCode?: string
  countryCode?: string
  status?: string
  permitNumber?: string
  architectName?: string
  gfaBank?: string
  notaryName?: string
  notaryEmail?: string
  targetDeliveryDate?: string | Date | null
  launchDate?: string | Date | null
  salesTargetUnits?: number | null
  revenueTarget?: number | null
  commissionPercent?: number | null
  landDealId?: string | null
}

/**
 * A project website is rendered as a link, so only http(s) is accepted -- a
 * javascript: or data: URL pasted into the field would be script injection.
 */
function cleanWebsite(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString()
  } catch {
    return null
  }
}

/** An empty or missing date is "not set"; an unparseable one is the caller's mistake. */
function readOptionalDate(value: string | Date | null | undefined, label: string): Date | null {
  if (value === undefined || value === null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new ServiceError(`${label} is not a valid date`, 400)
  return date
}

/** A target is a non-negative number, or null when cleared. */
function readTarget(value: unknown, label: string, integer: boolean): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) {
    throw new ServiceError(`${label} must be a ${integer ? 'whole ' : ''}number of zero or more`, 400)
  }
  return n
}

/** A commission rate: a percentage from 0 to 100, or null when cleared. */
function readPercent(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new ServiceError('The commission rate must be between 0 and 100', 400)
  }
  return n
}

/** Recalculates unit counters on a program from its real lots */
export async function syncProgramCounters(programId: string): Promise<void> {
  const counts = await prisma.developmentLot.groupBy({
    by: ['status'],
    where: { programId },
    _count: { _all: true },
  })

  let totalUnits = 0
  let availableUnits = 0
  let reservedUnits = 0
  let soldUnits = 0

  // The status-to-bucket mapping lives in lib/crm/projects, shared with the
  // project dashboard. Spelling it out a second time here is how the counters
  // and the screen reading them drift apart.
  for (const group of counts) {
    const c = group._count._all
    totalUnits += c
    const bucket = bucketForLotStatus(group.status)
    if (bucket === 'available') availableUnits += c
    else if (bucket === 'reserved') reservedUnits += c
    else if (bucket === 'sold') soldUnits += c
  }

  await prisma.program.update({
    where: { id: programId },
    data: {
      totalUnits,
      availableUnits,
      reservedUnits,
      soldUnits,
    },
  })
}

export interface ProgramSales {
  /** Sum of final prices of units under contract or beyond. */
  soldValue: number
  /** Sum of final prices of every unit: what the project is worth built out. */
  totalValue: number
  /** Called for funds and not yet paid. */
  outstanding: number
  /** Called for funds and already paid. */
  collected: number
}

const EMPTY_SALES: ProgramSales = { soldValue: 0, totalValue: 0, outstanding: 0, collected: 0 }

/**
 * Money figures for a set of programs, in two queries (one grouped) rather than loading
 * every lot. The status buckets come from lib/crm/projects so "sold"
 * means the same thing here as on the dashboard and the counters.
 */
export async function programSalesFigures(
  workspaceId: string,
  programIds: string[]
): Promise<Map<string, ProgramSales>> {
  const result = new Map<string, ProgramSales>()
  if (programIds.length === 0) return result
  const entry = (id: string) => {
    let s = result.get(id)
    if (!s) {
      s = { ...EMPTY_SALES }
      result.set(id, s)
    }
    return s
  }

  const [byStatus, calls] = await Promise.all([
    prisma.developmentLot.groupBy({
      by: ['programId', 'status'],
      where: { workspaceId, programId: { in: programIds } },
      _sum: { totalPrice: true },
    }),
    prisma.callForFunds.findMany({
      where: { workspaceId, lot: { programId: { in: programIds } }, status: { not: 'draft' } },
      select: { amount: true, status: true, dueAt: true, invoice: CALL_INVOICE_MONEY_SELECT, lot: { select: { programId: true } } },
    }),
  ])

  for (const row of byStatus) {
    const s = entry(row.programId)
    const value = row._sum.totalPrice ?? 0
    s.totalValue += value
    if (bucketForLotStatus(row.status) === 'sold') s.soldValue += value
  }

  for (const call of calls) {
    const s = entry(call.lot.programId)
    const owed = callAmounts(call)
    s.collected += owed.collected
    s.outstanding += owed.outstanding
  }

  return result
}

export async function listPrograms(
  ctx: DeveloperContext,
  options: { status?: string; search?: string } = {}
) {
  const where: any = { workspaceId: ctx.workspaceId }

  if (options.status) {
    where.status = options.status
  }

  if (options.search) {
    where.OR = [
      { name: { contains: options.search, mode: 'insensitive' } },
      { reference: { contains: options.search, mode: 'insensitive' } },
      { city: { contains: options.search, mode: 'insensitive' } },
    ]
  }

  const programs = await prisma.program.findMany({
    where,
    include: {
      buildings: {
        select: { id: true, name: true, floorsCount: true, _count: { select: { lots: true } } },
      },
      milestones: {
        select: { id: true, stageKey: true, title: true, targetPercentage: true, isCertified: true },
        orderBy: { order: 'asc' },
      },
      // The cover only, for the card thumbnail. Loading every image to find one
      // would make the list page grow with the media library behind it.
      media: {
        where: { isCover: true },
        take: 1,
        select: { filePath: true, externalUrl: true },
      },
      _count: {
        select: { lots: true, media: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // One batch of signed URLs for the whole page rather than one call per card.
  const urls = await signMediaPaths(programs.map((p) => p.media[0]?.filePath ?? null))

  const sales = await programSalesFigures(
    ctx.workspaceId,
    programs.map((p) => p.id)
  )

  return programs.map(({ media, ...program }) => ({
    ...program,
    coverUrl: media[0]?.filePath ? urls.get(media[0].filePath) ?? null : media[0]?.externalUrl ?? null,
    sales: sales.get(program.id) ?? EMPTY_SALES,
  }))
}

export async function getProgram(ctx: DeveloperContext, id: string) {
  const program = await prisma.program.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      buildings: {
        include: {
          lots: {
            orderBy: [{ floor: 'desc' }, { lotNumber: 'asc' }],
          },
        },
        orderBy: { name: 'asc' },
      },
      milestones: {
        orderBy: { order: 'asc' },
      },
      landDeal: true,
      media: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!program) {
    throw new ServiceError('Program not found', 404)
  }

  return program
}

export async function createProgram(ctx: DeveloperContext, input: CreateProgramInput) {
  const reference = readString(input as any, 'reference', 'Reference', { required: true })!
  const name = readString(input as any, 'name', 'Program name', { required: true })!
  const city = readString(input as any, 'city', 'City', { required: true })!

  // Check unique reference per workspace
  const existing = await prisma.program.findFirst({
    where: { workspaceId: ctx.workspaceId, reference },
  })
  if (existing) {
    throw new ServiceError(`A program with reference "${reference}" already exists`, 409)
  }

  const program = await prisma.program.create({
    data: {
      workspaceId: ctx.workspaceId,
      reference,
      name,
      commercialName: input.commercialName?.trim() || null,
      description: input.description?.trim() || null,
      projectType: isProjectType(input.projectType) ? input.projectType : 'residential',
      developerName: input.developerName?.trim() || null,
      websiteUrl: cleanWebsite(input.websiteUrl),
      addressLine: input.addressLine?.trim() || null,
      city,
      postalCode: input.postalCode?.trim() || null,
      countryCode: input.countryCode?.trim() || 'FR',
      status: input.status || 'study',
      permitNumber: input.permitNumber?.trim() || null,
      architectName: input.architectName?.trim() || null,
      gfaBank: input.gfaBank?.trim() || null,
      notaryName: input.notaryName?.trim() || null,
      notaryEmail: input.notaryEmail?.trim() || null,
      targetDeliveryDate: input.targetDeliveryDate ? new Date(input.targetDeliveryDate) : null,
      launchDate: readOptionalDate(input.launchDate, 'Launch date'),
      salesTargetUnits: readTarget(input.salesTargetUnits, 'Unit sales target', true),
      revenueTarget: readTarget(input.revenueTarget, 'Revenue target', false),
      commissionPercent: readPercent(input.commissionPercent),
      landDealId: input.landDealId || null,
      createdById: ctx.userId,
    },
  })

  // Seed standard VEFA construction milestones for the new program
  const defaultMilestones = [
    { stageKey: 'FOUNDATIONS', title: 'Achèvement des fondations', targetPercentage: 15.0, order: 1 },
    { stageKey: 'GROUND_FLOOR_SLAB', title: 'Dalle haute du rez-de-chaussée', targetPercentage: 35.0, order: 2 },
    { stageKey: 'ROOF_WATERTIGHT', title: 'Mise hors d’eau (Toiture terminée)', targetPercentage: 70.0, order: 3 },
    { stageKey: 'PLASTERING_COMPLETE', title: 'Achèvement des cloisons et plâtrerie', targetPercentage: 90.0, order: 4 },
    { stageKey: 'COMPLETION', title: 'Achèvement des travaux (Mise hors d’air)', targetPercentage: 95.0, order: 5 },
    { stageKey: 'DELIVERY', title: 'Mise à disposition / Livraison des clés', targetPercentage: 100.0, order: 6 },
  ]

  await prisma.constructionMilestone.createMany({
    data: defaultMilestones.map((m) => ({
      programId: program.id,
      stageKey: m.stageKey,
      title: m.title,
      targetPercentage: m.targetPercentage,
      order: m.order,
      isCertified: false,
    })),
  })

  return getProgram(ctx, program.id)
}

export async function updateProgram(ctx: DeveloperContext, id: string, input: UpdateProgramInput) {
  const existing = await prisma.program.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  })
  if (!existing) {
    throw new ServiceError('Program not found', 404)
  }

  if (input.reference && input.reference !== existing.reference) {
    const duplicate = await prisma.program.findFirst({
      where: { workspaceId: ctx.workspaceId, reference: input.reference, NOT: { id } },
    })
    if (duplicate) {
      throw new ServiceError(`A program with reference "${input.reference}" already exists`, 409)
    }
  }

  const data: any = {}
  if (input.reference !== undefined) data.reference = input.reference.trim()
  if (input.name !== undefined) data.name = input.name.trim()
  if (input.commercialName !== undefined) data.commercialName = input.commercialName?.trim() || null
  if (input.description !== undefined) data.description = input.description?.trim() || null
  if (input.projectType !== undefined && isProjectType(input.projectType)) data.projectType = input.projectType
  if (input.developerName !== undefined) data.developerName = input.developerName?.trim() || null
  if (input.websiteUrl !== undefined) data.websiteUrl = cleanWebsite(input.websiteUrl)
  if (input.addressLine !== undefined) data.addressLine = input.addressLine?.trim() || null
  if (input.city !== undefined) data.city = input.city.trim()
  if (input.postalCode !== undefined) data.postalCode = input.postalCode?.trim() || null
  if (input.countryCode !== undefined) data.countryCode = input.countryCode?.trim() || 'FR'
  if (input.status !== undefined) data.status = input.status
  if (input.permitNumber !== undefined) data.permitNumber = input.permitNumber?.trim() || null
  if (input.architectName !== undefined) data.architectName = input.architectName?.trim() || null
  if (input.gfaBank !== undefined) data.gfaBank = input.gfaBank?.trim() || null
  if (input.notaryName !== undefined) data.notaryName = input.notaryName?.trim() || null
  if (input.notaryEmail !== undefined) data.notaryEmail = input.notaryEmail?.trim() || null
  if (input.targetDeliveryDate !== undefined) {
    data.targetDeliveryDate = input.targetDeliveryDate ? new Date(input.targetDeliveryDate) : null
  }
  if (input.launchDate !== undefined) data.launchDate = readOptionalDate(input.launchDate, 'Launch date')
  if (input.salesTargetUnits !== undefined) {
    data.salesTargetUnits = readTarget(input.salesTargetUnits, 'Unit sales target', true)
  }
  if (input.revenueTarget !== undefined) data.revenueTarget = readTarget(input.revenueTarget, 'Revenue target', false)
  if (input.commissionPercent !== undefined) data.commissionPercent = readPercent(input.commissionPercent)
  if (input.landDealId !== undefined) data.landDealId = input.landDealId

  await prisma.program.update({
    where: { id },
    data,
  })

  return getProgram(ctx, id)
}

export async function deleteProgram(ctx: DeveloperContext, id: string) {
  const existing = await prisma.program.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  })
  if (!existing) {
    throw new ServiceError('Program not found', 404)
  }

  await prisma.program.delete({ where: { id } })
  return { success: true }
}
