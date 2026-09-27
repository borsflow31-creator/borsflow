/**
 * Email Tracking Service
 * 
 * Manages email tracking including opens, clicks, bounces,
 * unsubscribes, and suppression list management.
 */

import { prisma } from '@/lib/prisma'
import { buildUnsubscribeUrl } from '@/lib/email/render'

// Tracking event structure
export interface TrackingEvent {
  type: 'open' | 'click' | 'bounce' | 'unsubscribe' | 'complaint'
  emailId: string
  trackingId?: string
  recipientId?: string
  timestamp: Date
  metadata?: Record<string, any>
}

// Open tracking data structure
export interface OpenTrackingData {
  emailId: string
  trackingId: string
  openCount: number
  firstOpenAt: Date | null
  lastOpenAt: Date | null
  ipAddress?: string
  userAgent?: string
  deviceInfo?: Record<string, any>
}

// Click tracking data structure
export interface ClickTrackingData {
  emailId: string
  trackingId: string
  link: string
  clickCount: number
  firstClickAt: Date | null
  lastClickAt: Date | null
  ipAddress?: string
  userAgent?: string
  deviceInfo?: Record<string, any>
}

// Bounce tracking data structure
export interface BounceTrackingData {
  /** Workspace whose mail bounced; the bounce and its suppression apply only there. */
  workspaceId: string
  email: string
  recipientEmail: string
  recipientId?: string
  type: 'hard' | 'soft' | 'spam' | 'blocked'
  subType?: string
  reason?: string
  providerType?: string
  providerMessage?: string
  occurredAt: Date
}

// Unsubscribe tracking data structure
export interface UnsubscribeTrackingData {
  /** Workspace the recipient opted out of; other clients may still email them. */
  workspaceId: string
  email: string
  leadId?: string
  campaignId?: string
  reason?: string
  source: 'link' | 'reply' | 'admin' | 'api'
  unsubscribedAt: Date
}

// Tracking statistics structure
export interface TrackingStatistics {
  totalEmails: number
  totalOpens: number
  totalClicks: number
  totalBounces: number
  totalUnsubscribes: number
  openRate: number
  clickRate: number
  bounceRate: number
  unsubscribeRate: number
  uniqueOpens: number
  uniqueClicks: number
  averageOpensPerEmail: number
  averageClicksPerEmail: number
}

/**
 * Email Tracking Service Class
 * 
 * Manages email tracking including opens, clicks, bounces,
 * unsubscribes, and suppression list management.
 */
export class EmailTrackingService {
  /**
   * Track email open
   */
  async trackOpen(
    trackingId: string,
    metadata?: {
      ipAddress?: string
      userAgent?: string
      deviceInfo?: Record<string, any>
    }
  ): Promise<OpenTrackingData | null> {
    // Find email tracking record
    const tracking = await prisma.emailTracking.findUnique({
      where: { trackingId },
      include: { email: true }
    })

    if (!tracking) {
      console.warn(`Tracking record not found for trackingId: ${trackingId}`)
      return null
    }

    // Update tracking record
    const updatedTracking = await prisma.emailTracking.update({
      where: { id: tracking.id },
      data: {
        openCount: tracking.openCount + 1,
        firstOpenAt: tracking.firstOpenAt || new Date(),
        lastOpenAt: new Date(),
        ipAddress: metadata?.ipAddress || tracking.ipAddress,
        userAgent: metadata?.userAgent || tracking.userAgent,
        deviceInfo: metadata?.deviceInfo ? JSON.stringify(metadata.deviceInfo) : tracking.deviceInfo
      }
    })

    // Update email recipient status
    await prisma.emailRecipient.updateMany({
      where: { emailId: tracking.emailId },
      data: {
        status: 'opened',
        openedAt: new Date()
      }
    })

    // Update campaign statistics
    if (tracking.email.campaignId) {
      await prisma.emailCampaign.update({
        where: { id: tracking.email.campaignId },
        data: {
          openedCount: { increment: 1 }
        }
      })
    }

    return {
      emailId: tracking.emailId,
      trackingId: tracking.trackingId,
      openCount: updatedTracking.openCount,
      firstOpenAt: updatedTracking.firstOpenAt,
      lastOpenAt: updatedTracking.lastOpenAt,
      ipAddress: updatedTracking.ipAddress || undefined,
      userAgent: updatedTracking.userAgent || undefined,
      deviceInfo: updatedTracking.deviceInfo ? JSON.parse(updatedTracking.deviceInfo) : undefined
    }
  }

