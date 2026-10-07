import { prisma } from '@/lib/prisma'
import { CrmLogger } from '@/lib/crm/logger'
import { onSubjectStageChanged } from '@/lib/crm/subject-events'
import { DEVELOPER_SALES_PIPELINE, parseStages } from '@/lib/crm/lifecycle'

/**
 * Moves a buyer forward on the developer's "Buyer sales" board when a unit they
 * are buying changes state: Reserved when a unit is reserved for them, Won when
 * the contract is signed.
 *
 * Only ever forward, and only on that board. A lead on any other board (the
 * agency "Contacts" board, or a board the workspace built itself) is left where
 * it is, because its stages mean something this code cannot know. A lead already
 * past the target -- Won, or Lost -- is not dragged back to Reserved by a later
 * unit event.
 *
 * Goes through the same side effects as dragging the card (activity log and
 * stage automations), so a "Reserved" follow-up email sequence fires whether the
 * salesperson drags the card or reserves the unit.
 *
 * Never throws: the unit operation that called this has already succeeded and
 * must not be reported as failed because a board column could not be updated.
 */
export async function advanceBuyerLead(
  ctx: { workspaceId: string; userId: string },
  leadId: string,
  targetStage: string
): Promise<void> {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, pipeline: { workspaceId: ctx.workspaceId } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        stage: true,
        pipelineId: true,
        pipeline: { select: { name: true, stages: true } },
      },
    })
    if (!lead || lead.pipeline.name !== DEVELOPER_SALES_PIPELINE.name) return

    const stages = parseStages(lead.pipeline.stages)
    const from = stages.indexOf(lead.stage)
    const to = stages.indexOf(targetStage)
    // A renamed stage or an unknown column: leave the card alone.
    if (to === -1 || from === -1 || to <= from) return

    // Bottom of the destination column.
    const last = await prisma.lead.aggregate({
      where: { pipelineId: lead.pipelineId, stage: targetStage },
      _max: { order: true },
    })

    await prisma.lead.update({
      where: { id: lead.id },
      data: { stage: targetStage, order: (last._max.order ?? -1) + 1 },
    })

    await Promise.allSettled([
      CrmLogger.logStageChange({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        leadId: lead.id,
        leadName: `${lead.firstName} ${lead.lastName}`.trim(),
        pipelineId: lead.pipelineId,
        from: lead.stage,
        to: targetStage,
      }),
      onSubjectStageChanged({
        subjectType: 'Lead',
        subjectId: lead.id,
        pipelineId: lead.pipelineId,
        workspaceId: ctx.workspaceId,
        fromStage: lead.stage,
        toStage: targetStage,
      }),
    ])
  } catch (error) {
    console.error('Could not advance buyer lead:', error)
  }
}
