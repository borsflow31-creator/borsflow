/**
 * Email Provider Manager
 * 
 * Manages multiple email service providers with unified interface,
 * load balancing, and failover mechanisms.
 */

import { PrismaClient } from '@prisma/client'
import { SendGridProvider } from './sendgrid-provider'
import { SESProvider } from './ses-provider'
import { ResendProvider } from './resend-provider'
import { MailgunProvider } from './mailgun-provider'
import { PostmarkProvider } from './postmark-provider'

const prisma = new PrismaClient()

// Provider interface
export interface EmailProvider {
  sendEmail(email: EmailData): Promise<SendResult>
  sendBatch(emails: EmailData[]): Promise<BatchSendResult>
  getStats(): Promise<ProviderStats>
  validateConfig(): Promise<boolean>
  getType(): string
}

// Email data structure
export interface EmailData {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  metadata?: Record<string, any>
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

// Provider configuration structure
export interface EmailProviderConfig {
  id: string
  type: 'sendgrid' | 'ses' | 'resend' | 'mailgun' | 'postmark'
  apiKey: string
  fromEmail: string
  fromName?: string
  replyTo?: string
  isActive: boolean
  isDefault: boolean
  priority: number // 1-10, lower is higher priority
  weight: number // For load balancing
  costPerEmail: number
  dailyLimit?: number
  monthlyLimit?: number
  region?: string // For AWS SES
  domain?: string // For Mailgun
  serverToken?: string // For Postmark
  metadata?: Record<string, any>
}

// Send options structure
export interface SendOptions {
  providerId?: string
  retryOnFailure?: boolean
  priority?: number // 1-10, 1 is highest
  loadBalanceStrategy?: 'round-robin' | 'least-connections' | 'weighted' | 'cost-optimized'
}

// Provider health structure
interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  failureCount: number
  lastFailure: Date | null
  cooldownPeriod: number // in milliseconds
  lastChecked: Date
  stats?: ProviderStats
}

/**
 * Provider Manager Class
 * 
 * Manages multiple email providers with load balancing and failover.
 */
export class ProviderManager {
  private providers: Map<string, EmailProvider> = new Map()
  private providerConfigs: Map<string, EmailProviderConfig> = new Map()
  private providerHealth: Map<string, ProviderHealth> = new Map()
  private loadBalancer: LoadBalancer
  private failoverManager: FailoverManager

  constructor() {
    this.loadBalancer = new LoadBalancer(this.providers, this.providerConfigs)
    this.failoverManager = new FailoverManager(this.providers, this.providerHealth)
  }

  /**
   * Register a new email provider
   */
  async registerProvider(config: EmailProviderConfig): Promise<void> {
    let provider: EmailProvider

    switch (config.type) {
      case 'sendgrid':
        provider = new SendGridProvider(config)
        break
      case 'ses':
        provider = new SESProvider(config)
        break
      case 'resend':
        provider = new ResendProvider(config)
        break
      case 'mailgun':
        provider = new MailgunProvider(config)
        break
      case 'postmark':
        provider = new PostmarkProvider(config)
        break
      default:
        throw new Error(`Unsupported provider type: ${config.type}`)
    }

    const isValid = await provider.validateConfig()
    if (!isValid) {
      throw new Error(`Invalid configuration for provider: ${config.type}`)
    }

    this.providers.set(config.id, provider)
    this.providerConfigs.set(config.id, config)

    // Initialize health tracking
    this.providerHealth.set(config.id, {
      status: 'healthy',
      failureCount: 0,
      lastFailure: null,
      cooldownPeriod: 300000, // 5 minutes
      lastChecked: new Date()
    })
  }

  /**
   * Load all active providers from database
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

    for (const providerData of providers) {
      const config: EmailProviderConfig = {
        id: providerData.id,
        type: providerData.type as any,
        apiKey: providerData.apiKey || '',
        fromEmail: providerData.fromEmail,
        fromName: providerData.fromName || undefined,
        replyTo: providerData.replyTo || undefined,
        isActive: providerData.isActive,
        isDefault: providerData.isDefault,
        priority: 10, // Default priority
        weight: 1, // Default weight
        costPerEmail: 0.01, // Default cost
        dailyLimit: providerData.dailyLimit || undefined,
        monthlyLimit: providerData.monthlyLimit || undefined,
        region: (providerData as any).region || undefined,
        domain: (providerData as any).domain || undefined,
        serverToken: (providerData as any).serverToken || undefined,
        metadata: providerData.config ? JSON.parse(providerData.config) : undefined
      }

      try {
        await this.registerProvider(config)
      } catch (error) {
        console.error(`Failed to register provider ${providerData.id}:`, error)
      }
    }
  }

  /**
   * Send a single email
   */
  async sendEmail(email: EmailData, options?: SendOptions): Promise<SendResult> {
    const provider = this.selectProvider(options)

    try {
      const result = await provider.sendEmail(email)
      
      // Update provider health on success
      await this.updateProviderHealth(provider.getType(), true)
      
      return result
    } catch (error) {
      // Update provider health on failure
      await this.updateProviderHealth(provider.getType(), false)
      
      // Retry with failover if enabled
      if (options?.retryOnFailure) {
        return await this.retryWithFailover(email, options)
      }
      
      throw error
    }
  }

