import { prisma } from '@/lib/prisma'

/**
 * A campaign may only reference a template and a segment from its own workspace.
 *
 * Without this, a campaign created in workspace A could name workspace B's
 * segment: executeCampaign reads recipients from that segment's members, so the
 * campaign would mail B's leads with A's content. Returns an error message, or
 * null when every supplied reference belongs to `workspaceId`.
 */
export async function checkCampaignRefs(
  workspaceId: string,
  refs: { templateId?: string | null; segmentationRuleId?: string | null }
): Promise<string | null> {
  if (refs.templateId) {
    const template = await prisma.emailTemplate.findFirst({
      where: { id: refs.templateId, workspaceId },
      select: { id: true },
    })
    if (!template) return 'Template not found in this workspace'
  }

  if (refs.segmentationRuleId) {
    const segment = await prisma.segmentationRule.findFirst({
      where: { id: refs.segmentationRuleId, workspaceId },
      select: { id: true },
    })
    if (!segment) return 'Segment not found in this workspace'
  }

  return null
}