  /**
   * Track link click
   */
  async trackClick(
    trackingId: string,
    link: string,
    metadata?: {
      ipAddress?: string
      userAgent?: string
      deviceInfo?: Record<string, any>
    }
  ): Promise<ClickTrackingData | null> {
    // Find email tracking record
    const tracking = await prisma.emailTracking.findUnique({
      where: { trackingId },
      include: { email: true }
    })

    if (!tracking) {
      console.warn(`Tracking record not found for trackingId: ${trackingId}`)
      return null
    }

    // Update links tracking
    let links: Record<string, { count: number; firstClick: Date | null; lastClick: Date | null }> = {}
    
    if (tracking.links) {
      links = JSON.parse(tracking.links)
    }

    if (!links[link]) {
      links[link] = { count: 0, firstClick: null, lastClick: null }
    }

    links[link].count++
    links[link].firstClick = links[link].firstClick || new Date()
    links[link].lastClick = new Date()

    // Update tracking record
    const updatedTracking = await prisma.emailTracking.update({
      where: { id: tracking.id },
      data: {
        clickCount: tracking.clickCount + 1,
        firstClickAt: tracking.firstClickAt || new Date(),
        lastClickAt: new Date(),
        links: JSON.stringify(links),
        ipAddress: metadata?.ipAddress || tracking.ipAddress,
        userAgent: metadata?.userAgent || tracking.userAgent,
        deviceInfo: metadata?.deviceInfo ? JSON.stringify(metadata.deviceInfo) : tracking.deviceInfo
      }
    })

    // Update email recipient status
    await prisma.emailRecipient.updateMany({
      where: { emailId: tracking.emailId },
      data: {
        status: 'clicked',
        clickCount: { increment: 1 },
        lastClickAt: new Date()
      }
    })

    // Update campaign statistics
    if (tracking.email.campaignId) {
      await prisma.emailCampaign.update({
        where: { id: tracking.email.campaignId },
        data: {
          clickedCount: { increment: 1 }
        }
      })
    }

    return {
      emailId: tracking.emailId,
      trackingId: tracking.trackingId,
      link,
      clickCount: updatedTracking.clickCount,
      firstClickAt: updatedTracking.firstClickAt,
      lastClickAt: updatedTracking.lastClickAt,
      ipAddress: updatedTracking.ipAddress || undefined,
      userAgent: updatedTracking.userAgent || undefined,
      deviceInfo: updatedTracking.deviceInfo ? JSON.parse(updatedTracking.deviceInfo) : undefined
    }
  }

