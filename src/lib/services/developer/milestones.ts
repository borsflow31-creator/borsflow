import { prisma } from '@/lib/prisma'
import { ServiceError } from '../errors'
import { DeveloperContext } from './programs'
import { generateCallsForFundsForMilestone } from './calls-for-funds'

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

  const updatedMilestone = await prisma.constructionMilestone.update({
    where: { id: milestoneId },
    data: {
      isCertified: true,
      certifiedAt: new Date(),
      architectCertificateDoc: input.architectCertificateDoc?.trim() || null,
    },
  })

  // Optionally auto-generate calls for funds for all active buyers
  let billingResult = null
  if (input.autoGenerateCalls !== false) {
    billingResult = await generateCallsForFundsForMilestone(ctx, milestoneId)
  }

  return {
    milestone: updatedMilestone,
    billingResult,
  }
}
