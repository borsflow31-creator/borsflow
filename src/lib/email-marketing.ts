/**
 * Email Marketing Service
 * 
 * Comprehensive email marketing service with provider management,
 * campaign execution, tracking, and segmentation.
 */

import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { revealApiKey } from '@/lib/email/provider-keys'

// Email data structure
export interface EmailData {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  metadata?: Record<string, any>
  /** Files such as a quote/invoice PDF. Buffers; each provider encodes them as its API needs. */
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>
}

// Send result structure
export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
  provider: string
  timestamp: Date
}

// Batch send result structure
export interface BatchSendResult {
  total: number
  successful: number
  failed: number
  results: Array<PromiseSettledResult<SendResult>>
}

// Provider configuration structure
export interface EmailProviderConfig {
  id: string
  type: 'sendgrid' | 'ses' | 'resend' | 'mailgun' | 'postmark' | 'nodemailer' | 'brevo'
  apiKey: string
  fromEmail: string
  fromName?: string
  replyTo?: string
  isActive: boolean
  isDefault: boolean
  priority: number
  weight: number
  costPerEmail: number
  dailyLimit?: number
  monthlyLimit?: number
  region?: string
  domain?: string
  serverToken?: string
  metadata?: Record<string, any>
}

// Provider stats structure
export interface ProviderStats {
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  averageDeliveryTime: number
  lastUsedAt: Date
}

// Send options structure
export interface SendOptions {
  /** The workspace the email belongs to. Required: only its own providers are eligible. */
  workspaceId?: string
  providerId?: string
  retryOnFailure?: boolean
  priority?: number
  loadBalanceStrategy?: 'round-robin' | 'least-connections' | 'weighted' | 'cost-optimized'
}

// Provider health structure
interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  failureCount: number
  lastFailure: Date | null
  cooldownPeriod: number
  lastChecked: Date
  stats?: ProviderStats
}

/**
 * Email Provider Interface
 */
interface EmailProvider {
  sendEmail(email: EmailData): Promise<SendResult>
  sendBatch(emails: EmailData[]): Promise<BatchSendResult>
  getStats(): Promise<ProviderStats>
  validateConfig(): Promise<boolean>
  getType(): string
}

/**
 * Email Marketing Service Class
 * 
 * Manages email marketing functionality including provider management,
 * campaign execution, tracking, and segmentation.
 */
export class EmailMarketingService {
  private providers: Map<string, EmailProvider> = new Map()
  private providerConfigs: Map<string, EmailProviderConfig> = new Map()
  private providerHealth: Map<string, ProviderHealth> = new Map()
  /** providerId -> owning workspaceId, so selection can be restricted to one tenant. */
  private providerWorkspace: Map<string, string> = new Map()
  private roundRobinIndex: number = 0

