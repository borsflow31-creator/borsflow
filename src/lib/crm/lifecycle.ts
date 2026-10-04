/**
 * The real-estate vocabulary: statuses, types, default boards, and how a board
 * column relates to a record's lifecycle.
 *
 * Pure data and small pure functions, no server imports, so API routes, the
 * boards and the forms all read the same lists. Every status is a plain String
 * column in the database with the allowed values listed in a schema comment (the
 * house convention: no Postgres enums), so these arrays are where that list is
 * actually enforced.
 */

// ─── Property ────────────────────────────────────────────────────────────────

/** Lifecycle, independent of any buyer. */
export const PROPERTY_STATUSES = [
  'prospect', 'valuation', 'mandate', 'live', 'under_offer', 'sold', 'withdrawn', 'expired',
] as const
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number]

export const PROPERTY_TYPES = ['apartment', 'house', 'land', 'commercial', 'parking', 'building', 'other'] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]

/** Sale-first: 'rent' exists so rental is additive later, nothing implements tenancy. */
export const TRANSACTION_TYPES = ['sale', 'rent'] as const

export const ENERGY_RATINGS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const

/** On the market: buyers can see it and make offers. */
export const ON_MARKET_STATUSES: readonly PropertyStatus[] = ['live', 'under_offer']

/** A deal that is over, one way or another. Frees plan capacity. */
export const CLOSED_PROPERTY_STATUSES: readonly PropertyStatus[] = ['sold', 'withdrawn', 'expired']

export function isPropertyStatus(v: unknown): v is PropertyStatus {
  return typeof v === 'string' && (PROPERTY_STATUSES as readonly string[]).includes(v)
}
export function isPropertyType(v: unknown): v is PropertyType {
  return typeof v === 'string' && (PROPERTY_TYPES as readonly string[]).includes(v)
}

export const MEDIA_KINDS = ['photo', 'floorplan', 'video', 'virtual_tour'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]
/** Kinds stored as a file; the rest are a link to somewhere else. */
export const FILE_MEDIA_KINDS: readonly MediaKind[] = ['photo', 'floorplan']
export function isMediaKind(v: unknown): v is MediaKind {
  return typeof v === 'string' && (MEDIA_KINDS as readonly string[]).includes(v)
}

// ─── Mandate ─────────────────────────────────────────────────────────────────

export const MANDATE_TYPES = ['simple', 'exclusive', 'semi_exclusive'] as const
export const MANDATE_STATUSES = ['draft', 'active', 'expired', 'terminated', 'completed'] as const
export type MandateStatus = (typeof MANDATE_STATUSES)[number]
export const FEE_TYPES = ['percent', 'fixed'] as const
export const FEE_PAYERS = ['vendor', 'buyer', 'shared'] as const

/** "Expiring soon" in the renewal work queue. */
export const MANDATE_EXPIRY_WINDOW_DAYS = 30

export function isMandateStatus(v: unknown): v is MandateStatus {
  return typeof v === 'string' && (MANDATE_STATUSES as readonly string[]).includes(v)
}

// ─── Interest ────────────────────────────────────────────────────────────────

/** Outcome of the buyer's pursuit of this property, not its position in the funnel. */
export const INTEREST_STATUSES = ['active', 'won', 'lost', 'on_hold'] as const
export type InterestStatus = (typeof INTEREST_STATUSES)[number]
export const INTEREST_SOURCES = ['manual', 'enquiry', 'portal', 'match', 'walk_in', 'referral'] as const
export function isInterestStatus(v: unknown): v is InterestStatus {
  return typeof v === 'string' && (INTEREST_STATUSES as readonly string[]).includes(v)
}

// ─── Offer ───────────────────────────────────────────────────────────────────

export const OFFER_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn', 'expired'] as const
export type OfferStatus = (typeof OFFER_STATUSES)[number]
/** Terminal: an offer in one of these can no longer be decided. */
export const DECIDED_OFFER_STATUSES: readonly OfferStatus[] = ['accepted', 'rejected', 'withdrawn', 'expired']
export const OFFER_CONDITION_TYPES = ['finance', 'survey', 'chain', 'other'] as const
export const FINANCING_TYPES = ['cash', 'mortgage', 'mixed'] as const

export interface OfferCondition {
  type: (typeof OFFER_CONDITION_TYPES)[number]
  note: string
}

// ─── Viewing feedback ────────────────────────────────────────────────────────

/** The same three-point scale for every dimension, so they compare and aggregate. */
export const VERDICTS = ['negative', 'neutral', 'positive'] as const
export type Verdict = (typeof VERDICTS)[number]
export const VERDICT_DIMENSIONS = ['price', 'condition', 'location', 'layout'] as const
export type VerdictDimension = (typeof VERDICT_DIMENSIONS)[number]
export function isVerdict(v: unknown): v is Verdict {
  return typeof v === 'string' && (VERDICTS as readonly string[]).includes(v)
}

