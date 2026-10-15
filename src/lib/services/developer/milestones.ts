import { prisma } from '@/lib/prisma'
import { ServiceError } from '../errors'
import { DeveloperContext } from './programs'
import { generateCallsForFundsForMilestone, type GenerateCallsResult } from './calls-for-funds'

export interface CertifyMilestoneInput {
  architectCertificateDoc?: string
  autoGenerateCalls?: boolean
}

export async function listMilestones(ctx: DeveloperContext, programId: string) {
  const program = await prisma.program.findFirst({
    where: { id: programId, workspaceId: ctx.workspaceId },
  })
  if (!program) throw new ServiceError('Program not found', 404)

  return prisma.constructionMilestone.findMany({
    where: { programId },
    include: {
      building: { select: { id: true, name: true } },
      _count: { select: { callsForFunds: true } },
    },
    orderBy: { order: 'asc' },
  })
}

export async function certifyMilestone(
  ctx: DeveloperContext,
  milestoneId: string,
  input: CertifyMilestoneInput = {}
) {
  const milestone = await prisma.constructionMilestone.findUnique({
    where: { id: milestoneId },
    include: { program: true },
  })
  if (!milestone || milestone.program.workspaceId !== ctx.workspaceId) {
    throw new ServiceError('Construction milestone not found', 404)
  }

  if (milestone.isCertified) {
    throw new ServiceError('This milestone is already certified', 400)
  }

  // Certification and billing are one step: if any call or invoice cannot be
  // created, the milestone is not certified either, and the user can try again.
  let result: { updatedMilestone: Awaited<ReturnType<typeof prisma.constructionMilestone.findUniqueOrThrow>>; billingResult: GenerateCallsResult | null }
  try {
    result = await prisma.$transaction(async (tx) => {
      // Conditional, so two simultaneous certifications cannot both bill.
      const claimed = await tx.constructionMilestone.updateMany({
        where: { id: milestoneId, isCertified: false },
        data: {
          isCertified: true,
          certifiedAt: new Date(),
          architectCertificateDoc: input.architectCertificateDoc?.trim() || null,
        },
      })
      if (claimed.count === 0) throw new ServiceError('This milestone is already certified', 400)
      const updatedMilestone = await tx.constructionMilestone.findUniqueOrThrow({ where: { id: milestoneId } })

      const billingResult = input.autoGenerateCalls !== false
        ? await generateCallsForFundsForMilestone(ctx, milestoneId, tx)
        : null
      return { updatedMilestone, billingResult }
    }, { timeout: 60_000, maxWait: 10_000 })
  } catch (error) {
    if ((error as { code?: string } | null)?.code === 'P2002') {
      throw new ServiceError('Calls for this milestone were generated at the same time by someone else; nothing was changed', 409)
    }
    throw error
  }
  const { updatedMilestone, billingResult } = result

  return {
    milestone: updatedMilestone,
    billingResult,
  }
}