  /**
   * (Re)load a workspace's active providers from the database.
   *
   * The workspace's previously loaded providers are dropped first, so a provider
   * that was deactivated, deleted or re-keyed stops being used. Before, providers
   * only ever accumulated in this long-lived singleton.
   */
  async loadProviders(workspaceId: string): Promise<void> {
    const providers = await prisma.emailProvider.findMany({
      where: {
        workspaceId,
        isActive: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    const activeIds = new Set(providers.map((p) => p.id))
    for (const [id, owner] of Array.from(this.providerWorkspace.entries())) {
      if (owner === workspaceId && !activeIds.has(id)) this.unregisterProvider(id)
    }

    for (const providerData of providers) {
      const config: EmailProviderConfig = {
        id: providerData.id,
        type: providerData.type as any,
        apiKey: revealApiKey(providerData.apiKey),
        fromEmail: providerData.fromEmail,
        fromName: providerData.fromName || undefined,
        replyTo: providerData.replyTo || undefined,
        isActive: providerData.isActive,
        isDefault: providerData.isDefault,
        priority: 10,
        weight: 1,
        costPerEmail: 0.01,
        dailyLimit: providerData.dailyLimit || undefined,
        monthlyLimit: providerData.monthlyLimit || undefined,
        region: (providerData as any).region || undefined,
        domain: (providerData as any).domain || undefined,
        serverToken: (providerData as any).serverToken || undefined,
        // One bad config row must not break sending for the whole workspace
        metadata: (() => { try { return providerData.config ? JSON.parse(providerData.config) : undefined } catch { return undefined } })()
      }

      // Keep existing health across reloads: the queue cron reloads every minute,
      // and resetting here would cancel the failure cooldown each time.
      if (!this.providerHealth.has(providerData.id)) {
        this.providerHealth.set(providerData.id, {
          status: 'healthy',
          failureCount: 0,
          lastFailure: null,
          cooldownPeriod: 300000,
          lastChecked: new Date()
        })
      }

      // Create simple provider wrapper
      this.providers.set(providerData.id, this.createProviderWrapper(config))
      this.providerConfigs.set(providerData.id, config)
      this.providerWorkspace.set(providerData.id, workspaceId)
    }
  }

  /**
   * Create a simple provider wrapper
   */
  private createProviderWrapper(config: EmailProviderConfig): EmailProvider {
    return {
      sendEmail: async (email: EmailData): Promise<SendResult> => {
        try {
          let messageId = ''

          if (config.type === 'resend') {
            const resend = new Resend(config.apiKey)
            const response = await resend.emails.send({
              from: config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail,
              to: email.to,
              subject: email.subject,
              html: email.html,
              text: email.text,
              replyTo: email.replyTo || config.replyTo,
              attachments: email.attachments?.map(a => ({ filename: a.filename, content: a.content })),
              tags: email.metadata ? Object.entries(email.metadata).filter(([_, v]) => v).map(([k, v]) => ({ name: k, value: String(v) })) : undefined
            })
            
            if (response.error) {
              throw new Error(response.error.message)
            }
            messageId = response.data?.id || ''
          } 
          else if (config.type === 'brevo') {
            const payload: Record<string, any> = {
              sender: {
                email: config.fromEmail,
                ...(config.fromName ? { name: config.fromName } : {})
              },
              to: [{ email: email.to }],
              subject: email.subject,
              htmlContent: email.html,
            }
            if (email.text) payload.textContent = email.text
            if (email.attachments?.length) {
              payload.attachment = email.attachments.map(a => ({ name: a.filename, content: a.content.toString('base64') }))
            }
            const replyToEmail = email.replyTo || config.replyTo
            if (replyToEmail) payload.replyTo = { email: replyToEmail }
            if (email.metadata) {
              payload.tags = Object.keys(email.metadata).filter(k => email.metadata![k])
            }
            const res = await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'api-key': config.apiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            if (!res.ok) {
              let errMsg = `Brevo API error ${res.status}`
              try { const body = await res.json(); errMsg = body.message || errMsg } catch {}
              throw new Error(errMsg)
            }
            const data = await res.json()
            messageId = data.messageId
          }
          else if (config.type === 'ses') {
            const { SESProvider } = await import('./email/providers/ses-provider')
            const provider = new SESProvider(config as any)
            const result = await provider.sendEmail(email)
            if (!result.success) throw new Error(result.error || 'SES send failed')
            messageId = result.messageId || ''
          }
          else if (config.type === 'mailgun') {
            const { MailgunProvider } = await import('./email/providers/mailgun-provider')
            const provider = new MailgunProvider(config as any)
            const result = await provider.sendEmail(email)
            if (!result.success) throw new Error(result.error || 'Mailgun send failed')
            messageId = result.messageId || ''
          }
          else if (config.type === 'postmark') {
            const { PostmarkProvider } = await import('./email/providers/postmark-provider')
            const provider = new PostmarkProvider(config as any)
            const result = await provider.sendEmail(email)
            if (!result.success) throw new Error(result.error || 'Postmark send failed')
            messageId = result.messageId || ''
          }
          else if (config.type === 'sendgrid') {
            // Override the earlier sendgrid block with the provider class for consistency
            const { SendGridProvider } = await import('./email/providers/sendgrid-provider')
            const provider = new SendGridProvider(config as any)
            const result = await provider.sendEmail(email)
            if (!result.success) throw new Error(result.error || 'SendGrid send failed')
            messageId = result.messageId || ''
          }
          else {
            // There is no sender for this type (e.g. the old "Custom SMTP" option).
            // This used to invent a message id and report success, so every email
            // routed here was marked sent while nothing was delivered.
            throw new Error(`Email provider type "${config.type}" is not supported for sending`)
          }
          
          return {
            success: true,
            messageId,
            provider: config.type,
            timestamp: new Date()
          }
        } catch (error: any) {
          console.error(`[${config.type}] Failed to send email:`, error)
          return {
            success: false,
            error: error.message || 'Failed to send email',
            provider: config.type,
            timestamp: new Date()
          }
        }
      },
      sendBatch: async (emails: EmailData[]): Promise<BatchSendResult> => {
        const results = await Promise.allSettled(
          emails.map(email => this.sendEmail(email))
        )

        return {
          total: emails.length,
          successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
          failed: results.filter(r => r.status === 'rejected' || !r.value.success).length,
          results
        }
      },
      getStats: async (): Promise<ProviderStats> => {
        // Placeholder - in production, query provider API for actual stats
        return {
          totalSent: 0,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          averageDeliveryTime: 0,
          lastUsedAt: new Date()
        }
      },
      validateConfig: async (): Promise<boolean> => {
        try {
          if (!config.apiKey || config.apiKey.length < 10) {
            return false
          }
          if (!config.fromEmail || !this.isValidEmail(config.fromEmail)) {
            return false
          }
          
          if (config.type === 'resend') {
            const resend = new Resend(config.apiKey)
            const response = await resend.emails.send({
              from: config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail,
              to: 'delivered@resend.dev',
              subject: 'Resend Configuration Test',
              html: '<p>This is a test email to validate your Resend configuration.</p>'
            })
            return !response.error
          }
          
          return true
        } catch (error) {
          return false
        }
      },
      getType: () => config.type
    }
  }

  /**
   * Send a single email through a provider that belongs to `options.workspaceId`.
   *
   * This service is a process-wide singleton, so its provider map holds every
   * workspace that has been loaded. Selection used to pick from that whole map, so
   * one workspace's campaign went out through another workspace's API key and
   * sender address. Every path now selects only among the email's own workspace's
   * providers, and fails rather than falling back to anyone else's.
   */
  async sendEmail(email: EmailData, options?: SendOptions): Promise<SendResult> {
    const { id, provider } = this.selectProvider(options)

    try {
      const result = await provider.sendEmail(email)
      this.updateProviderHealth(id, result.success)

      if (!result.success && options?.retryOnFailure) {
        return await this.retryWithFailover(email, options, id)
      }

      return result
    } catch (error) {
      this.updateProviderHealth(id, false)

      if (options?.retryOnFailure) {
        return await this.retryWithFailover(email, options, id)
      }

      throw error
    }
  }

  /**
   * Send multiple emails in batch (same workspace scoping as sendEmail).
   */
  async sendBatch(emails: EmailData[], options?: SendOptions): Promise<BatchSendResult> {
    const { id, provider } = this.selectProvider(options)

    try {
      const result = await provider.sendBatch(emails)
      this.updateProviderHealth(id, result.failed === 0)
      return result
    } catch (error) {
      this.updateProviderHealth(id, false)
      throw error
    }
  }

  /** Loaded, healthy providers that belong to `workspaceId`, as [id, provider] pairs. */
  private providersFor(workspaceId: string): Array<[string, EmailProvider]> {
    return Array.from(this.providers.entries()).filter(
      ([id]) => this.providerWorkspace.get(id) === workspaceId && this.isProviderHealthy(id)
    )
  }

  /**
   * Select the provider for a send.
   *
   * Priority: an explicit provider id (which must belong to the workspace) > the
   * workspace's default provider > the configured load-balancing strategy, always
   * restricted to the workspace's own providers.
   */
  private selectProvider(options?: SendOptions): { id: string; provider: EmailProvider } {
    const workspaceId = options?.workspaceId
    if (!workspaceId) {
      throw new Error('A workspaceId is required to choose an email provider')
    }

    const candidates = this.providersFor(workspaceId)

    if (options?.providerId) {
      const match = candidates.find(([id]) => id === options.providerId)
      if (!match) {
        throw new Error('The selected email provider is not available for this workspace')
      }
      return { id: match[0], provider: match[1] }
    }

    if (candidates.length === 0) {
      throw new Error('No active email provider is configured for this workspace')
    }

    const preferred = candidates.find(([id]) => this.providerConfigs.get(id)?.isDefault)
    if (preferred) return { id: preferred[0], provider: preferred[1] }

    return this.loadBalanceProvider(candidates, options)
  }

  /**
   * Load balance across the given candidates (already scoped to one workspace).
   */
  private loadBalanceProvider(
    candidates: Array<[string, EmailProvider]>,
    options?: SendOptions
  ): { id: string; provider: EmailProvider } {
    const strategy = options?.loadBalanceStrategy || 'round-robin'

    switch (strategy) {
      case 'least-connections':
        return this.leastConnections(candidates)
      case 'weighted':
        return this.weighted(candidates)
      case 'cost-optimized':
        return this.costOptimized(candidates)
      case 'round-robin':
      default:
        return this.roundRobin(candidates)
    }
  }

  private roundRobin(candidates: Array<[string, EmailProvider]>) {
    const [id, provider] = candidates[this.roundRobinIndex % candidates.length]
    this.roundRobinIndex++
    return { id, provider }
  }

  private leastConnections(candidates: Array<[string, EmailProvider]>) {
    let best = candidates[0]
    let min = Infinity
    for (const entry of candidates) {
      const sent = this.providerHealth.get(entry[0])?.stats?.totalSent ?? 0
      if (sent < min) {
        min = sent
        best = entry
      }
    }
    return { id: best[0], provider: best[1] }
  }

  private weighted(candidates: Array<[string, EmailProvider]>) {
    const total = candidates.reduce((sum, [id]) => sum + (this.providerConfigs.get(id)?.weight || 1), 0)
    let random = Math.random() * total
    for (const entry of candidates) {
      random -= this.providerConfigs.get(entry[0])?.weight || 1
      if (random <= 0) return { id: entry[0], provider: entry[1] }
    }
    return { id: candidates[0][0], provider: candidates[0][1] }
  }

  private costOptimized(candidates: Array<[string, EmailProvider]>) {
    let best = candidates[0]
    let min = Infinity
    for (const entry of candidates) {
      const cost = this.providerConfigs.get(entry[0])?.costPerEmail ?? Infinity
      if (cost < min) {
        min = cost
        best = entry
      }
    }
    return { id: best[0], provider: best[1] }
  }

  /**
   * Retry once through another provider of the same workspace.
   */
  private async retryWithFailover(
    email: EmailData,
    options: SendOptions,
    failedId: string
  ): Promise<SendResult> {
    const backup = this.providersFor(options.workspaceId!)
      .filter(([id]) => id !== failedId)
      .sort((a, b) => (this.providerConfigs.get(a[0])?.priority || 10) - (this.providerConfigs.get(b[0])?.priority || 10))[0]

    if (!backup) {
      throw new Error('No backup email provider is available for this workspace')
    }

    const result = await backup[1].sendEmail(email)
    this.updateProviderHealth(backup[0], result.success)
    return result
  }

  /**
   * Check if provider is healthy
   */
  private isProviderHealthy(providerId: string): boolean {
    const health = this.providerHealth.get(providerId)

    if (!health) return true

    // Check if provider is in cooldown
    if (health.lastFailure && health.failureCount >= 3) {
      const cooldownEnd = new Date(health.lastFailure.getTime() + health.cooldownPeriod)
      if (new Date() < cooldownEnd) {
        return false
      }
    }

    return health.status === 'healthy' || health.status === 'degraded'
  }

  /**
   * Record a send outcome against one provider.
   *
   * This used to update every provider of the same *type*, so one workspace's
   * failing Resend key marked every other workspace's Resend provider unhealthy.
   */
  private updateProviderHealth(providerId: string, success: boolean): void {
    const health = this.providerHealth.get(providerId)
    if (!health) return

    if (success) {
      health.failureCount = 0
      health.lastFailure = null
      health.status = 'healthy'
    } else {
      health.failureCount++
      health.lastFailure = new Date()
      if (health.failureCount >= 3) {
        health.status = 'unhealthy'
      } else if (health.failureCount >= 1) {
        health.status = 'degraded'
      }
    }
    health.lastChecked = new Date()
  }

  /**
   * Get provider by ID
   */
  getProvider(providerId: string): EmailProvider | undefined {
    return this.providers.get(providerId)
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): Map<string, EmailProvider> {
    return this.providers
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(providerId: string): EmailProviderConfig | undefined {
    return this.providerConfigs.get(providerId)
  }

  /**
   * Get provider health status
   */
  getProviderHealth(providerId: string): ProviderHealth | undefined {
    return this.providerHealth.get(providerId)
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId)
    this.providerConfigs.delete(providerId)
    this.providerHealth.delete(providerId)
    this.providerWorkspace.delete(providerId)
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
}

// Export singleton instance
export const emailMarketingService = new EmailMarketingService()