// ─── Default boards ──────────────────────────────────────────────────────────

export interface DefaultPipeline {
  name: string
  subjectType: 'Lead' | 'Interest' | 'Property'
  stages: string[]
}

/**
 * The three boards every agency has, seeded on workspace creation and by the
 * 20261007070000 migration for workspaces that already existed.
 *
 * Owner acquisition and the buyer journey are different funnels with different
 * stages, owners and KPIs, so they are different pipelines rather than one with
 * a flag. Contacts is the pre-property qualification board: a lead is an enquiry
 * until a property is attached, and Lead needs a pipeline to live on.
 *
 * Stage names are workspace data (an agency renames them), so they are stored in
 * English and are not i18n keys.
 */
export const DEFAULT_PIPELINES: readonly DefaultPipeline[] = [
  {
    name: 'Contacts',
    subjectType: 'Lead',
    stages: ['New', 'Contacted', 'Qualified', 'Nurturing', 'Lost'],
  },
  {
    name: 'Buyer journey',
    subjectType: 'Interest',
    stages: ['Enquiry', 'Qualified', 'Brief recorded', 'Viewing booked', 'Viewing done', 'Offer', 'Under contract', 'Closed'],
  },
  {
    name: 'Owner / mandate',
    subjectType: 'Property',
    stages: ['Prospect', 'Valuation booked', 'Valuation done', 'Mandate signed', 'Live', 'Under offer', 'Sold'],
  },
]

// ─── Stages ──────────────────────────────────────────────────────────────────

/** Parse Pipeline.stages, which is stored as a JSON string. Never throws. */
export function parseStages(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

/**
 * Find the stage in a pipeline that a caller means by `name`, ignoring case.
 *
 * Stage names are workspace data, so code must not assume a spelling: an agency
 * may have renamed "Under contract" or deleted it. Returns null when the pipeline
 * has no such stage, and callers leave the record where it is rather than
 * inventing a column that does not exist.
 */
export function resolveStage(stages: string[], name: string): string | null {
  const wanted = name.trim().toLowerCase()
  return stages.find(s => s.trim().toLowerCase() === wanted) ?? null
}

/** The stages the seeded interest board uses when something must move a buyer on. */
export const INTEREST_STAGE = {
  enquiry: 'Enquiry',
  viewingBooked: 'Viewing booked',
  viewingDone: 'Viewing done',
  offer: 'Offer',
  underContract: 'Under contract',
} as const

// ─── Property: board column <-> lifecycle ────────────────────────────────────

/**
 * A property has both a lifecycle `status` (coarse, fixed vocabulary, what
 * queries and rules read) and a board `stage` (workspace-named, what the agent
 * drags). They describe the same thing at different resolutions, so for the
 * stage names the product seeds they are kept in step in both directions. A stage
 * the agency invented maps to nothing: moving a card there leaves the status
 * alone.
 */
const STAGE_TO_STATUS: Record<string, PropertyStatus> = {
  'prospect': 'prospect',
  'valuation booked': 'valuation',
  'valuation done': 'valuation',
  'mandate signed': 'mandate',
  'live': 'live',
  'under offer': 'under_offer',
  'sold': 'sold',
}

const STATUS_TO_STAGE: Partial<Record<PropertyStatus, string>> = {
  prospect: 'Prospect',
  valuation: 'Valuation booked',
  mandate: 'Mandate signed',
  live: 'Live',
  under_offer: 'Under offer',
  sold: 'Sold',
}

/** The lifecycle status a board column implies, or null for a column we do not know. */
export function statusForStage(stage: string): PropertyStatus | null {
  return STAGE_TO_STATUS[stage.trim().toLowerCase()] ?? null
}

/**
 * The column a property should sit in after its status changed, or null when it
 * should stay put: the current column already implies the new status (so a card in
 * "Valuation done" is not yanked back to "Valuation booked"), or the pipeline has
 * no column for it, or the status (withdrawn, expired) has no column.
 */
export function stageForStatus(stages: string[], status: PropertyStatus, currentStage: string): string | null {
  if (statusForStage(currentStage) === status) return null
  const preferred = STATUS_TO_STAGE[status]
  return preferred ? resolveStage(stages, preferred) : null
}

// ─── Days on market ──────────────────────────────────────────────────────────

/** Whole days since a property went live; null if it never has. */
export function daysOnMarket(listedAt: Date | string | null | undefined, now = new Date()): number | null {
  if (!listedAt) return null
  const start = listedAt instanceof Date ? listedAt : new Date(listedAt)
  if (Number.isNaN(start.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000))
}
