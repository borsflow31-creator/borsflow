/**
 * AWS SES Email Provider Implementation
 * Uses the SES v2 REST API via fetch (no AWS SDK required).
 * Supports both us-east-1 and custom regions via config.region.
 */

import { EmailProvider, EmailData, SendResult, BatchSendResult, ProviderStats, EmailProviderConfig } from './types'
import { createHmac, createHash } from 'crypto'

export class SESProvider implements EmailProvider {
  private config: EmailProviderConfig
  private region: string

  constructor(config: EmailProviderConfig) {
    this.config = config
    this.region = config.region || 'us-east-1'
  }

  async sendEmail(email: EmailData): Promise<SendResult> {
    try {
      // apiKey format expected: "ACCESS_KEY_ID:SECRET_ACCESS_KEY"
      const [accessKeyId, secretAccessKey] = this.config.apiKey.split(':')
      if (!accessKeyId || !secretAccessKey) {
        throw new Error('SES apiKey must be in format "ACCESS_KEY_ID:SECRET_ACCESS_KEY"')
      }

      const endpoint = `https://email.${this.region}.amazonaws.com/v2/email/outbound-emails`

      const payload = {
        FromEmailAddress: this.config.fromName
          ? `${this.config.fromName} <${this.config.fromEmail}>`
          : this.config.fromEmail,
        Destination: { ToAddresses: [email.to] },
        ReplyToAddresses: email.replyTo || this.config.replyTo ? [email.replyTo || this.config.replyTo!] : undefined,
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: email.html, Charset: 'UTF-8' },
              ...(email.text ? { Text: { Data: email.text, Charset: 'UTF-8' } } : {})
            }
          }
        }
      }

      const body = JSON.stringify(payload)
      const signedHeaders = await this.signRequest('POST', endpoint, body, accessKeyId, secretAccessKey)

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...signedHeaders
        },
        body
      })

      if (!res.ok) {
        let errMsg = `SES API error ${res.status}`
        try {
          const data = await res.json()
          errMsg = data?.message || data?.Message || errMsg
        } catch {}
        throw new Error(errMsg)
      }

      const data = await res.json()
      return {
        success: true,
        messageId: data.MessageId || `ses_${Date.now()}`,
        provider: 'ses',
        timestamp: new Date()
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send email via SES',
        provider: 'ses',
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
    if (!this.config.apiKey || !this.config.apiKey.includes(':')) return false
    if (!this.config.fromEmail) return false
    return true
  }

  getType(): string {
    return 'ses'
  }

  /**
   * AWS Signature V4 signing for SES API requests
   */
  private async signRequest(
    method: string,
    url: string,
    body: string,
    accessKeyId: string,
    secretAccessKey: string
  ): Promise<Record<string, string>> {
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z' // e.g. 20240101T120000Z
    const dateStamp = amzDate.slice(0, 8)

    const urlObj = new URL(url)
    const host = urlObj.host
    const canonicalUri = urlObj.pathname

    const payloadHash = createHash('sha256').update(body).digest('hex')

    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`
    const signedHeaders = 'content-type;host;x-amz-date'

    const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')

    const credentialScope = `${dateStamp}/${this.region}/ses/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n')

    const getSigningKey = (secret: string, date: string, region: string, service: string) => {
      const kDate = createHmac('sha256', `AWS4${secret}`).update(date).digest()
      const kRegion = createHmac('sha256', kDate).update(region).digest()
      const kService = createHmac('sha256', kRegion).update(service).digest()
      return createHmac('sha256', kService).update('aws4_request').digest()
    }

    const signingKey = getSigningKey(secretAccessKey, dateStamp, this.region, 'ses')
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    return {
      'x-amz-date': amzDate,
      Authorization: authHeader
    }
  }
}
