/**
 * Automation Engine
 *
 * Connects CRM pipeline stage changes to email sequences. The EmailAutomation /
 * AutomationTrigger / AutomationStep tables have existed in the schema since the
 * beginning with nothing reading them; this is the runtime.
 *
 * Flow:
 *   PUT /api/leads/[id] (and the interest/mandate equivalents) detects a stage change
 *     -> exitEnrollments()      ends sequences the subject just left
 *     -> dispatchStageChanged() enrolls the subject in matching automations
 *   cron /api/cron/process-automations
 *     -> processDueEnrollments() materializes one step per due enrollment
 *   cron /api/cron/process-email-queue
 *     -> sends what was enqueued
 *
 * Steps are advanced one at a time rather than enqueued upfront so each send
 * re-reads the subject: merge data stays fresh and sendCondition is evaluated
 * against current state.
 *
 * Enrollments are keyed on (automationId, subjectType, subjectId), not on the
 * lead. Real-estate state is per (lead x property): a buyer with interests in
 * two properties must sit in a viewing-follow-up sequence twice, once per
 * interest, progressing independently. Keyed on the lead that was impossible.
 */

import { prisma } from '@/lib/prisma'
import { renderMergeTags, ensureUnsubscribeFooter } from '@/lib/email/render'
import { isSendable } from '@/lib/email/suppression'
import { matchesCriteria, parseJson as parseJsonColumn, type Criteria } from '@/lib/crm/criteria'
import { asSubjectType, isAutomatable, type SubjectType } from '@/lib/crm/subjects'
import { loaderFor, type SubjectRecipient } from '@/lib/crm/subject-registry'

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
  subjectType: SubjectType
  subjectId: string
  pipelineId: string
  workspaceId: string
  fromStage: string
  toStage: string
}

/** Conditions stored on an AutomationTrigger of type 'lead_created'. */
export interface CreatedConditions {
  /** Only subjects created on this board. */
  pipelineId?: string
  /** Optional extra filter, in the same shape the segment builder produces. */
  criteria?: Criteria[]
}

export interface SubjectCreatedEvent {
  subjectType: SubjectType
  subjectId: string
  /** The board the subject landed on, when it sits on one. */
  pipelineId: string | null
  workspaceId: string
}

/** Conditions stored on an AutomationTrigger of type 'mandate_expiring'. */
export interface MandateExpiringConditions {
  /** Enroll a mandate once its end date is this many days away or fewer. */
  withinDays: number
}

