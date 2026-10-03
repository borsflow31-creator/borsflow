/**
 * Email Campaign Service
 * 
 * Manages email campaigns including creation, scheduling,
 * execution, and performance tracking.
 */

import { prisma } from '@/lib/prisma'
import { renderMergeTags, ensureUnsubscribeFooter } from '@/lib/email/render'
import { filterSendable } from '@/lib/email/suppression'

// Forms send '' for "none"; Prisma needs null for an empty optional relation.
const idOrNull = (v: string | null | undefined) => (v ? v : null)
// Accepts a Date, an ISO/datetime-local string, or empty; invalid input becomes null.
const toDateOrNull = (v: unknown): Date | null => {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(String(v))
  return isNaN(d.getTime()) ? null : d
}
// Callers may pass arrays/objects or already-serialized JSON; store JSON once.
const toJson = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v))

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function buildTrackingPixel(trackingId: string): string {
  return `<img src="${APP_URL}/api/email-tracking/open/${trackingId}" width="1" height="1" style="display:none;" alt="" />`
}

function wrapLinksWithTracking(html: string, trackingId: string): string {
  // Replace <a href="..."> with click-tracking redirect, skipping unsubscribe links
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


// Campaign data structure
export interface CampaignData {
  name: string
  description?: string
  type: 'broadcast' | 'drip' | 'triggered' | 'behavioral' | 'transactional'
  workspaceId: string
  templateId?: string
  subject: string
  fromName?: string
  fromEmail?: string
  replyTo?: string
  segmentationRuleId?: string
  scheduledAt?: Date
  tags?: string[]
  metadata?: Record<string, any>
  createdById: string
}

// Campaign statistics structure
export interface CampaignStatistics {
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  bouncedCount: number
  unsubscribedCount: number
  openRate: number
  clickRate: number
  bounceRate: number
  unsubscribeRate: number
  deliveryRate: number
}

/**
 * Email Campaign Service Class
 * 
 * Manages email campaigns including creation, scheduling,
 * execution, and performance tracking.
 */
export class EmailCampaignService {
  /**
   * Create a new campaign
   */
  async createCampaign(data: CampaignData): Promise<any> {
    const scheduledAt = toDateOrNull(data.scheduledAt)
    const campaign = await prisma.emailCampaign.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        workspaceId: data.workspaceId,
        templateId: idOrNull(data.templateId),
        subject: data.subject,
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        replyTo: data.replyTo,
        segmentationRuleId: idOrNull(data.segmentationRuleId),
        scheduledAt,
        tags: data.tags ? toJson(data.tags) : undefined,
        metadata: data.metadata ? toJson(data.metadata) : undefined,
        createdById: data.createdById,
        // A future send time makes it scheduled; the scheduled-campaigns cron sends it
        status: scheduledAt && scheduledAt > new Date() ? 'scheduled' : 'draft'
      }
    })

    return campaign
  }

  /**
   * Update a campaign
   */
  async updateCampaign(
    campaignId: string,
    data: Partial<CampaignData> & { updatedBy: string }
  ): Promise<any> {
    const updateData: any = {
      updatedBy: data.updatedBy
    }

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.type !== undefined) updateData.type = data.type
    if (data.templateId !== undefined) updateData.templateId = idOrNull(data.templateId)
    if (data.subject !== undefined) updateData.subject = data.subject
    if (data.fromName !== undefined) updateData.fromName = data.fromName
    if (data.fromEmail !== undefined) updateData.fromEmail = data.fromEmail
    if (data.replyTo !== undefined) updateData.replyTo = data.replyTo
    if (data.segmentationRuleId !== undefined) updateData.segmentationRuleId = idOrNull(data.segmentationRuleId)
    if (data.tags !== undefined) updateData.tags = toJson(data.tags)
    if (data.metadata !== undefined) updateData.metadata = toJson(data.metadata)
    if (data.scheduledAt !== undefined) {
      const scheduledAt = toDateOrNull(data.scheduledAt)
      updateData.scheduledAt = scheduledAt
      // Keep status in step with the schedule, but never touch a campaign that
      // is already sending or sent.
      const current = await prisma.emailCampaign.findUnique({ where: { id: campaignId }, select: { status: true } })
      if (current && (current.status === 'draft' || current.status === 'scheduled')) {
        updateData.status = scheduledAt && scheduledAt > new Date() ? 'scheduled' : 'draft'
      }
    }

    const campaign = await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: updateData
    })

    return campaign
  }

  /**
   * Why this campaign can't be sent right now, or null when it can. Checked
   * before queuing so a send fails loudly instead of marking the campaign "sent"
   * while every email fails later in the queue.
   */
  async getSendBlocker(campaign: { workspaceId: string; templateId?: string | null }): Promise<string | null> {
    if (!campaign.templateId) return 'Choose a template before sending this campaign'
    const providers = await prisma.emailProvider.count({ where: { workspaceId: campaign.workspaceId, isActive: true } })
    if (providers === 0) return 'Connect an active email provider in the Providers tab before sending'
    return null
  }

  /**
   * Send every scheduled campaign whose time has come. Each one is claimed
   * atomically (scheduled -> sending) so overlapping cron ticks can't send twice.
   */
  async processDueScheduledCampaigns(): Promise<{ sent: number; failed: number; skipped: number }> {
    const due = await prisma.emailCampaign.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: new Date() } },
      select: { id: true, workspaceId: true, templateId: true },
      take: 20,
    })
    let sent = 0, failed = 0, skipped = 0
    for (const c of due) {
      const blocker = await this.getSendBlocker(c)
      if (blocker) {
        // Back to draft rather than retrying every minute; sending it by hand
        // shows the user the reason.
        console.warn('[scheduled-campaigns] not sent', c.id, blocker)
        await prisma.emailCampaign.updateMany({
          where: { id: c.id, status: 'scheduled' },
          data: { status: 'draft' },
        })
        skipped++
        continue
      }
      const claimed = await prisma.emailCampaign.updateMany({
        where: { id: c.id, status: 'scheduled' },
        data: { status: 'sending' },
      })
      if (claimed.count === 0) continue
      try {
        await this.executeCampaign(c.id)
        sent++
      } catch (err) {
        console.error('[scheduled-campaigns] failed to send', c.id, err)
        failed++
      }
    }
    return { sent, failed, skipped }
  }

  /**
   * Delete a campaign
   */
  async deleteCampaign(campaignId: string): Promise<boolean> {
    const result = await prisma.emailCampaign.delete({
      where: { id: campaignId }
    })

    return !!result
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(campaignId: string): Promise<any | null> {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
        segmentationRule: true
      }
    })

    return campaign
  }

  /**
   * Get all campaigns for workspace
   */
  async getCampaigns(
    workspaceId: string,
    filters?: {
      status?: string
      type?: string
      limit?: number
      offset?: number
    }
  ): Promise<any[]> {
    const whereClause: any = { workspaceId }

    if (filters?.status) {
      whereClause.status = filters.status
    }

    if (filters?.type) {
      whereClause.type = filters.type
    }

    const campaigns = await prisma.emailCampaign.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
      skip: filters?.offset || 0,
      include: {
        template: true,
        segmentationRule: true
      }
    })

    return campaigns
  }

  /**
   * Schedule a campaign for sending
   */
  async scheduleCampaign(campaignId: string, scheduledAt: Date): Promise<any> {
    const campaign = await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'scheduled',
        scheduledAt
      }
    })

    return campaign
  }

  /**
   * Execute a campaign
   */
  async executeCampaign(campaignId: string): Promise<void> {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
        segmentationRule: true
      }
    })

    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`)
    }

    // Update campaign status
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'sending',
        startedAt: new Date()
      }
    })

    try {
      // Segment membership is only stored when rules change; recompute it so
      // leads added since then are included.
      if (campaign.segmentationRuleId) {
        const { emailSegmentationService } = await import('./email-segmentation')
        await emailSegmentationService.calculateSegmentSize(campaign.segmentationRuleId)
      }

      // Get recipients
      const allRecipients = await this.getCampaignRecipients(campaign)

      // Drop unsubscribed and suppressed addresses before building anything for them
      const sendable = await filterSendable(allRecipients.map(r => r.email), campaign.workspaceId)
      const recipients = allRecipients.filter(r => sendable.has(r.email))
      const skipped = allRecipients.length - recipients.length
      if (skipped > 0) {
        console.log(`Campaign ${campaignId}: skipped ${skipped} suppressed/unsubscribed recipient(s)`)
      }

      const workspace = await prisma.workspace.findUnique({
        where: { id: campaign.workspaceId },
        select: { name: true }
      })

      // Update total recipients count
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: {
          totalRecipients: recipients.length
        }
      })

      // Create emails for each recipient
      const { emailQueueService } = await import('./email-queue')

      for (const recipient of recipients) {
        const mergeContext = {
          lead: recipient.lead,
          recipientEmail: recipient.email,
          workspaceId: campaign.workspaceId,
          workspaceName: workspace?.name ?? null
        }

        // Substitute merge tags before wrapping links, so URLs a tag injected
        // are click-tracked too.
        const trackingId = this.generateTrackingId()
        const subject = renderMergeTags(campaign.subject, mergeContext, 'text')
        const baseHtml = renderMergeTags(campaign.template?.htmlContent || '', mergeContext)
        let htmlWithTracking = wrapLinksWithTracking(baseHtml, trackingId)
        htmlWithTracking = ensureUnsubscribeFooter(htmlWithTracking, recipient.email, campaign.workspaceId)
        htmlWithTracking += buildTrackingPixel(trackingId)

        const textContent = campaign.template?.textContent
          ? renderMergeTags(campaign.template.textContent, mergeContext, 'text')
          : undefined

        // Create email record
        const email = await prisma.email.create({
          data: {
            campaignId: campaign.id,
            workspaceId: campaign.workspaceId,
            subject,
            fromName: campaign.fromName || undefined,
            fromEmail: campaign.fromEmail || undefined,
            replyTo: campaign.replyTo || undefined,
            htmlContent: htmlWithTracking,
            textContent,
            status: 'pending'
          }
        })

        // Create email recipient record
        await prisma.emailRecipient.create({
          data: {
            emailId: email.id,
            leadId: recipient.leadId,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            status: 'pending'
          }
        })

        // Create email tracking record (use the trackingId already generated above)
        await prisma.emailTracking.create({
          data: {
            emailId: email.id,
            trackingId,
            openCount: 0,
            clickCount: 0
          }
        })

        // Add to queue
        await emailQueueService.enqueue(email.id, {
          priority: 5,
          scheduledFor: new Date()
        })
      }

      // Update campaign status to sent
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'sent',
          completedAt: new Date()
        }
      })

      console.log(`Campaign ${campaignId} executed successfully with ${recipients.length} recipients`)
    } catch (error) {
      // Update campaign status to failed
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'cancelled'
        }
      })

      throw error
    }
  }

  /**
   * Get campaign recipients
   */
  private async getCampaignRecipients(
    campaign: any
  ): Promise<Array<{ leadId: string; email: string; name: string; lead: any }>> {
    if (campaign.segmentationRuleId) {
      // Get leads from segment. The pipeline is included so {{pipeline_name}}
      // resolves; addresses are filtered here because segment membership does
      // not require an email.
      const segmentMembers = await prisma.segmentMember.findMany({
        where: {
          segmentationRuleId: campaign.segmentationRuleId,
          lead: { email: { not: null } }
        },
        include: {
          lead: { include: { pipeline: true } }
        }
      })

      return segmentMembers.map((member: any) => ({
        leadId: member.leadId,
        email: member.lead.email || '',
        name: `${member.lead.firstName} ${member.lead.lastName}`.trim(),
        lead: member.lead
      }))
    } else {
      // Get all leads from workspace
      const leads = await prisma.lead.findMany({
        where: {
          pipeline: {
            workspaceId: campaign.workspaceId
          },
          email: { not: null }
        },
        include: { pipeline: true }
      })

      return leads.map((lead: any) => ({
        leadId: lead.id,
        email: lead.email || '',
        name: `${lead.firstName} ${lead.lastName}`.trim(),
        lead
      }))
    }
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignId: string): Promise<any> {
    const campaign = await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'paused'
      }
    })

    return campaign
  }

  /**
   * Resume a paused campaign
   */
  async resumeCampaign(campaignId: string): Promise<any> {
    const campaign = await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'scheduled'
      }
    })

    return campaign
  }

  /**
   * Cancel a campaign
   */
  async cancelCampaign(campaignId: string): Promise<any> {
    const campaign = await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'cancelled'
      }
    })

    return campaign
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStatistics(campaignId: string): Promise<CampaignStatistics> {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId }
    })

    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`)
    }

    const totalRecipients = campaign.totalRecipients
    const sentCount = campaign.sentCount
    const deliveredCount = campaign.deliveredCount
    const openedCount = campaign.openedCount
    const clickedCount = campaign.clickedCount
    const bouncedCount = campaign.bouncedCount
    const unsubscribedCount = campaign.unsubscribedCount

    const deliveryRate = sentCount > 0 ? (deliveredCount / sentCount) * 100 : 0
    const openRate = deliveredCount > 0 ? (openedCount / deliveredCount) * 100 : 0
    const clickRate = deliveredCount > 0 ? (clickedCount / deliveredCount) * 100 : 0
    const bounceRate = sentCount > 0 ? (bouncedCount / sentCount) * 100 : 0
    const unsubscribeRate = sentCount > 0 ? (unsubscribedCount / sentCount) * 100 : 0

    return {
      totalRecipients,
      sentCount,
      deliveredCount,
      openedCount,
      clickedCount,
      bouncedCount,
      unsubscribedCount,
      openRate,
      clickRate,
      bounceRate,
      unsubscribeRate,
      deliveryRate
    }
  }

  /**
   * Generate tracking ID
   */
  private generateTrackingId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * Get campaign summary
   */
  async getCampaignSummary(workspaceId: string): Promise<any> {
    const campaigns = await prisma.emailCampaign.findMany({
      where: { workspaceId }
    })

    const total = campaigns.length
    const byStatus: Record<string, number> = {}
    const byType: Record<string, number> = {}

    for (const campaign of campaigns) {
      if (!byStatus[campaign.status]) {
        byStatus[campaign.status] = 0
      }
      byStatus[campaign.status]++

      if (!byType[campaign.type]) {
        byType[campaign.type] = 0
      }
      byType[campaign.type]++
    }

    return {
      total,
      byStatus,
      byType
    }
  }

  /**
   * Get recent campaigns
   */
  async getRecentCampaigns(
    workspaceId: string,
    limit: number = 10
  ): Promise<any[]> {
    const campaigns = await prisma.emailCampaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        template: true,
        segmentationRule: true
      }
    })

    return campaigns
  }

  /**
   * Get active campaigns
   */
  async getActiveCampaigns(workspaceId: string): Promise<any[]> {
    const campaigns = await prisma.emailCampaign.findMany({
      where: {
        workspaceId,
        status: {
          in: ['scheduled', 'sending', 'paused']
        }
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        template: true,
        segmentationRule: true
      }
    })

    return campaigns
  }

  /**
   * Get completed campaigns
   */
  async getCompletedCampaigns(
    workspaceId: string,
    limit: number = 20
  ): Promise<any[]> {
    const campaigns = await prisma.emailCampaign.findMany({
      where: {
        workspaceId,
        status: 'sent'
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: {
        template: true,
        segmentationRule: true
      }
    })

    return campaigns
  }
}

// Export singleton instance
export const emailCampaignService = new EmailCampaignService()
