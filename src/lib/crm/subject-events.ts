import { automationEngine } from '@/lib/automation-engine'
import type { SubjectType } from '@/lib/crm/subjects'

/**
 * Side effects of a subject moving to a new stage, shared by every board route so
 * the sequencing is written once rather than pasted into each.
 *
 * Exit before dispatch, so moving Proposal -> Negotiation ends the Proposal
 * sequence before the Negotiation one starts.
 *
 * Failures are logged and swallowed: a broken automation must never fail the
 * update and make the board roll the card back to its old column. The caller
 * awaits this rather than floating it, because on serverless the function may be
 * frozen once the response is returned and a detached promise would be dropped.
 */
export async function onSubjectStageChanged(event: {
  subjectType: SubjectType
  subjectId: string
  pipelineId: string
  workspaceId: string
  fromStage: string
  toStage: string
}): Promise<void> {
  try {
    await automationEngine.exitEnrollments(event.subjectType, event.subjectId, 'stage_changed')
    await automationEngine.dispatchStageChanged(event)
  } catch (error) {
    console.error('Stage-change hook failed:', error)
  }
}

/**
 * A subject was just created: fire the `lead_created` automations for it.
 *
 * Every creation path calls this -- manual entry, the website form, a portal
 * webhook, an interest attached from the board -- so "a new enquiry starts a
 * sequence" means the same thing wherever the enquiry came from. Same contract as
 * onSubjectStageChanged: awaited by the caller, never throws.
 */
export async function onSubjectCreated(event: {
  subjectType: SubjectType
  subjectId: string
  pipelineId: string | null
  workspaceId: string
}): Promise<void> {
  try {
    await automationEngine.dispatchCreated(event)
  } catch (error) {
    console.error('Creation hook failed:', error)
  }
}
