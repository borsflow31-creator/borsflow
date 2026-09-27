/**
 * Retired shared sendgrid webhook address.
 *
 * It was verified with one platform-wide secret that no client's account uses,
 * and applied every event to every workspace. Each email provider connected in
 * BorsFlow now gets its own webhook, created on the client's account when they
 * save it: /api/email-marketing/webhooks/<providerId>.
 */
import { retiredWebhook } from '@/lib/email/retired-webhook'

export const POST = retiredWebhook