  /**
   * Track email bounce
   */
  async trackBounce(bounceData: BounceTrackingData): Promise<void> {
    // Create bounce record
    await prisma.emailBounce.create({
      data: {
        workspaceId: bounceData.workspaceId,
        email: bounceData.email,
        recipientEmail: bounceData.recipientEmail,
        recipientId: bounceData.recipientId,
        type: bounceData.type,
        subType: bounceData.subType,
        reason: bounceData.reason,
        providerType: bounceData.providerType,
        providerMessage: bounceData.providerMessage,
        occurredAt: bounceData.occurredAt
      }
    })

    // Update email recipient status
    if (bounceData.recipientId) {
      await prisma.emailRecipient.updateMany({
        where: { leadId: bounceData.recipientId, email: { workspaceId: bounceData.workspaceId } },
        data: {
          status: 'bounced',
          bouncedAt: new Date(),
          bounceReason: bounceData.reason
        }
      })
    }

    // Add to suppression list
    await this.addToSuppressionList(
      bounceData.workspaceId,
      bounceData.recipientEmail,
      'bounce',
      bounceData.reason,
      bounceData.providerType
    )

    // Update campaign statistics
    const email = await prisma.email.findFirst({
      where: {
        workspaceId: bounceData.workspaceId,
        recipients: { some: { recipientEmail: bounceData.recipientEmail } }
      }
    })

    if (email?.campaignId) {
      await prisma.emailCampaign.update({
        where: { id: email.campaignId },
        data: {
          bouncedCount: { increment: 1 }
        }
      })
    }
  }

  /**
   * Track unsubscribe
   */
  async trackUnsubscribe(unsubscribeData: UnsubscribeTrackingData): Promise<void> {
    // EmailUnsubscribe is unique per workspace and address, so a second click on
    // the same unsubscribe link used to fail with a unique violation (500). Upsert instead.
    await prisma.emailUnsubscribe.upsert({
      where: { workspaceId_email: { workspaceId: unsubscribeData.workspaceId, email: unsubscribeData.email } },
      update: { unsubscribedAt: unsubscribeData.unsubscribedAt },
      create: {
        workspaceId: unsubscribeData.workspaceId,
        email: unsubscribeData.email,
        leadId: unsubscribeData.leadId,
        campaignId: unsubscribeData.campaignId,
        reason: unsubscribeData.reason,
        source: unsubscribeData.source,
        unsubscribedAt: unsubscribeData.unsubscribedAt
      }
    })

    // Add to suppression list
    await this.addToSuppressionList(
      unsubscribeData.workspaceId,
      unsubscribeData.email,
      'manual',
      unsubscribeData.reason,
      unsubscribeData.source
    )

    // Update email recipient status
    if (unsubscribeData.leadId) {
      await prisma.emailRecipient.updateMany({
        where: { leadId: unsubscribeData.leadId, email: { workspaceId: unsubscribeData.workspaceId } },
        data: {
          status: 'unsubscribed',
          unsubscribedAt: new Date(),
          unsubscribeReason: unsubscribeData.reason
        }
      })
    }

    // Update campaign statistics
    // The campaign id comes from an unsigned URL parameter, so only count it
    // against a campaign of the workspace the signed link belongs to.
    if (unsubscribeData.campaignId) {
      await prisma.emailCampaign.updateMany({
        where: { id: unsubscribeData.campaignId, workspaceId: unsubscribeData.workspaceId },
        data: {
          unsubscribedCount: { increment: 1 }
        }
      })
    }
  }

  /**
   * Add email to suppression list
   */
  async addToSuppressionList(
    workspaceId: string,
    email: string,
    type: 'bounce' | 'complaint' | 'manual' | 'spam',
    reason?: string,
    source?: string
  ): Promise<void> {
    // Upsert on the (workspace, email, type) unique key. Checking only for an
    // *active* row and then creating failed with a unique violation when an
    // inactive row for the same pair already existed; this re-activates it instead.
    await prisma.emailSuppression.upsert({
      where: { workspaceId_email_type: { workspaceId, email, type } },
      update: { isActive: true, reason, source, suppressedAt: new Date() },
      create: {
        workspaceId,
        email,
        type,
        reason,
        source,
        isActive: true,
        suppressedAt: new Date()
      }
    })
  }

  /**
   * Check if email is suppressed
   */
  async isEmailSuppressed(email: string, workspaceId: string): Promise<boolean> {
    const suppression = await prisma.emailSuppression.findFirst({
      where: {
        workspaceId,
        email,
        isActive: true
      }
    })

    return !!suppression
  }

