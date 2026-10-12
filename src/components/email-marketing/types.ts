/**
 * The shapes the email marketing page and its tabs pass between each other,
 * mirroring the Prisma models the API returns.
 *
 * They live here rather than in page.tsx so a tab component can be imported by
 * the page without the page having to be imported back for its types.
 */


export interface EmailCampaign {
  id: string
  name: string
  description?: string
  type: string
  status: string
  subject: string
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  bouncedCount: number
  scheduledAt?: string
  createdAt: string
}

export interface EmailTemplate {
  id: string
  name: string
  description?: string
  type: string
  subject: string
  htmlContent?: string
  textContent?: string
  variables?: string
  tags?: string
  isDefault: boolean
  isActive: boolean
  createdAt: string
}

export interface SegmentationRule {
  id: string
  name: string
  description?: string
  isActive: boolean
  estimatedSize?: number
  createdAt: string
}

export interface EmailProvider {
  id: string
  name: string
  type: string
  fromEmail: string
  isActive: boolean
  isDefault: boolean
  dailyLimit?: number
  // Bounce/complaint webhook BorsFlow sets up on the provider account by itself
  webhookStatus?: 'active' | 'error' | 'unsupported' | 'waiting_public_url' | null
  webhookError?: string | null
}

export interface EmailAutomation {
  id: string
  name: string
  description?: string
  type: string
  status: string
  totalEnrolled: number
  activeEnrolled: number
  completedCount: number
  triggers: Array<{ id: string; type: string; conditions: string; isActive: boolean }>
  steps: Array<{ id: string; order: number; name: string; delayMinutes: number; templateId?: string | null; template?: { id: string; name: string } | null }>
  createdAt: string
  updatedAt: string
}
