/**
 * Automation Engine
 *
 * Connects CRM pipeline stage changes to email sequences. The EmailAutomation /
 * AutomationTrigger / AutomationStep tables have existed in the schema since the
 * beginning with nothing reading them; this is the runtime.
 *
 * Flow:
 *   PUT /api/leads/[id] detects a stage change
 *     -> exitEnrollments()      ends sequences the lead just left
 *     -> dispatchStageChanged() enrolls the lead in matching automations
 *   cron /api/cron/process-automations
 *     -> processDueEnrollments() materializes one step per due enrollment
 *   cron /api/cron/process-email-queue
 *     -> sends what was enqueued
 *
 * Steps are advanced one at a time rather than enqueued upfront so each send
 * re-reads the lead: merge data stays fresh and sendCondition is evaluated
 * against current state.
 */

import { prisma } from '@/lib/prisma'
import { renderMergeTags, ensureUnsubscribeFooter } from '@/lib/email/render'
import { isSendable } from '@/lib/email/suppression'
import { emailSegmentationService, type Criteria } from '@/lib/email-segmentation'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/** Conditions stored on an AutomationTrigger of type 'stage_changed'. */
export interface StageChangedConditions {
  /** Required — the stage the lead must be entering. */
  toStage: string
  /** Optional filter: only this pipeline. */
  pipelineId?: string
  /** Optional filter: only when coming from this stage. */
  fromStage?: string
}

export interface StageChangeEvent {
  leadId: string
  pipelineId: string
  workspaceId: string
  fromStage: string
  toStage: string
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    return (parsed ?? fallback) as T
  } catch {
    return fallback
  }
}

function buildTrackingPixel(trackingId: string): string {
  return `<img src="${APP_URL}/api/email-tracking/open/${trackingId}" width="1" height="1" style="display:none;" alt="" />`
}

function wrapLinksWithTracking(html: string, trackingId: string): string {
  return html.replace(
    /<a\s([^>]*?)href="([^"]+)"([^>]*?)>/gi,
    (match, before, url, after) => {
      if (url.includes('/email-tracking/unsubscribe') || url.startsWith('mailto:') || url.startsWith('#')) {
        return match
      }
      const trackUrl = `${APP_URL}/api/email-tracking/click/${trackingId}?url=${encodeURIComponent(url)}`
      return `<a ${before}href="${trackUrl}"${after}>`
    }
  )
}


export class AutomationEngine {
  private generateTrackingId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * Enroll a lead in every active automation whose stage_changed trigger matches.
   *
   * Called fire-and-forget from the leads route: a failure here must never fail
   * the user's drag-and-drop.
   */
  async dispatchStageChanged(event: StageChangeEvent): Promise<number> {
    const lead = await prisma.lead.findUnique({
      where: { id: event.leadId },
      select: { id: true, email: true },
    })

    // No address, nothing to send. Don't create an enrollment that can only fail.
    if (!lead?.email) return 0

    const triggers = await prisma.automationTrigger.findMany({
      where: {
        type: 'stage_changed',
        isActive: true,
        automation: {
          status: 'active',
          workspaceId: event.workspaceId,
        },
      },
      include: { automation: { select: { id: true, steps: { select: { id: true, delayMinutes: true }, orderBy: { order: 'asc' } } } } },
    })

    let enrolled = 0

    for (const trigger of triggers) {
      const conditions = parseJson<StageChangedConditions | null>(trigger.conditions, null)
      if (!conditions?.toStage) continue
      if (conditions.toStage !== event.toStage) continue
      if (conditions.pipelineId && conditions.pipelineId !== event.pipelineId) continue
      if (conditions.fromStage && conditions.fromStage !== event.fromStage) continue

      // An automation with no steps would enroll leads into nothing.
      if (trigger.automation.steps.length === 0) continue

      const automationId = trigger.automationId
      // Step 1's "delay after the stage change" applies from enrollment
      const firstStepAt = new Date(Date.now() + Math.max(0, trigger.automation.steps[0].delayMinutes || 0) * 60_000)

      const existing = await prisma.automationEnrollment.findUnique({
        where: { automationId_leadId: { automationId, leadId: event.leadId } },
        select: { id: true, status: true },
      })

      // Already mid-sequence: leave it alone rather than restarting.
      if (existing?.status === 'active') continue

      const triggerContext = JSON.stringify({
        triggerId: trigger.id,
        pipelineId: event.pipelineId,
        fromStage: event.fromStage,
        toStage: event.toStage,
      })

      await prisma.automationEnrollment.upsert({
        where: { automationId_leadId: { automationId, leadId: event.leadId } },
        create: {
          automationId,
          leadId: event.leadId,
          workspaceId: event.workspaceId,
          status: 'active',
          currentStepOrder: 0,
          nextStepAt: firstStepAt,
          triggerContext,
        },
        // Re-entry restarts a completed or exited sequence from the top.
        update: {
          status: 'active',
          currentStepOrder: 0,
          nextStepAt: firstStepAt,
          triggerContext,
          completedAt: null,
          exitedAt: null,
          exitReason: null,
        },
      })

      await prisma.emailAutomation.update({
        where: { id: automationId },
        data: {
          totalEnrolled: { increment: existing ? 0 : 1 },
          activeEnrolled: { increment: 1 },
        },
      })

      enrolled++
    }

    return enrolled
  }

