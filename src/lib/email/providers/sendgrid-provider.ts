/**
 * SendGrid Email Provider Implementation
 * Uses the @sendgrid/mail package via the fetch-based REST API
 * (no npm package required — pure HTTP calls to avoid install issues).
 */

import { EmailProvider, EmailData, SendResult, BatchSendResult, ProviderStats, EmailProviderConfig } from './types'

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send'

export class SendGridProvider implements EmailProvider {
  private config: EmailProviderConfig

  constructor(config: EmailProviderConfig) {
    this.config = config
  }

  async sendEmail(email: EmailData): Promise<SendResult> {
    try {
      const payload = {
        personalizations: [
          {
            to: [{ email: email.to }],
            ...(email.metadata ? { custom_args: Object.fromEntries(Object.entries(email.metadata).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)])) } : {})
          }
        ],
        from: email.fromName || this.config.fromName
          ? { email: this.config.fromEmail, name: email.fromName || this.config.fromName }
          : { email: this.config.fromEmail },
        ...(email.replyTo || this.config.replyTo
          ? { reply_to: { email: email.replyTo || this.config.replyTo! } }
          : {}),
        subject: email.subject,
        content: [
          ...(email.text ? [{ type: 'text/plain', value: email.text }] : []),
          { type: 'text/html', value: email.html }
        ],
        ...(email.attachments?.length
          ? {
              attachments: email.attachments.map(a => ({
                content: a.content.toString('base64'),
                filename: a.filename,
                type: a.contentType || 'application/octet-stream',
                disposition: 'attachment'
              }))
            }
          : {})
      }

      const res = await fetch(SENDGRID_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        let errMsg = `SendGrid API error ${res.status}`
        try {
          const body = await res.json()
          const errors = body?.errors
          if (Array.isArray(errors) && errors.length > 0) {
            errMsg = errors.map((e: any) => e.message).join('; ')
          }
        } catch {}
        throw new Error(errMsg)
      }

      // SendGrid returns 202 with no body; message-id is in the response header
      const messageId = res.headers.get('X-Message-Id') || `sg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

      return {
        success: true,
        messageId,
        provider: 'sendgrid',
        timestamp: new Date()
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send email via SendGrid',
        provider: 'sendgrid',
        timestamp: new Date()
      }
    }
  }

  async sendBatch(emails: EmailData[]): Promise<BatchSendResult> {
    const results = await Promise.allSettled(emails.map(email => this.sendEmail(email)))
    return {
      total: emails.length,
      successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
      failed: results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length,
      results
    }
  }

  async getStats(): Promise<ProviderStats> {
    return {
      totalSent: 0,
      totalDelivered: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalBounced: 0,
      averageDeliveryTime: 0,
      lastUsedAt: new Date()
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      if (!this.config.apiKey || this.config.apiKey.length < 20) return false
      if (!this.config.fromEmail || !this.isValidEmail(this.config.fromEmail)) return false
      return true
    } catch {
      return false
    }
  }

  getType(): string {
    return 'sendgrid'
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }
}