  /**
   * Send multiple emails in batch
   */
  async sendBatch(emails: EmailData[], options?: SendOptions): Promise<BatchSendResult> {
    const provider = this.selectProvider(options)

    try {
      const result = await provider.sendBatch(emails)
      
      // Update provider health on success
      await this.updateProviderHealth(provider.getType(), true)
      
      return result
    } catch (error) {
      // Update provider health on failure
      await this.updateProviderHealth(provider.getType(), false)
      
      throw error
    }
  }

  /**
   * Select the appropriate provider for sending
   */
  private selectProvider(options?: SendOptions): EmailProvider {
    // Priority: explicit provider > load balancer > default provider
    if (options?.providerId) {
      const provider = this.providers.get(options.providerId)
      if (provider) return provider
    }

    return this.loadBalancer.selectProvider(options)
  }

  /**
   * Retry with failover to backup provider
   */
  private async retryWithFailover(
    email: EmailData,
    options?: SendOptions
  ): Promise<SendResult> {
    const backupProvider = this.failoverManager.selectBackup(options)

    if (!backupProvider) {
      throw new Error('No backup providers available')
    }

    return await backupProvider.sendEmail(email)
  }

  /**
   * Update provider health status
   */
  private async updateProviderHealth(providerType: string, success: boolean): Promise<void> {
    for (const [providerId, health] of Array.from(this.providerHealth.entries())) {
      const provider = this.providers.get(providerId)
      if (!provider || provider.getType() !== providerType) continue

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
      this.providerHealth.set(providerId, health)
    }
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
  }
}

/**
 * Load Balancer Class
 * 
 * Implements various load balancing strategies.
 */
class LoadBalancer {
  private providers: Map<string, EmailProvider>
  private providerConfigs: Map<string, EmailProviderConfig>
  private providerHealth: Map<string, ProviderHealth> = new Map()
  private roundRobinIndex: number = 0

  constructor(
    providers: Map<string, EmailProvider>,
    providerConfigs: Map<string, EmailProviderConfig>
  ) {
    this.providers = providers
    this.providerConfigs = providerConfigs
  }

  selectProvider(options?: SendOptions): EmailProvider {
    const strategy = options?.loadBalanceStrategy || 'round-robin'

    switch (strategy) {
      case 'round-robin':
        return this.roundRobin()
      case 'least-connections':
        return this.leastConnections()
      case 'weighted':
        return this.weighted()
      case 'cost-optimized':
        return this.costOptimized()
      default:
        return this.roundRobin()
    }
  }

  private roundRobin(): EmailProvider {
    const providers = Array.from(this.providers.values())
    
    if (providers.length === 0) {
      throw new Error('No providers available')
    }

    const index = this.roundRobinIndex % providers.length
    this.roundRobinIndex++
    
    return providers[index]
  }

  private leastConnections(): EmailProvider {
    let selectedProvider: EmailProvider | null = null
    let minConnections = Infinity

    for (const [providerId, provider] of Array.from(this.providers)) {
      const health = this.providerHealth.get(providerId)
      if (!health || health.status === 'unhealthy') continue

      const stats = health.stats
      if (stats && stats.totalSent < minConnections) {
        minConnections = stats.totalSent
        selectedProvider = provider
      }
    }

    return selectedProvider ?? Array.from(this.providers.values())[0]!
  }

  private weighted(): EmailProvider {
    const providers = Array.from(this.providers.entries())
    const totalWeight = providers.reduce((sum, [id, _]) => {
      const config = this.providerConfigs.get(id)
      return sum + (config?.weight || 1)
    }, 0)

    let random = Math.random() * totalWeight

    for (const [id, provider] of providers) {
      const config = this.providerConfigs.get(id)
      random -= (config?.weight || 1)
      if (random <= 0) {
        return provider
      }
    }

    return providers[0][1]
  }

  private costOptimized(): EmailProvider {
    let selectedProvider: EmailProvider | null = null
    let minCost = Infinity

    for (const [id, provider] of Array.from(this.providers)) {
      const health = this.providerHealth.get(id)
      if (!health || health.status === 'unhealthy') continue

      const config = this.providerConfigs.get(id)
      if (config && config.costPerEmail < minCost) {
        minCost = config.costPerEmail
        selectedProvider = provider
      }
    }

    return selectedProvider ?? Array.from(this.providers.values())[0]!
  }
}

/**
 * Failover Manager Class
 * 
 * Manages failover to backup providers.
 */
class FailoverManager {
  private providers: Map<string, EmailProvider>
  private providerHealth: Map<string, ProviderHealth>

  constructor(
    providers: Map<string, EmailProvider>,
    providerHealth: Map<string, ProviderHealth>
  ) {
    this.providers = providers
    this.providerHealth = providerHealth
  }

  selectBackup(options?: SendOptions): EmailProvider | null {
    const healthyProviders = Array.from(this.providers.entries())
      .filter(([id]) => this.isProviderHealthy(id))

    return healthyProviders[0]?.[1] || null
  }

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
}
