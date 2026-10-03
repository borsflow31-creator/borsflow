/**
 * Mailgun Email Provider Implementation
 * Uses the Mailgun REST API v3 via fetch.
 * config.domain  — your Mailgun sending domain (e.g. mg.example.com)
 * config.region  — "eu" for EU endpoint, anything else → US endpoint
 * config.apiKey  — Mailgun private API key (starts with "key-…")
 */

import { EmailProvider, EmailData, SendResult, BatchSendResult, ProviderStats, EmailProviderConfig } from './types'

export class MailgunProvider implements EmailProvider {
  private config: EmailProviderConfig

  constructor(config: EmailProviderConfig) {
    this.config = config
  }

  private get apiBase(): string {
    const isEU = this.config.region?.toLowerCase() === 'eu'
    return isEU ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3'
  }

  private get domain(): string {
    return this.config.domain || ''
  }

  async sendEmail(email: EmailData): Promise<SendResult> {
    try {
      if (!this.domain) throw new Error('Mailgun domain is not configured')

      const formData = new URLSearchParams()
      const fromName = email.fromName || this.config.fromName
      formData.append('from', fromName ? `${fromName} <${this.config.fromEmail}>` : this.config.fromEmail)
      formData.append('to', email.to)
      formData.append('subject', email.subject)
      formData.append('html', email.html)
      if (email.text) formData.append('text', email.text)
      const replyTo = email.replyTo || this.config.replyTo
      if (replyTo) formData.append('h:Reply-To', replyTo)
      if (email.metadata) {
        for (const [k, v] of Object.entries(email.metadata)) {
          if (v != null) formData.append(`v:${k}`, String(v))
        }
      }

      const credentials = Buffer.from(`api:${this.config.apiKey}`).toString('base64')

      // Files need multipart/form-data; fetch sets that content type (with its
      // boundary) itself when given a FormData body.
      let body: string | FormData = formData.toString()
      const headers: Record<string, string> = { Authorization: `Basic ${credentials}` }
      if (email.attachments?.length) {
        const multipart = new FormData()
        formData.forEach((value, key) => multipart.append(key, value))
        for (const a of email.attachments) {
          multipart.append('attachment', new Blob([new Uint8Array(a.content)], { type: a.contentType || 'application/octet-stream' }), a.filename)
        }
        body = multipart
      } else {
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
      }

      const res = await fetch(`${this.apiBase}/${this.domain}/messages`, {
        method: 'POST',
        headers,
        body
      })

      if (!res.ok) {
        let errMsg = `Mailgun API error ${res.status}`
        try {
          const data = await res.json()
          errMsg = data?.message || errMsg
        } catch {}
        throw new Error(errMsg)
      }

      const data = await res.json()
      return {
        success: true,
        messageId: data.id || `mailgun_${Date.now()}`,
        provider: 'mailgun',
        timestamp: new Date()
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send email via Mailgun',
        provider: 'mailgun',
        timestamp: new Date()
      }
    }
  }

  async sendBatch(emails: EmailData[]): Promise<BatchSendResult> {
    const results = await Promise.allSettled(emails.map(e => this.sendEmail(e)))
    return {
      total: emails.length,
      successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
      failed: results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length,
      results
    }
  }

  async getStats(): Promise<ProviderStats> {
    return { totalSent: 0, totalDelivered: 0, totalOpened: 0, totalClicked: 0, totalBounced: 0, averageDeliveryTime: 0, lastUsedAt: new Date() }
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey) return false
    if (!this.domain) return false
    if (!this.config.fromEmail) return false
    return true
  }

  getType(): string {
    return 'mailgun'
  }
}
