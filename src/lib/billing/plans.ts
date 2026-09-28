/**
 * Plan definitions: the single source of truth for prices and limits.
 *
 * Pure data with no server imports, so the pricing page and the API routes read
 * the same numbers. Pricing is flat per workspace - there is no per-user price
 * anywhere, and member caps only exist so a 500-person company does not pay the
 * small-team price.
 *
 * `null` means unlimited.
 */

// Mirrors the Prisma `PlanTier` enum; kept as a string union so this file can be
// imported from client components.
export type PlanTier = 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE'

// Monthly counters only. Storage is a running total, not a monthly count, and
// would overflow UsageCounter's Int column in bytes, so it is metered elsewhere.
export type UsageMetric = 'ai_credits' | 'email_sends' | 'invoices'

export interface PlanLimits {
  /** Invited members, not counting the owner. */
  maxMembers: number | null
  maxGuests: number | null
  crmContacts: number | null
  pipelines: number | null
  invoicesPerMonth: number | null
  emailSendsPerMonth: number | null
  emailAutomations: number | null
  storageGb: number | null
  aiCreditsPerMonth: number | null
  /** Fee taken on invoice payments collected through Stripe Connect. */
  paymentFeePercent: number
}

export interface PlanDefinition {
  tier: PlanTier
  name: string
  tagline: string
  /** USD per workspace per month; null = custom quote. */
  priceMonthly: number | null
  /** USD per workspace per month when billed yearly. */
  priceYearly: number | null
  highlighted?: boolean
  limits: PlanLimits
  /** Short lines for the pricing card, beyond the numeric limits. */
  features: string[]
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  FREE: {
    tier: 'FREE',
    name: 'Free',
    tagline: 'Everything a small team needs to run on BorsFlow.',
    priceMonthly: 0,
    priceYearly: 0,
    limits: {
      maxMembers: 5,
      maxGuests: 5,
      crmContacts: 500,
      pipelines: 1,
      invoicesPerMonth: 10,
      emailSendsPerMonth: 500,
      emailAutomations: 0,
      storageGb: 2,
      aiCreditsPerMonth: 200,
      paymentFeePercent: 1.5,
    },
    features: [
      'Unlimited pages and docs',
      'CRM, quotes and invoices',
      'Team chat and scheduling',
      'AI assistant included',
    ],
  },
  STARTER: {
    tier: 'STARTER',
    name: 'Starter',
    tagline: 'For growing teams and freelancers who bill clients.',
    priceMonthly: 19,
    priceYearly: 15,
    limits: {
      maxMembers: 10,
      maxGuests: 20,
      crmContacts: 5_000,
      pipelines: 5,
      invoicesPerMonth: null,
      emailSendsPerMonth: 5_000,
      emailAutomations: 3,
      storageGb: 25,
      aiCreditsPerMonth: 3_000,
      paymentFeePercent: 0.75,
    },
    features: [
      'Unlimited quotes and invoices',
      'Your logo on quotes and invoices',
      'All calendar and video integrations',
      'Email support',
    ],
  },
  PRO: {
    tier: 'PRO',
    name: 'Pro',
    tagline: 'The whole business OS for a team of up to 25.',
    priceMonthly: 49,
    priceYearly: 39,
    highlighted: true,
    limits: {
      maxMembers: 25,
      maxGuests: null,
      crmContacts: 25_000,
      pipelines: null,
      invoicesPerMonth: null,
      emailSendsPerMonth: 25_000,
      emailAutomations: null,
      storageGb: 100,
      aiCreditsPerMonth: 15_000,
      paymentFeePercent: 0.25,
    },
    features: [
      'Unlimited email automations',
      'AI agents and automations',
      'Page-level permissions',
      '1-year page history',
    ],
  },
  BUSINESS: {
    tier: 'BUSINESS',
    name: 'Business',
    tagline: 'No payment fees and unlimited AI for larger teams.',
    priceMonthly: 99,
    priceYearly: 79,
    limits: {
      maxMembers: 75,
      maxGuests: null,
      crmContacts: null,
      pipelines: null,
      invoicesPerMonth: null,
      emailSendsPerMonth: 100_000,
      emailAutomations: null,
      storageGb: 500,
      // "Unlimited" on the pricing page; this is the fair-use ceiling.
      aiCreditsPerMonth: 100_000,
      paymentFeePercent: 0,
    },
    features: [
      '0% fee on invoice payments',
      'Unlimited AI (fair use)',
      'Custom domain and white-label client portal',
      'Audit log and priority support',
    ],
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'SSO, SLAs and custom limits.',
    priceMonthly: null,
    priceYearly: null,
    limits: {
      maxMembers: null,
      maxGuests: null,
      crmContacts: null,
      pipelines: null,
      invoicesPerMonth: null,
      emailSendsPerMonth: null,
      emailAutomations: null,
      storageGb: null,
      aiCreditsPerMonth: null,
      paymentFeePercent: 0,
    },
    features: [
      'SSO/SAML and SCIM',
      'Dedicated models and data residency',
      'Dedicated manager and SLA',
      'Full white-label',
    ],
  },
}

export const PLAN_ORDER: PlanTier[] = ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']

/**
 * Tiers a visitor can register interest in: the paid tiers while only Free is
 * available, and Enterprise always (it is sales-led).
 */
export const WAITLIST_TIERS: PlanTier[] = ['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']

/** Members each purchased pack adds on top of the plan's cap. */
export const MEMBER_PACK_SIZE = 10

/** Discount promised to beta testers and waitlist sign-ups, locked for life. */
export const FOUNDING_DISCOUNT_PERCENT = 30

/**
 * Paid checkout is off until this is `true`. While off, paid tiers show
 * "Coming soon" and only the Free plan can be used.
 */
export const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true'

export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === 'string' && (PLAN_ORDER as string[]).includes(value)
}

export function metricLimit(limits: PlanLimits, metric: UsageMetric): number | null {
  switch (metric) {
    case 'ai_credits':
      return limits.aiCreditsPerMonth
    case 'email_sends':
      return limits.emailSendsPerMonth
    case 'invoices':
      return limits.invoicesPerMonth
  }
}
