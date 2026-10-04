/**
 * Does a property fit a buyer's brief, and how well?
 *
 * Pure: no prisma, so it can be exercised without a database and called from the
 * matcher, the agent's "matches for this brief" view and the tests alike.
 *
 * Matching is two-stage. The caller (src/lib/crm/matching.ts) uses SQL to prefilter
 * briefs by the indexable bands so a new listing never loads every brief in the
 * workspace; this function is the exact test and the score for the survivors. It
 * re-checks the bands as well, because the prefilter is an optimisation and the
 * answer must not depend on it.
 *
 * The long tail of a brief -- anything the form has no field for -- is the
 * `criteria` list, evaluated with the same matchesCriteria the segment builder
 * uses. That is the point of the evaluator being subject-agnostic: a brief's
 * criteria read a property's row exactly as a segment's read a lead's.
 */

import { matchesCriteria, parseJson, type Criteria } from '@/lib/crm/criteria'

/** The brief columns scoring reads. A SearchBrief row satisfies this. */
export interface BriefLike {
  transactionType: string
  priceMin?: number | null
  priceMax?: number | null
  surfaceMin?: number | null
  bedroomsMin?: number | null
  roomsMin?: number | null
  mustHaveParking?: boolean
  mustHaveElevator?: boolean
  mustHaveGarden?: boolean
  mustHaveTerrace?: boolean
  mustHaveBalcony?: boolean
  propertyTypes?: string | null
  cities?: string | null
  districts?: string | null
  criteria?: string | null
  logicOperator?: string
}

/** The property columns scoring reads. */
export interface PropertyLike {
  transactionType: string
  propertyType: string
  price: number
  city: string
  district?: string | null
  surfaceArea?: number | null
  bedrooms?: number | null
  rooms?: number | null
  hasParking?: boolean
  hasElevator?: boolean
  hasGarden?: boolean
  hasTerrace?: boolean
  hasBalcony?: boolean
  [key: string]: unknown
}

/** Why a property scored what it did. `key` is an i18n key under realEstate.matches.reasons. */
export interface MatchReason {
  key: 'price_fit' | 'location' | 'type' | 'size' | 'must_haves'
  weight: number
}

export interface MatchResult {
  /** 0..100 */
  score: number
  reasons: MatchReason[]
}

/** Weights sum to 100. */
const WEIGHTS = { price_fit: 40, location: 20, type: 10, size: 20, must_haves: 10 } as const

const lower = (v: unknown) => String(v ?? '').trim().toLowerCase()

/** A JSON array of strings column, lower-cased; empty means "no restriction". */
export function readSet(raw: string | null | undefined): string[] {
  return parseJson<unknown[]>(raw, []).filter((v): v is string => typeof v === 'string' && v.trim() !== '').map(lower)
}

/**
 * Score a property against a brief, or return null when it does not fit.
 *
 * A property that fails any stated requirement is not a weak match, it is no
 * match: showing a buyer a 4-bedroom brief's 2-bedroom flat at a lower score
 * would just be noise. The score only ranks properties that already fit.
 */
export function scoreBriefAgainstProperty(brief: BriefLike, property: PropertyLike): MatchResult | null {
  if (brief.transactionType !== property.transactionType) return null

  // ── Hard requirements ────────────────────────────────────────────────────
  const price = property.price
  if (brief.priceMax != null && !(price > 0 && price <= brief.priceMax)) return null
  if (brief.priceMin != null && price < brief.priceMin) return null

  if (brief.surfaceMin != null && !(property.surfaceArea != null && property.surfaceArea >= brief.surfaceMin)) return null
  if (brief.bedroomsMin != null && !(property.bedrooms != null && property.bedrooms >= brief.bedroomsMin)) return null
  if (brief.roomsMin != null && !(property.rooms != null && property.rooms >= brief.roomsMin)) return null

  const musts: [boolean | undefined, boolean | undefined][] = [
    [brief.mustHaveParking, property.hasParking],
    [brief.mustHaveElevator, property.hasElevator],
    [brief.mustHaveGarden, property.hasGarden],
    [brief.mustHaveTerrace, property.hasTerrace],
    [brief.mustHaveBalcony, property.hasBalcony],
  ]
  if (musts.some(([wanted, has]) => wanted && !has)) return null

  const types = readSet(brief.propertyTypes)
  if (types.length > 0 && !types.includes(lower(property.propertyType))) return null

  const cities = readSet(brief.cities)
  if (cities.length > 0 && !cities.includes(lower(property.city))) return null

  const districts = readSet(brief.districts)
  if (districts.length > 0 && !districts.includes(lower(property.district))) return null

  // The long tail, through the one shared evaluator.
  const criteria = parseJson<Criteria[]>(brief.criteria, [])
  if (criteria.length > 0 && !matchesCriteria(property, criteria, brief.logicOperator === 'OR' ? 'OR' : 'AND')) return null

  // ── Score: only ranks properties that already fit ────────────────────────
  const reasons: MatchReason[] = []
  const add = (key: MatchReason['key'], fraction: number) => {
    const weight = Math.round(WEIGHTS[key] * Math.max(0, Math.min(1, fraction)))
    if (weight > 0) reasons.push({ key, weight })
  }

  // Price: a listing well inside the budget is a better fit than one at the ceiling.
  if (brief.priceMax != null) {
    const ratio = price / brief.priceMax
    add('price_fit', ratio <= 0.85 ? 1 : 1 - ((ratio - 0.85) / 0.15) * 0.5)
  } else {
    add('price_fit', 0.5) // no budget stated: neutral
  }

  // Location: naming a city and getting it is worth more than not caring; a
  // matching district on top is better still.
  if (cities.length > 0) add('location', districts.length > 0 ? 1 : 0.75)
  else add('location', 0.5)

  add('type', types.length > 0 ? 1 : 0.5)

  // Size: headroom over the stated minimums.
  const headroom: number[] = []
  if (brief.surfaceMin != null && property.surfaceArea != null) headroom.push(property.surfaceArea >= brief.surfaceMin * 1.2 ? 1 : 0.6)
  if (brief.bedroomsMin != null && property.bedrooms != null) headroom.push(property.bedrooms > brief.bedroomsMin ? 1 : 0.6)
  add('size', headroom.length ? headroom.reduce((a, b) => a + b, 0) / headroom.length : 0.5)

  add('must_haves', musts.some(([wanted]) => wanted) ? 1 : 0.5)

  const score = Math.round(reasons.reduce((sum, r) => sum + r.weight, 0))
  return { score: Math.min(100, score), reasons }
}
