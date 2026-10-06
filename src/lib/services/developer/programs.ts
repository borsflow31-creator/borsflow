import { prisma } from '@/lib/prisma'
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

  return programs.map(({ media, ...program }) => ({
    ...program,
    coverUrl: media[0]?.filePath ? urls.get(media[0].filePath) ?? null : media[0]?.externalUrl ?? null,
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
