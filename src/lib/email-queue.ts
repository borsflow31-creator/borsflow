/**
 * Email Queue Service
 * 
 * Manages email sending queue with priority-based processing,
 * retry logic and failure handling.
 */

import { prisma } from '@/lib/prisma'

// Queue item structure
export interface QueueItem {
  id: string
  emailId: string
  priority: number // 1-10, 1 is highest
  scheduledFor: Date
  attempts: number
  maxAttempts: number
  lastAttemptAt: Date | null
  nextAttemptAt: Date | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error: string | null
  providerId: string | null
  processedAt: Date | null
}

// Queue options structure
export interface QueueOptions {
  priority?: number
  scheduledFor?: Date
  providerId?: string
}

// Queue statistics structure
export interface QueueStatistics {
  totalQueued: number
  totalProcessed: number
  totalFailed: number
  totalCompleted: number
  averageProcessingTime: number
  emailsByPriority: Record<number, number>
}

/**
 * Email Queue Service Class
 * 
 * Manages email sending queue with priority-based processing,
 * retry logic and failure handling.
 */
export class EmailQueueService {
  private processing: Set<string> = new Set()
  private isRunning: boolean = false
  private processingInterval: NodeJS.Timeout | null = null
  private readonly PROCESSING_INTERVAL = 5000 // 5 seconds
  private readonly MAX_CONCURRENT = 10 // Maximum concurrent sends

  /**
   * Enqueue an email for sending
   */
  async enqueue(
    emailId: string,
    options?: QueueOptions
  ): Promise<string> {
    const priority = options?.priority || 5
    const scheduledFor = options?.scheduledFor || new Date()

    // Create or update queue item
    const existingItem = await prisma.emailQueue.findUnique({
      where: { emailId }
    })

    if (existingItem) {
      // Update existing item
      await prisma.emailQueue.update({
        where: { id: existingItem.id },
        data: {
          priority,
          scheduledFor,
          attempts: 0,
          nextAttemptAt: scheduledFor,
          status: 'pending'
        }
      })

      return existingItem.id
    } else {
      // Create new queue item
      const queueItem = await prisma.emailQueue.create({
        data: {
          emailId,
          priority,
          scheduledFor,
          attempts: 0,
          maxAttempts: 3,
          status: 'pending'
        }
      })

      return queueItem.id
    }
  }

  /**
   * Enqueue multiple emails
   */
  async enqueueBatch(
    emailIds: string[],
    options?: QueueOptions
  ): Promise<string[]> {
    const priority = options?.priority || 5
    const scheduledFor = options?.scheduledFor || new Date()

    const queueItemIds = await Promise.all(
      emailIds.map(emailId =>
        this.enqueue(emailId, { priority, scheduledFor })
      )
    )

    return queueItemIds
  }

