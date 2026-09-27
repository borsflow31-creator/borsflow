import { encrypt, decrypt } from '@/lib/encryption'

/**
 * Email provider API keys at rest.
 *
 * Keys used to be stored in plaintext in EmailProvider.apiKey (the
 * apiKeyEncrypted column was never used), and with row-level security off on the
 * database they were readable through the public REST API. They are now
 * encrypted with the same helper that protects Stripe keys and OAuth tokens.
 */

/** Provider types the sender can actually deliver through. */
export const SUPPORTED_PROVIDER_TYPES = ['resend', 'sendgrid', 'ses', 'mailgun', 'postmark', 'brevo'] as const

export function isSupportedProviderType(type: unknown): boolean {
  return typeof type === 'string' && (SUPPORTED_PROVIDER_TYPES as readonly string[]).includes(type)
}

export function sealApiKey(plain: string): string {
  return encrypt(plain)
}

/**
 * Plaintext key for sending. Rows saved before encryption hold the key as-is,
 * which decrypt() rejects, so those fall back to the raw value.
 */
export function revealApiKey(stored: string | null | undefined): string {
  if (!stored) return ''
  try {
    return decrypt(stored)
  } catch {
    return stored
  }
}

/** `****1234` from a stored (encrypted or legacy plaintext) key. */
export function maskStoredApiKey(stored: string | null | undefined): string {
  const plain = revealApiKey(stored)
  return plain ? `****${plain.slice(-4)}` : ''
}
