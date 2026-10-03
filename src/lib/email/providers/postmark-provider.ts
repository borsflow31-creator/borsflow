/**
 * Postmark Email Provider Implementation
 * Uses the Postmark REST API via fetch.
 * config.serverToken — Postmark Server API Token (overrides apiKey if set)
 * config.apiKey      — fallback, also accepted as the Server API Token
 */

import { EmailProvider, EmailData, SendResult, BatchSendResult, ProviderStats, EmailProviderConfig } from './types'

const POSTMARK_API_URL = 'https://api.postmarkapp.com/email'

export class PostmarkProvider implements EmailProvider {
  private config: EmailProviderConfig

  constructor(config: EmailProviderConfig) {
    this.config = config
  }

  private get serverToken(): string {
    return this.config.serverToken || this.config.apiKey || ''
  }

  async sendEmail(email: EmailData): Promise<SendResult> {
    try {
      if (!this.serverToken) throw new Error('Postmark server token is not configured')

      const payload: Record<string, any> = {
        From: email.fromName || this.config.fromName
          ? `${email.fromName || this.config.fromName} <${this.config.fromEmail}>`
          : this.config.fromEmail,
        To: email.to,
        Subject: email.subject,
        HtmlBody: email.html,
        MessageStream: 'outbound'
      }

      if (email.text) payload.TextBody = email.text
      if (email.attachments?.length) {
        payload.Attachments = email.attachments.map(a => ({
          Name: a.filename,
          Content: a.content.toString('base64'),
          ContentType: a.contentType || 'application/octet-stream'
        }))
      }
      const replyTo = email.replyTo || this.config.replyTo
      if (replyTo) payload.ReplyTo = replyTo
      if (email.metadata) {
        payload.Metadata = Object.fromEntries(
          Object.entries(email.metadata).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)])
        )
      }

      const res = await fetch(POSTMARK_API_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': this.serverToken
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok || data.ErrorCode) {
        throw new Error(data.Message || `Postmark API error ${res.status}`)
      }

      return {
        success: true,
        messageId: data.MessageID || `postmark_${Date.now()}`,
        provider: 'postmark',
        timestamp: new Date()
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send email via Postmark',
        provider: 'postmark',
        timestamp: new Date()
      }
    }
  }

  async sendBatch(emails: EmailData[]): Promise<BatchSendResult> {
    // Postmark supports batch up to 500 per request
    try {
      const messages = emails.map(email => ({
        From: this.config.fromName ? `${this.config.fromName} <${this.config.fromEmail}>` : this.config.fromEmail,
        To: email.to,
        Subject: email.subject,
        HtmlBody: email.html,
        ...(email.text ? { TextBody: email.text } : {}),
        ...(email.replyTo || this.config.replyTo ? { ReplyTo: email.replyTo || this.config.replyTo } : {}),
        MessageStream: 'outbound'
      }))

      const res = await fetch('https://api.postmarkapp.com/email/batch', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': this.serverToken
        },
        body: JSON.stringify(messages)
      })

      const data = await res.json()
      const batchResults: Array<PromiseSettledResult<SendResult>> = (Array.isArray(data) ? data : []).map((item: any) => ({
        status: item.ErrorCode ? 'rejected' : 'fulfilled',
        value: item.ErrorCode
          ? undefined
          : { success: true, messageId: item.MessageID, provider: 'postmark', timestamp: new Date() },
        reason: item.ErrorCode ? new Error(item.Message) : undefined
      } as any))

      return {
        total: emails.length,
        successful: batchResults.filter(r => r.status === 'fulfilled').length,
        failed: batchResults.filter(r => r.status === 'rejected').length,
        results: batchResults
      }
    } catch {
      // Fallback to individual sends
      const results = await Promise.allSettled(emails.map(e => this.sendEmail(e)))
      return {
        total: emails.length,
        successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
        failed: results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length,
        results
      }
    }
  }

  async getStats(): Promise<ProviderStats> {
    return { totalSent: 0, totalDelivered: 0, totalOpened: 0, totalClicked: 0, totalBounced: 0, averageDeliveryTime: 0, lastUsedAt: new Date() }
  }

  async validateConfig(): Promise<boolean> {
    if (!this.serverToken) return false
    if (!this.config.fromEmail) return false
    return true
  }

  getType(): string {
    return 'postmark'
  }
}