  /**
   * End active enrollments for a lead that has moved on, and cancel any step
   * already sitting in the queue.
   *
   * Default policy: an enrollment ends when the lead leaves the stage that
   * created it. An automation can override that with exitCriteria, evaluated
   * against the lead — when the criteria match, the enrollment exits.
   */
  async exitEnrollments(leadId: string, reason: string): Promise<number> {
    const enrollments = await prisma.automationEnrollment.findMany({
      where: { leadId, status: 'active' },
      include: { automation: { select: { id: true, exitCriteria: true } } },
    })

    if (enrollments.length === 0) return 0

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { pipeline: true },
    })
    if (!lead) return 0

    let exited = 0

    for (const enrollment of enrollments) {
      const context = parseJson<{ toStage?: string }>(enrollment.triggerContext, {})
      const exitCriteria = parseJson<Criteria[]>(enrollment.automation.exitCriteria, [])

      const shouldExit = exitCriteria.length > 0
        ? emailSegmentationService.matchesCriteria(lead, exitCriteria, 'AND')
        // Default: the lead is no longer in the stage that enrolled it.
        : !!context.toStage && lead.stage !== context.toStage

      if (!shouldExit) continue

      await this.closeEnrollment(enrollment.id, enrollment.automationId, 'exited', reason)
      exited++
    }

    return exited
  }

  /** Cancel still-pending queue items belonging to an enrollment, then close it. */
  private async closeEnrollment(
    enrollmentId: string,
    automationId: string,
    status: 'exited' | 'completed',
    reason?: string
  ): Promise<void> {
    // Only a lead that *leaves* the sequence has its unsent mail withdrawn.
    //
    // Completion is reached right after the last step's email is queued
    // (scheduleNextStep finds no further step), so cancelling here on 'completed'
    // withdrew that final email before it could send: every automation dropped
    // its last message, and a one-step automation sent nothing at all.
    if (status === 'exited') {
      const pending = await prisma.emailQueue.findMany({
        where: {
          status: 'pending',
          email: { automationEnrollmentId: enrollmentId },
        },
        select: { id: true },
      })

      if (pending.length > 0) {
        await prisma.emailQueue.updateMany({
          where: { id: { in: pending.map(p => p.id) } },
          data: { status: 'cancelled' },
        })
      }
    }

    const now = new Date()

    await prisma.automationEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status,
        nextStepAt: null,
        ...(status === 'exited' ? { exitedAt: now, exitReason: reason } : { completedAt: now }),
      },
    })

    await prisma.emailAutomation.update({
      where: { id: automationId },
      data: {
        activeEnrolled: { decrement: 1 },
        ...(status === 'completed' ? { completedCount: { increment: 1 } } : {}),
      },
    })
  }

  /**
   * Cron body: materialize the next step for every enrollment that is due.
   * Each enrollment is isolated so one bad lead can't stall the batch.
   */
  async processDueEnrollments(limit = 50): Promise<{ processed: number; sent: number; errors: number }> {
    const due = await prisma.automationEnrollment.findMany({
      where: {
        status: 'active',
        nextStepAt: { lte: new Date() },
      },
      orderBy: { nextStepAt: 'asc' },
      take: limit,
      select: { id: true },
    })

    let processed = 0
    let sent = 0
    let errors = 0

    for (const { id } of due) {
      // Claim the enrollment by clearing nextStepAt in a conditional write. The
      // cron fires every minute against a 300s budget, so two invocations can
      // overlap; without this they would both advance the same enrollment and
      // the lead would get the step twice.
      const claim = await prisma.automationEnrollment.updateMany({
        where: { id, status: 'active', nextStepAt: { lte: new Date() } },
        data: { nextStepAt: null },
      })

      if (claim.count === 0) continue

      processed++

      try {
        const didSend = await this.advanceEnrollment(id)
        if (didSend) sent++
      } catch (error) {
        errors++
        console.error(`[automation-engine] enrollment ${id} failed:`, error)

        // Put it back in the queue, but only if it is still active and still
        // unscheduled -- advanceEnrollment may have already moved it on or
        // closed it before throwing.
        await prisma.automationEnrollment
          .updateMany({
            where: { id, status: 'active', nextStepAt: null },
            data: { nextStepAt: new Date() },
          })
          .catch(() => {})
      }
    }

    return { processed, sent, errors }
  }

  /** Runs one step of one enrollment. Returns true when an email was queued. */
  private async advanceEnrollment(enrollmentId: string): Promise<boolean> {
    const enrollment = await prisma.automationEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        automation: {
          include: {
            steps: { orderBy: { order: 'asc' }, include: { template: true } },
          },
        },
        lead: { include: { pipeline: true } },
      },
    })

    if (!enrollment || enrollment.status !== 'active') return false

    // An automation paused after enrollment should stop sending.
    if (enrollment.automation.status !== 'active') {
      await prisma.automationEnrollment.update({
        where: { id: enrollmentId },
        data: { nextStepAt: new Date(Date.now() + 15 * 60_000) },
      })
      return false
    }

    // currentStepOrder is an index into the order-sorted list, not an `order`
    // value — steps may be numbered from 0 or 1 and this stays correct either way.
    const steps = enrollment.automation.steps
    const step = steps[enrollment.currentStepOrder]

    if (!step) {
      await this.closeEnrollment(enrollmentId, enrollment.automationId, 'completed')
      return false
    }

    const lead = enrollment.lead
    const recipientEmail = lead.email || ''

    if (!recipientEmail) {
      await this.closeEnrollment(enrollmentId, enrollment.automationId, 'exited', 'no_email')
      return false
    }

    if (!(await isSendable(recipientEmail, enrollment.workspaceId))) {
      await this.closeEnrollment(enrollmentId, enrollment.automationId, 'exited', 'suppressed')
      return false
    }

    // sendCondition skips this step without ending the sequence.
    const sendCondition = parseJson<Criteria[]>(step.sendCondition, [])
    const conditionMet = sendCondition.length === 0
      || emailSegmentationService.matchesCriteria(lead, sendCondition, 'AND')

    if (conditionMet && step.template) {
      await this.materializeStepEmail({
        enrollmentId,
        step,
        lead,
        recipientEmail,
        workspaceId: enrollment.workspaceId,
      })
    }

    await this.scheduleNextStep(enrollment.id, enrollment.automationId, steps, enrollment.currentStepOrder)

    return conditionMet && !!step.template
  }

  /** Builds Email + EmailRecipient + EmailTracking and queues it, mirroring executeCampaign. */
  private async materializeStepEmail(params: {
    enrollmentId: string
    step: any
    lead: any
    recipientEmail: string
    workspaceId: string
  }): Promise<void> {
    const { enrollmentId, step, lead, recipientEmail, workspaceId } = params

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    })

    const mergeContext = {
      lead,
      recipientEmail,
      workspaceId,
      workspaceName: workspace?.name ?? null,
    }

    const trackingId = this.generateTrackingId()

    // Render merge tags first so tag-injected URLs also get click tracking.
    const subject = renderMergeTags(step.template.subject, mergeContext, 'text')
    let html = renderMergeTags(step.template.htmlContent || '', mergeContext)
    html = wrapLinksWithTracking(html, trackingId)
    html = ensureUnsubscribeFooter(html, recipientEmail, workspaceId)
    html += buildTrackingPixel(trackingId)

    const text = step.template.textContent
      ? renderMergeTags(step.template.textContent, mergeContext, 'text')
      : undefined

    const email = await prisma.email.create({
      data: {
        // No campaignId — this send belongs to an automation, not a campaign.
        automationStepId: step.id,
        automationEnrollmentId: enrollmentId,
        workspaceId,
        subject,
        htmlContent: html,
        textContent: text,
        status: 'pending',
      },
    })

    await prisma.emailRecipient.create({
      data: {
        emailId: email.id,
        leadId: lead.id,
        recipientEmail,
        recipientName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || null,
        status: 'pending',
      },
    })

    await prisma.emailTracking.create({
      data: { emailId: email.id, trackingId, openCount: 0, clickCount: 0 },
    })

    const { emailQueueService } = await import('./email-queue')
    await emailQueueService.enqueue(email.id, { priority: 5, scheduledFor: new Date() })

    await prisma.automationStep.update({
      where: { id: step.id },
      data: { totalSent: { increment: 1 } },
    })
  }

  /**
   * Point the enrollment at the following step, or complete it.
   * `currentIndex` indexes the order-sorted `steps` array.
   */
  private async scheduleNextStep(
    enrollmentId: string,
    automationId: string,
    steps: Array<{ delayMinutes: number }>,
    currentIndex: number
  ): Promise<void> {
    const nextIndex = currentIndex + 1
    const next = steps[nextIndex]

    if (!next) {
      await this.closeEnrollment(enrollmentId, automationId, 'completed')
      return
    }

    await prisma.automationEnrollment.update({
      where: { id: enrollmentId },
      data: {
        currentStepOrder: nextIndex,
        nextStepAt: new Date(Date.now() + Math.max(0, next.delayMinutes) * 60_000),
      },
    })
  }
}

export const automationEngine = new AutomationEngine()
