/**
 * Which email provider types the sender can actually deliver through.
 *
 * Kept apart from provider-keys.ts, which imports the encryption helper and so
 * cannot be pulled into a client component: this list is needed in the browser
 * too (the document "send from" picker), and it must be one list. A second copy
 * went stale the moment a type was added, and the picker then hid a sender that
 * could in fact send.
 *
 * `smtp` is the workspace's own mail server: its password is stored in the
 * encrypted `apiKey` column like an API key, and its host/port/user in the
 * row's `config` JSON.
 */

export const SUPPORTED_PROVIDER_TYPES = [
  'resend',
  'sendgrid',
  'ses',
  'mailgun',
  'postmark',
  'brevo',
  'smtp',
] as const

export type SupportedProviderType = (typeof SUPPORTED_PROVIDER_TYPES)[number]

export function isSupportedProviderType(type: unknown): type is SupportedProviderType {
  return typeof type === 'string' && (SUPPORTED_PROVIDER_TYPES as readonly string[]).includes(type)
}
