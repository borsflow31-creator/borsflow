/**
 * SMTP Email Provider Implementation
 *
 * Sends through the workspace's own mail server with nodemailer. The settings
 * come off EmailProviderConfig, which loadProviders fills from the row's
 * `config` JSON; the password is the decrypted `apiKey`, because `config` is
 * returned to the browser unmasked.
 *
 * Unlike the API providers there is no webhook: the only delivery signal is what
 * the server says at send time. A permanent rejection is reported as such so the
 * queue can record the bounce instead of retrying it three times.
 */

import { EmailProvider, EmailData, SendResult, BatchSendResult, ProviderStats, EmailProviderConfig } from './types'
import { createSmtpTransport, checkSmtpTarget, type SmtpSettings } from '../smtp'

/** A 5xx reply means this address will never accept the message. */
export function isPermanentSmtpFailure(error: unknown): boolean {
  const code = Number((error as { responseCode?: unknown })?.responseCode)
  return Number.isFinite(code) && code >= 500 && code < 600
}

export class SmtpProvider implements EmailProvider {
  private config: EmailProviderConfig
  private sent = 0
  private lastUsedAt = new Date()

  constructor(config: EmailProviderConfig) {
    this.config = config
  }

  private settings(): SmtpSettings {
    const { smtpHost, smtpPort, smtpSecure, smtpUser, apiKey } = this.config
    if (!smtpHost || !smtpPort) throw new Error('This SMTP provider has no server address configured')
    return {
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465 ? true : Boolean(smtpSecure),
      user: smtpUser || '',
      password: apiKey || '',
    }
  }

  async sendEmail(email: EmailData): Promise<SendResult> {
    let transport: Awaited<ReturnType<typeof createSmtpTransport>> | null = null
    try {
      const settings = this.settings()
      // Re-checked per send, not only when saved: DNS can be repointed at a
      // private address long after the provider row was created.
      const rejection = await checkSmtpTarget(settings.host, settings.port)
      if (rejection) throw new Error(rejection)

      const fromName = email.fromName || this.config.fromName
      transport = await createSmtpTransport(settings)
      const info = await transport.sendMail({
        from: fromName ? `${fromName} <${this.config.fromEmail}>` : this.config.fromEmail,
        to: email.to,
        subject: email.subject,
        html: email.html,
        ...(email.text ? { text: email.text } : {}),
        ...(email.replyTo || this.config.replyTo ? { replyTo: email.replyTo || this.config.replyTo } : {}),
        ...(email.attachments?.length
          ? {
              attachments: email.attachments.map(a => ({
                filename: a.filename,
                content: a.content,
                ...(a.contentType ? { contentType: a.contentType } : {}),
              })),
            }
          : {}),
      })

      // A server can accept the envelope and reject one recipient; with a single
      // recipient per send, that is a failure, not a success.
      if (info.rejected?.length) {
        throw Object.assign(new Error(info.response || `The server rejected ${email.to}`), { responseCode: 550 })
      }

      this.sent += 1
      this.lastUsedAt = new Date()
      return {
        success: true,
        messageId: info.messageId || '',
        provider: 'smtp',
        timestamp: new Date(),
      }
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Failed to send through the SMTP server',
        permanent: isPermanentSmtpFailure(error),
        provider: 'smtp',
        timestamp: new Date(),
      }
    } finally {
      transport?.close()
    }
  }

  async sendBatch(emails: EmailData[]): Promise<BatchSendResult> {
    const results = await Promise.allSettled(emails.map(email => this.sendEmail(email)))
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    return { total: emails.length, successful, failed: emails.length - successful, results }
  }

  /** SMTP reports nothing after the handshake, so only what we sent is known. */
  async getStats(): Promise<ProviderStats> {
    return {
      totalSent: this.sent,
      totalDelivered: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalBounced: 0,
      averageDeliveryTime: 0,
      lastUsedAt: this.lastUsedAt,
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      const { verifySmtpConnection } = await import('../smtp')
      const result = await verifySmtpConnection(this.settings())
      return result.success
    } catch {
      return false
    }
  }

  getType(): string {
    return 'smtp'
  }
}
