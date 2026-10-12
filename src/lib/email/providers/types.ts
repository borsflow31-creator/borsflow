/**
 * Email Provider Types
 */

export interface EmailProvider {
  sendEmail(email: EmailData): Promise<SendResult>
  sendBatch(emails: EmailData[]): Promise<BatchSendResult>
  getStats(): Promise<ProviderStats>
  validateConfig(): Promise<boolean>
  getType(): string
}

export interface EmailData {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  /** Display name for this one email, overriding the provider's configured name. */
  fromName?: string
  metadata?: Record<string, any>
  /** Files such as a quote/invoice PDF. Buffers; each provider encodes them as its API needs. */
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>
}

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
  /**
   * The failure will never succeed on a retry: the recipient was rejected
   * outright (an SMTP 5xx). The queue suppresses the address instead of backing
   * off and trying twice more.
   */
  permanent?: boolean
  provider: string
  timestamp: Date
}

export interface BatchSendResult {
  total: number
  successful: number
  failed: number
  results: Array<PromiseSettledResult<SendResult>>
}

export interface ProviderStats {
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  averageDeliveryTime: number
  lastUsedAt: Date
}

export interface EmailProviderConfig {
  id: string
  type: 'sendgrid' | 'ses' | 'resend' | 'mailgun' | 'postmark' | 'brevo' | 'smtp'
  /** The API key, or for `smtp` the mailbox password. */
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
  /**
   * `smtp` only, read out of the row's `config` JSON by loadProviders. The
   * password is not here: it is `apiKey`, which the API masks, while `config`
   * goes to the browser as it is.
   */
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpUser?: string
  metadata?: Record<string, any>
}

export interface SendOptions {
  providerId?: string
  retryOnFailure?: boolean
  priority?: number
  loadBalanceStrategy?: 'round-robin' | 'least-connections' | 'weighted' | 'cost-optimized'
}

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  failureCount: number
  lastFailure: Date | null
  cooldownPeriod: number
  lastChecked: Date
  stats?: ProviderStats
}