  /**
   * Start processing the queue
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    this.processingInterval = setInterval(() => {
      this.processQueue()
    }, this.PROCESSING_INTERVAL)

    console.log('Email queue service started')
  }

  /**
   * Stop processing the queue
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }

    console.log('Email queue service stopped')
  }

  /**
   * Run one processing cycle (for use by CRON / external callers)
   */
  async runOnce(): Promise<void> {
    return this.processQueue()
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    try {
      // Get pending emails ready to send
      const pendingEmails = await prisma.emailQueue.findMany({
        where: {
          status: 'pending',
          scheduledFor: { lte: new Date() }
        },
        orderBy: [
          { priority: 'asc' },
          { scheduledFor: 'asc' }
        ],
        take: this.MAX_CONCURRENT - this.processing.size
      })

      if (pendingEmails.length === 0) {
        return
      }

      console.log(`Processing ${pendingEmails.length} pending emails`)

      for (const queueItem of pendingEmails) {
        // Check if we're at max concurrent processing
        if (this.processing.size >= this.MAX_CONCURRENT) {
          break
        }

        await this.processQueueItem(queueItem as QueueItem)
      }
    } catch (error) {
      console.error('Error processing queue:', error)
    }
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(queueItem: QueueItem): Promise<void> {
    // Claim the item atomically. Two overlapping runs (a scheduled tick and a
    // manual trigger, or two lambdas) can both read the same row as pending;
    // the conditional update lets only one of them flip it to processing, so
    // the email is sent once. The in-memory `processing` set cannot do this -
    // it does not survive across serverless invocations.
    const claimed = await prisma.emailQueue.updateMany({
      where: { id: queueItem.id, status: 'pending' },
      data: {
        status: 'processing',
        lastAttemptAt: new Date()
      }
    })

    if (claimed.count === 0) {
      return
    }

    this.processing.add(queueItem.id)

    try {
      // Get email details
      const email = await prisma.email.findUnique({
        where: { id: queueItem.emailId },
        include: { recipients: true }
      })

      if (!email) {
        throw new Error(`Email not found: ${queueItem.emailId}`)
      }

      if (!email.recipients || email.recipients.length === 0) {
        throw new Error(`No recipients found for email: ${queueItem.emailId}`)
      }

      // Import email marketing service
      const { emailMarketingService } = await import('./email-marketing')

      // Load this email's own workspace's providers and send only through them.
      // The service is shared by every tenant, so without the workspaceId it
      // picked from all of them and delivered one workspace's mail through
      // another workspace's API key and sender address.
      await emailMarketingService.loadProviders(email.workspaceId)

      const sendOptions = {
        workspaceId: email.workspaceId,
        providerId: queueItem.providerId || undefined,
        priority: queueItem.priority
      }

      // Send individually per recipient so each gets proper tracking
      let allSucceeded = true
      let lastError: string | undefined

      // A recipient can unsubscribe between enqueue and send — for automation
      // steps scheduled days out, that gap is the whole point of checking here.
      const { isSendable } = await import('./email/suppression')

      for (const recipient of email.recipients as any[]) {
        if (!(await isSendable(recipient.recipientEmail, email.workspaceId))) {
          await prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: { status: 'unsubscribed', unsubscribedAt: new Date() }
          }).catch(() => {})
          // Deliberately not a failure: retrying would never make it sendable.
          continue
        }

        const emailData = {
          to: recipient.recipientEmail,
          subject: email.subject,
          html: email.htmlContent,
          text: email.textContent || undefined,
          metadata: {
            emailId: email.id,
            campaignId: email.campaignId,
            recipientId: recipient.id,
            queueItemId: queueItem.id
          }
        }

        const result = await emailMarketingService.sendEmail(emailData, sendOptions)

        if (result.success) {
          await prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: { status: 'sent', sentAt: new Date() }
          }).catch(() => {}) // non-fatal if recipient record is missing
        } else {
          allSucceeded = false
          lastError = result.error
          await prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: { status: 'failed' }
          }).catch(() => {})
        }
      }

      if (allSucceeded) {
        // Update queue item as completed
        await prisma.emailQueue.update({
          where: { id: queueItem.id },
          data: {
            status: 'completed',
            processedAt: new Date(),
            providerId: sendOptions.providerId || null
          }
        })

        console.log(`Successfully sent email ${queueItem.emailId}`)
      } else {
        // Handle failure
        await this.handleQueueItemFailure(queueItem, lastError)
      }
    } catch (error) {
      await this.handleQueueItemFailure(queueItem, error instanceof Error ? error.message : String(error))
    } finally {
      this.processing.delete(queueItem.id)
    }
  }

  /**
   * Handle queue item failure
   */
  private async handleQueueItemFailure(
    queueItem: QueueItem,
    error: string | undefined
  ): Promise<void> {
    const newAttempts = queueItem.attempts + 1

    if (newAttempts >= queueItem.maxAttempts) {
      // Mark as failed after max attempts
      await prisma.emailQueue.update({
        where: { id: queueItem.id },
        data: {
          status: 'failed',
          error: error || 'Max attempts reached',
          attempts: newAttempts
        }
      })

      console.error(`Failed to send email ${queueItem.emailId} after ${newAttempts} attempts`)
      return
    }

    // Calculate next attempt time with exponential backoff
    const backoffDelay = Math.pow(2, newAttempts) * 1000 // 2^n seconds
    const nextAttemptAt = new Date(Date.now() + backoffDelay)

    // Hand the item back to the queue. processQueue only picks up `pending` items
    // whose scheduledFor has passed; this used to leave the item in `processing`,
    // so a single transient provider error stranded the email permanently.
    await prisma.emailQueue.update({
      where: { id: queueItem.id },
      data: {
        status: 'pending',
        scheduledFor: nextAttemptAt,
        nextAttemptAt,
        attempts: newAttempts,
        error: error || 'Unknown error'
      }
    })

    console.log(`Scheduling retry for email ${queueItem.emailId} at ${nextAttemptAt.toISOString()}`)
  }

  /**
   * Get queue statistics
   */
  async getStatistics(): Promise<QueueStatistics> {
    const allItems = await prisma.emailQueue.findMany()

    const totalQueued = allItems.length
    const totalProcessed = allItems.filter(item => item.status === 'completed').length
    const totalFailed = allItems.filter(item => item.status === 'failed').length
    const totalCompleted = totalProcessed

    const processingTimes = allItems
      .filter(item => item.status === 'completed' && item.processedAt !== null)
      .map(item => {
        const createdTime = new Date(item.createdAt)
        const processedTime = new Date(item.processedAt!)
        return processedTime.getTime() - createdTime.getTime()
      })

    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0

    const emailsByPriority = allItems.reduce((acc, item) => {
      if (!acc[item.priority]) {
        acc[item.priority] = 0
      }
      acc[item.priority]++
      return acc
    }, {} as Record<number, number>)

    return {
      totalQueued,
      totalProcessed,
      totalFailed,
      totalCompleted,
      averageProcessingTime,
      emailsByPriority
    }
  }

  /**
   * Get pending queue items count
   */
  async getPendingCount(): Promise<number> {
    const count = await prisma.emailQueue.count({
      where: {
        status: 'pending',
        scheduledFor: { lte: new Date() }
      }
    })

    return count
  }

  /**
   * Get processing queue items count
   */
  async getProcessingCount(): Promise<number> {
    const count = await prisma.emailQueue.count({
      where: { status: 'processing' }
    })

    return count
  }

  /**
   * Get failed queue items count
   */
  async getFailedCount(): Promise<number> {
    const count = await prisma.emailQueue.count({
      where: { status: 'failed' }
    })

    return count
  }

  /**
   * Get completed queue items count
   */
  async getCompletedCount(): Promise<number> {
    const count = await prisma.emailQueue.count({
      where: { status: 'completed' }
    })

    return count
  }

  /**
   * Get queue item by ID
   */
  async getQueueItem(queueItemId: string): Promise<QueueItem | null> {
    const queueItem = await prisma.emailQueue.findUnique({
      where: { id: queueItemId }
    })

    return queueItem as QueueItem | null
  }

  /**
   * Get all queue items
   */
  async getAllQueueItems(): Promise<QueueItem[]> {
    const queueItems = await prisma.emailQueue.findMany({
      orderBy: [
        { priority: 'asc' },
        { scheduledFor: 'asc' }
      ]
    })

    return queueItems as QueueItem[]
  }

  /**
   * Retry failed emails
   */
  async retryFailedEmails(maxRetries?: number): Promise<number> {
    const failedItems = await prisma.emailQueue.findMany({
      where: {
        status: 'failed',
        attempts: {
          lt: maxRetries || 3
        }
      },
      orderBy: {
        nextAttemptAt: 'asc'
      },
      take: maxRetries || 10
    })

    let retriedCount = 0

    for (const queueItem of failedItems) {
      // Reset to pending for retry
      await prisma.emailQueue.update({
        where: { id: queueItem.id },
        data: {
          status: 'pending',
          attempts: 0,
          nextAttemptAt: new Date(),
          error: null
        }
      })

      retriedCount++
    }

    return retriedCount
  }

  /**
   * Clear completed queue items older than specified days
   */
  async clearOldItems(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const result = await prisma.emailQueue.deleteMany({
      where: {
        status: 'completed',
        processedAt: {
          lt: cutoffDate
        }
      }
    })

    return result.count
  }

  /**
   * Cancel a queue item
   */
  async cancelQueueItem(queueItemId: string): Promise<boolean> {
    const result = await prisma.emailQueue.update({
      where: { id: queueItemId },
      data: {
        status: 'cancelled'
      }
    })

    return !!result
  }
}

// Export singleton instance
export const emailQueueService = new EmailQueueService()
