import { encrypt, decrypt } from '@/lib/encryption'

/**
 * Email provider API keys at rest.
 *
 * Keys used to be stored in plaintext in EmailProvider.apiKey (the
 * apiKeyEncrypted column was never used), and with row-level security off on the
 * database they were readable through the public REST API. They are now
 * encrypted with the same helper that protects Stripe keys and OAuth tokens.
 */

// The list lives in provider-types.ts, which imports nothing, so the browser can
// read it too; re-exported here because this is where callers expect it.
export { SUPPORTED_PROVIDER_TYPES, isSupportedProviderType, type SupportedProviderType } from './provider-types'

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
