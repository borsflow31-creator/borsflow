/**
 * The project (development) vocabulary, and how its units roll up into the
 * numbers a project dashboard shows.
 *
 * Same convention as lib/crm/lifecycle: plain data and pure functions, no server
 * imports, so the routes, the dashboard and the forms all read one list. Every
 * status is a String column with the allowed values in a schema comment -- no
 * Postgres enums.
 */

// ─── Project ─────────────────────────────────────────────────────────────────

/** Where the development is in its own life, from feasibility to handover. */
export const PROJECT_STATUSES = ['study', 'commercialization', 'construction', 'delivery', 'completed'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_TYPES = ['residential', 'mixed_use', 'commercial', 'subdivision', 'renovation', 'other'] as const
export type ProjectType = (typeof PROJECT_TYPES)[number]

export function isProjectStatus(v: unknown): v is ProjectStatus {
  return typeof v === 'string' && (PROJECT_STATUSES as readonly string[]).includes(v)
}
export function isProjectType(v: unknown): v is ProjectType {
  return typeof v === 'string' && (PROJECT_TYPES as readonly string[]).includes(v)
}

/**
 * Rough progress through the lifecycle, for a bar on the dashboard. It is the
 * status's position, not a construction percentage -- nothing in the data knows
 * how built a building is, and a number that looked like it did would be read as
 * one.
 */
export function projectProgress(status: string): number {
  const index = (PROJECT_STATUSES as readonly string[]).indexOf(status)
  if (index < 0) return 0
  return Math.round((index / (PROJECT_STATUSES.length - 1)) * 100)
}

// ─── Units ───────────────────────────────────────────────────────────────────

/**
 * A unit's commercial state, in the order it moves through.
 *
 * `optioned` is a short hold before a reservation; `contract_signed` and
 * `deed_signed` are the two legal steps of a French sale, and `delivered` is
 * handover.
 */
export const LOT_STATUSES = ['available', 'optioned', 'reserved', 'contract_signed', 'deed_signed', 'delivered'] as const
export type LotStatus = (typeof LOT_STATUSES)[number]

export function isLotStatus(v: unknown): v is LotStatus {
  return typeof v === 'string' && (LOT_STATUSES as readonly string[]).includes(v)
}

/**
 * The three buckets a project dashboard reports, and which unit statuses fall in
 * each.
 *
 * Six statuses collapse into three because that is the question being asked --
 * what can still be sold, what is committed but not final, and what is money in.
 * An option is grouped with a reservation rather than with available stock: the
 * unit cannot be sold to anyone else while it is held, so counting it as
 * available would overstate what a sales team can offer.
 *
 * Deliberately exhaustive over LotStatus, so adding a status without deciding
 * which bucket it belongs to is a type error rather than a silently wrong total.
 */
export const UNIT_BUCKETS = {
  available: ['available'],
  reserved: ['optioned', 'reserved'],
  sold: ['contract_signed', 'deed_signed', 'delivered'],
} as const satisfies Record<string, readonly LotStatus[]>

export type UnitBucket = keyof typeof UNIT_BUCKETS

export function bucketForLotStatus(status: string): UnitBucket | null {
  for (const [bucket, statuses] of Object.entries(UNIT_BUCKETS)) {
    if ((statuses as readonly string[]).includes(status)) return bucket as UnitBucket
  }
  return null
}

export interface UnitTotals {
  total: number
  available: number
  reserved: number
  sold: number
  /** Sum of every unit's price, whatever its status: what the project is worth built out. */
  totalValue: number
  /** Price of the units still on offer, which is what a sales team can still bring in. */
  availableValue: number
  soldValue: number
}

/** Roll a project's units up into the dashboard's numbers. */
export function summarizeUnits(
  lots: readonly { status: string; totalPrice?: number | null; basePrice?: number | null }[]
): UnitTotals {
  const totals: UnitTotals = {
    total: lots.length,
    available: 0,
    reserved: 0,
    sold: 0,
    totalValue: 0,
    availableValue: 0,
    soldValue: 0,
  }

  for (const lot of lots) {
    // totalPrice is base plus tax and is what a buyer pays; it is kept in step
    // with basePrice on write, but fall back in case a row predates that.
    const price = lot.totalPrice ?? lot.basePrice ?? 0
    totals.totalValue += price

    const bucket = bucketForLotStatus(lot.status)
    if (!bucket) continue
    totals[bucket] += 1
    if (bucket === 'available') totals.availableValue += price
    else if (bucket === 'sold') totals.soldValue += price
  }

  return totals
}

// ─── Project media ───────────────────────────────────────────────────────────

/**
 * What a project can carry. Wider than a listing's: a development is sold off
 * plan, so renders, drone progress shots and the quarterly report a promoter owes
 * its buyers are all part of the record.
 */
export const PROGRAM_MEDIA_KINDS = ['photo', 'drone', '3d_render', 'plan', 'quarterly_report', 'video', 'document'] as const
export type ProgramMediaKind = (typeof PROGRAM_MEDIA_KINDS)[number]

export function isProgramMediaKind(v: unknown): v is ProgramMediaKind {
  return typeof v === 'string' && (PROGRAM_MEDIA_KINDS as readonly string[]).includes(v)
}

/** Kinds stored as an uploaded file. Video is here and in the link list both. */
export const PROGRAM_FILE_MEDIA_KINDS: readonly ProgramMediaKind[] = [
  'photo', 'drone', '3d_render', 'plan', 'quarterly_report', 'video', 'document',
]
/** Kinds that may instead be a link to someone else's host. */
export const PROGRAM_LINK_MEDIA_KINDS: readonly ProgramMediaKind[] = ['video']

/**
 * Which storage rules a project media kind borrows.
 *
 * A project has seven kinds but only three sets of rules about bytes, and those
 * rules live once in lib/crm/media-storage keyed by the listing's vocabulary. A
 * drone shot is a photo as far as storage is concerned; a brochure is a floor
 * plan (image or PDF). Mapping here keeps one copy of the allow-lists instead of
 * a second, drifting set for projects.
 */
export function storageKindFor(kind: string): 'photo' | 'floorplan' | 'video' {
  if (kind === 'video') return 'video'
  if (kind === 'photo' || kind === 'drone' || kind === '3d_render') return 'photo'
  // plan, quarterly_report, document: an image or the PDF it arrived as.
  return 'floorplan'
}

/** Kinds shown as one gallery each, in the order a developer thinks about them. */
export const PROGRAM_MEDIA_GROUPS: readonly ProgramMediaKind[] = [
  'photo', '3d_render', 'drone', 'video', 'plan', 'document', 'quarterly_report',
]

/** The cover can only be an image; a PDF has no thumbnail to show. */
export function canBeCover(kind: string): boolean {
  return kind === 'photo' || kind === 'drone' || kind === '3d_render'
}