const parseJson = parseJsonColumn

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
   * Enroll a subject in every active automation whose stage_changed trigger
   * matches.
   *
   * Called fire-and-forget from the board routes: a failure here must never fail
   * the user's drag-and-drop.
   */
  async dispatchStageChanged(event: StageChangeEvent): Promise<number> {
    if (!isAutomatable(event.subjectType)) return 0

    const found = await loaderFor(event.subjectType).loadOne(event.subjectId)
    if (!found) return 0

    // No reachable contact, nothing to send. Don't create an enrollment that can
    // only fail.
    const recipient = loaderFor(event.subjectType).recipient(found.row)
    if (!recipient?.email || !recipient.leadId) return 0

    const triggers = await prisma.automationTrigger.findMany({
      where: {
        type: 'stage_changed',
        isActive: true,
        automation: {
          status: 'active',
          workspaceId: event.workspaceId,
          // A lead automation must not fire on an interest's stage change, even
          // though both carry a stage and both live on a pipeline.
          subjectType: event.subjectType,
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

      // An automation with no steps would enroll subjects into nothing.
      if (trigger.automation.steps.length === 0) continue

      const automationId = trigger.automationId
      // Step 1's "delay after the stage change" applies from enrollment
      const firstStepAt = new Date(Date.now() + Math.max(0, trigger.automation.steps[0].delayMinutes || 0) * 60_000)

      const triggerContext = JSON.stringify({
        triggerId: trigger.id,
        pipelineId: event.pipelineId,
        fromStage: event.fromStage,
        toStage: event.toStage,
      })

      // Enroll, or revive a finished enrollment, without ever reading first.
      //
      // This used to be findUnique -> decide -> upsert. Two concurrent stage
      // changes could both read "not active" and both increment activeEnrolled,
      // so the counter drifted above the number of live enrollments. Each
      // statement below is atomic and its `count` *is* the decision, so there is
      // no window between deciding and writing.
      const created = await prisma.automationEnrollment.createMany({
        data: [{
          automationId,
          subjectType: event.subjectType,
          subjectId: event.subjectId,
          leadId: recipient.leadId,
          workspaceId: event.workspaceId,
          status: 'active',
          currentStepOrder: 0,
          nextStepAt: firstStepAt,
          triggerContext,
        }],
        skipDuplicates: true,
      })

      if (created.count === 1) {
        await this.bumpCounters(automationId, { total: 1, active: 1 })
      } else {
        // Re-entry restarts a completed or exited sequence from the top. The
        // status filter is the lock: a row already mid-sequence is left alone.
        const revived = await prisma.automationEnrollment.updateMany({
          where: {
            automationId,
            subjectType: event.subjectType,
            subjectId: event.subjectId,
            status: { not: 'active' },
          },
          data: {
            status: 'active',
            currentStepOrder: 0,
            nextStepAt: firstStepAt,
            triggerContext,
            completedAt: null,
            exitedAt: null,
            exitReason: null,
          },
        })

        if (revived.count === 0) continue
        await this.bumpCounters(automationId, { total: 0, active: 1 })
      }

      enrolled++
    }

    return enrolled
  }

  /**
   * Enroll a newly created subject in every active automation with a matching
   * `lead_created` trigger.
   *
   * The trigger type keeps its original name: it was already in the allowed-values
   * list and the builder's copy, and nothing can depend on it having done anything
   * before, because no dispatch existed. `automation.subjectType` says what is being
   * created, so a `lead_created` trigger on an interest-subject automation fires
   * when an interest is created -- no new trigger type, no migration.
   *
   * An enrollment made here carries no `toStage`, so it ends only on explicit
   * exitCriteria or on completion. That is intended: a welcome sequence should not
   * be cut short because the contact moved column.
   *
   * Creation happens once, so unlike a stage change there is no re-entry: an
   * existing enrollment is simply left alone.
   */
  async dispatchCreated(event: SubjectCreatedEvent): Promise<number> {
    if (!isAutomatable(event.subjectType)) return 0

    const loader = loaderFor(event.subjectType)
    const found = await loader.loadOne(event.subjectId)
    if (!found) return 0
    const recipient = loader.recipient(found.row)
    if (!recipient?.email || !recipient.leadId) return 0

    const triggers = await prisma.automationTrigger.findMany({
      where: {
        type: 'lead_created',
        isActive: true,
        automation: { status: 'active', workspaceId: event.workspaceId, subjectType: event.subjectType },
      },
      include: { automation: { select: { id: true, steps: { select: { id: true, delayMinutes: true }, orderBy: { order: 'asc' } } } } },
    })

    let enrolled = 0
    for (const trigger of triggers) {
      const conditions = parseJson<CreatedConditions>(trigger.conditions, {})
      if (conditions.pipelineId && conditions.pipelineId !== event.pipelineId) continue
      if (conditions.criteria?.length && !matchesCriteria(found.row, conditions.criteria, 'AND')) continue
      if (trigger.automation.steps.length === 0) continue

      const firstStepAt = new Date(Date.now() + Math.max(0, trigger.automation.steps[0].delayMinutes || 0) * 60_000)
      const created = await prisma.automationEnrollment.createMany({
        data: [{
          automationId: trigger.automationId,
          subjectType: event.subjectType,
          subjectId: event.subjectId,
          leadId: recipient.leadId,
          workspaceId: event.workspaceId,
          status: 'active',
          currentStepOrder: 0,
          nextStepAt: firstStepAt,
          triggerContext: JSON.stringify({ triggerId: trigger.id, event: 'created', pipelineId: event.pipelineId }),
        }],
        skipDuplicates: true,
      })
      if (created.count === 1) {
        await this.bumpCounters(trigger.automationId, { total: 1, active: 1 })
        enrolled++
      }
    }
    return enrolled
  }

  /**
   * Enroll every active mandate that is within its trigger's window of ending.
   * Run by the mandate-expiry cron, because "20 days before it ends" is a moment in
   * time, not an event anything emits.
   *
   * An enrollment records the end date it was made for. A mandate that is renewed
   * and later approaches a *new* end date runs the sequence again; the same end
   * date never does, which is what stops a finished sequence being revived on every
   * cron tick.
   */
  async dispatchMandateExpiring(now = new Date()): Promise<number> {
    const triggers = await prisma.automationTrigger.findMany({
      where: {
        type: 'mandate_expiring',
        isActive: true,
        automation: { status: 'active', subjectType: 'Mandate' },
      },
      include: { automation: { select: { id: true, workspaceId: true, steps: { select: { id: true, delayMinutes: true }, orderBy: { order: 'asc' } } } } },
    })

    let enrolled = 0
    for (const trigger of triggers) {
      if (trigger.automation.steps.length === 0) continue
      const { withinDays } = parseJson<MandateExpiringConditions>(trigger.conditions, { withinDays: 30 })
      const horizon = new Date(now.getTime() + Math.max(1, withinDays || 30) * 86_400_000)

      const mandates = await prisma.mandate.findMany({
        where: {
          workspaceId: trigger.automation.workspaceId,
          status: 'active',
          endDate: { not: null, gt: now, lte: horizon },
        },
        select: { id: true, leadId: true, endDate: true, lead: { select: { email: true } } },
      })

      for (const mandate of mandates) {
        if (!mandate.lead.email || !mandate.endDate) continue
        const term = mandate.endDate.toISOString()
        const automationId = trigger.automationId
        const firstStepAt = new Date(now.getTime() + Math.max(0, trigger.automation.steps[0].delayMinutes || 0) * 60_000)
        const triggerContext = JSON.stringify({ triggerId: trigger.id, event: 'mandate_expiring', endDate: term })

        const created = await prisma.automationEnrollment.createMany({
          data: [{
            automationId, subjectType: 'Mandate', subjectId: mandate.id, leadId: mandate.leadId,
            workspaceId: trigger.automation.workspaceId, status: 'active', currentStepOrder: 0,
            nextStepAt: firstStepAt, triggerContext,
          }],
          skipDuplicates: true,
        })
        if (created.count === 1) {
          await this.bumpCounters(automationId, { total: 1, active: 1 })
          enrolled++
          continue
        }

        // Already enrolled once. Run again only for a new term, and only if the
        // earlier run is over.
        const existing = await prisma.automationEnrollment.findUnique({
          where: { automationId_subjectType_subjectId: { automationId, subjectType: 'Mandate', subjectId: mandate.id } },
          select: { status: true, triggerContext: true },
        })
        if (!existing || existing.status === 'active') continue
        if (parseJson<{ endDate?: string }>(existing.triggerContext, {}).endDate === term) continue

        const revived = await prisma.automationEnrollment.updateMany({
          where: { automationId, subjectType: 'Mandate', subjectId: mandate.id, status: { not: 'active' } },
          data: {
            status: 'active', currentStepOrder: 0, nextStepAt: firstStepAt, triggerContext,
            completedAt: null, exitedAt: null, exitReason: null,
          },
        })
        if (revived.count === 1) {
          await this.bumpCounters(automationId, { total: 0, active: 1 })
          enrolled++
        }
      }
    }
    return enrolled
  }

  /** Keep EmailAutomation's cached counters in step with the enrollment rows. */
  private async bumpCounters(
    automationId: string,
    delta: { total: number; active: number }
  ): Promise<void> {
    await prisma.emailAutomation.update({
      where: { id: automationId },
      data: {
        totalEnrolled: { increment: delta.total },
        activeEnrolled: { increment: delta.active },
      },
    })
  }

  /**
   * End active enrollments for a subject that has moved on, and cancel any step
   * already sitting in the queue.
   *
   * Default policy: an enrollment ends when the subject leaves the stage that
   * created it. An automation can override that with exitCriteria, evaluated
   * against the subject — when the criteria match, the enrollment exits.
   *
   * An enrollment created by something other than a stage change has no toStage
   * in its context, so it falls through the default and exits only on explicit
   * exitCriteria or on completion. That is intended: a welcome sequence should
   * not abort because the contact moved column.
   */
  async exitEnrollments(subjectType: SubjectType, subjectId: string, reason: string): Promise<number> {
    const enrollments = await prisma.automationEnrollment.findMany({
      where: { subjectType, subjectId, status: 'active' },
      include: { automation: { select: { id: true, exitCriteria: true } } },
    })

    if (enrollments.length === 0) return 0

    const found = await loaderFor(subjectType).loadOne(subjectId)
    if (!found) return 0

    let exited = 0

    for (const enrollment of enrollments) {
      const context = parseJson<{ toStage?: string }>(enrollment.triggerContext, {})
      const exitCriteria = parseJson<Criteria[]>(enrollment.automation.exitCriteria, [])

      const shouldExit = exitCriteria.length > 0
        ? matchesCriteria(found.row, exitCriteria, 'AND')
        // Default: the subject is no longer in the stage that enrolled it.
        : !!context.toStage && found.row.stage !== context.toStage

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

    // Re-read the subject on every step so merge data is current and
    // sendCondition is evaluated against the state the recipient is in now.
    const subjectType = asSubjectType(enrollment.subjectType)
    const found = await loaderFor(subjectType).loadOne(enrollment.subjectId)

    if (!found) {
      // The subject is gone. The purge triggers normally remove the enrollment
      // with it, so this is the window between a delete and that sweep.
      await this.closeEnrollment(enrollmentId, enrollment.automationId, 'exited', 'subject_missing')
      return false
    }

    const recipient = loaderFor(subjectType).recipient(found.row)

    if (!recipient?.email) {
      await this.closeEnrollment(enrollmentId, enrollment.automationId, 'exited', 'no_email')
      return false
    }

    if (!(await isSendable(recipient.email, enrollment.workspaceId))) {
      await this.closeEnrollment(enrollmentId, enrollment.automationId, 'exited', 'suppressed')
      return false
    }

    // sendCondition skips this step without ending the sequence.
    const sendCondition = parseJson<Criteria[]>(step.sendCondition, [])
    const conditionMet = sendCondition.length === 0
      || matchesCriteria(found.row, sendCondition, 'AND')

    if (conditionMet && step.template) {
      await this.materializeStepEmail({
        enrollmentId,
        step,
        subjectType,
        row: found.row,
        recipient,
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
    subjectType: SubjectType
    row: any
    recipient: SubjectRecipient
    workspaceId: string
  }): Promise<void> {
    const { enrollmentId, step, subjectType, row, recipient, workspaceId } = params
    const recipientEmail = recipient.email

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, currency: true },
    })

    const mergeContext = {
      // Each subject contributes its own merge-tag namespaces.
      ...loaderFor(subjectType).mergeContext(row),
      recipientEmail,
      workspaceId,
      workspaceName: workspace?.name ?? null,
      currency: workspace?.currency ?? null,
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
        // The contact, not the subject: an interest's mail is addressed to its
        // buyer, and that is who an unsubscribe or a bounce belongs to.
        leadId: recipient.leadId,
        recipientEmail,
        recipientName: recipient.name || null,
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
