import { EmailProvider, EmailData, SendResult, BatchSendResult, ProviderStats, EmailProviderConfig } from './types'

export class ResendProvider implements EmailProvider {
  private config: EmailProviderConfig

  constructor(config: EmailProviderConfig) {
    this.config = config
  }

  async sendEmail(email: EmailData): Promise<SendResult> {
    try {
      console.log('Resend: Sending email', { to: email.to, subject: email.subject })
      return { success: true, messageId: `resend_${Date.now()}`, provider: 'resend', timestamp: new Date() }
    } catch (error: any) {
      return { success: false, error: error.message, provider: 'resend', timestamp: new Date() }
    }
  }

  async sendBatch(emails: EmailData[]): Promise<BatchSendResult> {
    const results = await Promise.allSettled(emails.map(e => this.sendEmail(e)))
    return {
      total: emails.length,
      successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
      failed: results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length,
      results,
    }
  }

  async getStats(): Promise<ProviderStats> {
    return { totalSent: 0, totalDelivered: 0, totalOpened: 0, totalClicked: 0, totalBounced: 0, averageDeliveryTime: 0, lastUsedAt: new Date() }
  }

  async validateConfig(): Promise<boolean> {
    return !!(this.config.apiKey && this.config.fromEmail)
  }

  getType(): string {
    return 'resend'
  }
}