  /**
   * Get suppression list for email
   */
  async getEmailSuppressions(email: string, workspaceId: string): Promise<any[]> {
    const suppressions = await prisma.emailSuppression.findMany({
      where: { email, workspaceId },
      orderBy: { suppressedAt: 'desc' }
    })

    return suppressions
  }

  /**
   * Remove email from suppression list
   */
  async removeFromSuppressionList(email: string, workspaceId: string, type?: string): Promise<boolean> {
    const result = await prisma.emailSuppression.updateMany({
      where: {
        workspaceId,
        email,
        type: type || undefined,
        isActive: true
      },
      data: {
        isActive: false
      }
    })

    return result.count > 0
  }

  /**
   * Get tracking statistics for campaign
   */
  async getCampaignStatistics(campaignId: string): Promise<TrackingStatistics> {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId }
    })

    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`)
    }

    const totalEmails = campaign.totalRecipients
    const totalOpens = campaign.openedCount
    const totalClicks = campaign.clickedCount
    const totalBounces = campaign.bouncedCount
    const totalUnsubscribes = campaign.unsubscribedCount

    const openRate = totalEmails > 0 ? (totalOpens / totalEmails) * 100 : 0
    const clickRate = totalEmails > 0 ? (totalClicks / totalEmails) * 100 : 0
    const bounceRate = totalEmails > 0 ? (totalBounces / totalEmails) * 100 : 0
    const unsubscribeRate = totalEmails > 0 ? (totalUnsubscribes / totalEmails) * 100 : 0

    // Get unique opens and clicks from tracking records
    const trackingRecords = await prisma.emailTracking.findMany({
      where: {
        email: {
          campaignId
        }
      }
    })

    const uniqueOpens = trackingRecords.filter((t: (typeof trackingRecords)[number]) => t.openCount > 0).length
    const uniqueClicks = trackingRecords.filter((t: (typeof trackingRecords)[number]) => t.clickCount > 0).length

    const averageOpensPerEmail = uniqueOpens > 0 ? totalOpens / uniqueOpens : 0
    const averageClicksPerEmail = uniqueClicks > 0 ? totalClicks / uniqueClicks : 0

    return {
      totalEmails,
      totalOpens,
      totalClicks,
      totalBounces,
      totalUnsubscribes,
      openRate,
      clickRate,
      bounceRate,
      unsubscribeRate,
      uniqueOpens,
      uniqueClicks,
      averageOpensPerEmail,
      averageClicksPerEmail
    }
  }

  /**
   * Get tracking data for email
   */
  async getEmailTracking(emailId: string): Promise<OpenTrackingData | null> {
    const tracking = await prisma.emailTracking.findUnique({
      where: { emailId }
    })

    if (!tracking) {
      return null
    }

    return {
      emailId: tracking.emailId,
      trackingId: tracking.trackingId,
      openCount: tracking.openCount,
      firstOpenAt: tracking.firstOpenAt,
      lastOpenAt: tracking.lastOpenAt,
      ipAddress: tracking.ipAddress || undefined,
      userAgent: tracking.userAgent || undefined,
      deviceInfo: tracking.deviceInfo ? JSON.parse(tracking.deviceInfo) : undefined
    }
  }

  /**
   * Get click tracking data for email
   */
  async getClickTracking(emailId: string): Promise<ClickTrackingData[]> {
    const tracking = await prisma.emailTracking.findUnique({
      where: { emailId }
    })

    if (!tracking || !tracking.links) {
      return []
    }

    const links = JSON.parse(tracking.links)
    const clickData: ClickTrackingData[] = []

    for (const [link, data] of Object.entries(links)) {
      const linkData = data as { count: number; firstClick: Date | null; lastClick: Date | null }
      clickData.push({
        emailId: tracking.emailId,
        trackingId: tracking.trackingId,
        link,
        clickCount: linkData.count,
        firstClickAt: linkData.firstClick,
        lastClickAt: linkData.lastClick,
        ipAddress: tracking.ipAddress || undefined,
        userAgent: tracking.userAgent || undefined,
        deviceInfo: tracking.deviceInfo ? JSON.parse(tracking.deviceInfo) : undefined
      })
    }

    return clickData
  }

  /**
   * Generate tracking pixel URL
   */
  generateOpenTrackingUrl(trackingId: string): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return `${appUrl}/api/email-tracking/open/${trackingId}`
  }

  /**
   * Generate click tracking URL
   */
  generateClickTrackingUrl(trackingId: string, originalUrl: string): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const encodedUrl = encodeURIComponent(originalUrl)
    return `${appUrl}/api/email-tracking/click/${trackingId}?url=${encodedUrl}`
  }

  /**
   * Generate unsubscribe URL
   */
  generateUnsubscribeUrl(email: string, workspaceId: string, campaignId?: string): string {
    // The unsubscribe route rejects links without a valid signature, so build
    // the same signed link the campaign and automation footers use.
    const url = buildUnsubscribeUrl(email, workspaceId)
    return campaignId ? `${url}&campaign=${encodeURIComponent(campaignId)}` : url
  }

  /**
   * Get bounce statistics
   */
  async getBounceStatistics(workspaceId?: string): Promise<any> {
    const whereClause: any = {}

    if (workspaceId) {
      whereClause.workspaceId = workspaceId
    }

    const bounces = await prisma.emailBounce.findMany({
      where: whereClause,
      orderBy: { occurredAt: 'desc' }
    })

    const byType = bounces.reduce((acc: Record<string, number>, bounce: (typeof bounces)[number]) => {
      if (!acc[bounce.type]) {
        acc[bounce.type] = 0
      }
      acc[bounce.type]++
      return acc
    }, {} as Record<string, number>)

    const byProvider = bounces.reduce((acc: Record<string, number>, bounce: (typeof bounces)[number]) => {
      if (!bounce.providerType) {
        return acc
      }
      if (!acc[bounce.providerType]) {
        acc[bounce.providerType] = 0
      }
      acc[bounce.providerType]++
      return acc
    }, {} as Record<string, number>)

    return {
      total: bounces.length,
      byType,
      byProvider,
      recent: bounces.slice(0, 100)
    }
  }

  /**
   * Get unsubscribe statistics
   */
  async getUnsubscribeStatistics(workspaceId?: string): Promise<any> {
    const whereClause: any = {}

    if (workspaceId) {
      whereClause.workspaceId = workspaceId
    }

    const unsubscribes = await prisma.emailUnsubscribe.findMany({
      where: whereClause,
      orderBy: { unsubscribedAt: 'desc' }
    })

    const bySource = unsubscribes.reduce((acc: Record<string, number>, unsubscribe: (typeof unsubscribes)[number]) => {
      if (!acc[unsubscribe.source]) {
        acc[unsubscribe.source] = 0
      }
      acc[unsubscribe.source]++
      return acc
    }, {} as Record<string, number>)

    return {
      total: unsubscribes.length,
      bySource,
      recent: unsubscribes.slice(0, 100)
    }
  }

  /**
   * Get suppression list statistics
   */
  async getSuppressionStatistics(workspaceId?: string): Promise<any> {
    const whereClause: any = {
      isActive: true
    }

    if (workspaceId) {
      whereClause.workspaceId = workspaceId
    }

    const suppressions = await prisma.emailSuppression.findMany({
      where: whereClause
    })

    const byType = suppressions.reduce((acc: Record<string, number>, suppression: (typeof suppressions)[number]) => {
      if (!acc[suppression.type]) {
        acc[suppression.type] = 0
      }
      acc[suppression.type]++
      return acc
    }, {} as Record<string, number>)

    return {
      total: suppressions.length,
      byType
    }
  }
}

// Export singleton instance
export const emailTrackingService = new EmailTrackingService()
