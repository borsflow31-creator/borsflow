/**
 * Legacy resend webhook URL, retired along with the shared
 * /api/email-marketing/webhooks/resend address it forwarded to. Each connected
 * email provider now gets its own webhook: /api/email-marketing/webhooks/<providerId>.
 */
import { retiredWebhook } from '@/lib/email/retired-webhook'

export const POST = retiredWebhook
