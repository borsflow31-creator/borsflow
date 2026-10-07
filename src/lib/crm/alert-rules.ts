/**
 * The catalogue of automatic alerts for a developer's sales team, and the pure
 * tests that decide when each one fires.
 *
 * Kept free of the database and the clock (the time is always passed in) so every
 * threshold can be proved at, and either side of, its boundary. The service that
 * runs these (services/developer/alerts) only gathers the facts and acts on the
 * answer.
 */

export const ALERT_RULES = [
  'lead_no_response',
  'lead_no_followup',
  'reservation_created',
  'contract_signed',
  'project_behind_target',
  'low_inventory',
  'high_cancellations',
] as const
export type AlertRuleType = (typeof ALERT_RULES)[number]

export function isAlertRuleType(v: unknown): v is AlertRuleType {
  return typeof v === 'string' && (ALERT_RULES as readonly string[]).includes(v)
}

export interface ParamSpec {
  key: string
  min: number
  max: number
  default: number
  unit: 'minutes' | 'days' | 'percent' | 'count'
}

/** The numbers each rule can be tuned by, with the range that is allowed. */
export const RULE_PARAMS: Record<AlertRuleType, readonly ParamSpec[]> = {
  lead_no_response: [{ key: 'minutes', min: 1, max: 1440, default: 15, unit: 'minutes' }],
  lead_no_followup: [{ key: 'days', min: 1, max: 30, default: 2, unit: 'days' }],
  reservation_created: [],
  contract_signed: [],
  project_behind_target: [{ key: 'tolerancePercent', min: 1, max: 90, default: 25, unit: 'percent' }],
  low_inventory: [{ key: 'minAvailablePercent', min: 1, max: 90, default: 10, unit: 'percent' }],
  high_cancellations: [
    { key: 'ratePercent', min: 1, max: 100, default: 20, unit: 'percent' },
    { key: 'minDeals', min: 1, max: 1000, default: 5, unit: 'count' },
  ],
}

export type RuleParams = Record<string, number>

export function defaultParams(type: AlertRuleType): RuleParams {
  return Object.fromEntries(RULE_PARAMS[type].map((p) => [p.key, p.default]))
}

/**
 * Read a rule's saved numbers, falling back to the default for anything missing or
 * out of range. Used on the way out of the database: a bad value that got in some
 * other way (an old row, a hand edit) must not turn an alert into one that fires on
 * everything or on nothing.
 */
export function resolveParams(type: AlertRuleType, saved: unknown): RuleParams {
  const out = defaultParams(type)
  if (!saved || typeof saved !== 'object') return out
  for (const spec of RULE_PARAMS[type]) {
    const v = (saved as Record<string, unknown>)[spec.key]
    if (typeof v === 'number' && Number.isInteger(v) && v >= spec.min && v <= spec.max) out[spec.key] = v
  }
  return out
}

export type ParamsResult = { ok: true; params: RuleParams } | { ok: false; message: string }

/**
 * Check numbers a person has just entered. Strict, unlike resolveParams: an
 * out-of-range value is refused with a message rather than quietly replaced, so
 * what is saved is what the person typed.
 */
export function validateParams(type: AlertRuleType, input: unknown): ParamsResult {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const params: RuleParams = {}
  for (const spec of RULE_PARAMS[type]) {
    const raw = source[spec.key]
    if (raw === undefined || raw === null || raw === '') {
      params[spec.key] = spec.default
      continue
    }
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, message: `${spec.key} must be a whole number` }
    if (n < spec.min || n > spec.max) return { ok: false, message: `${spec.key} must be between ${spec.min} and ${spec.max}` }
    params[spec.key] = n
  }
  return { ok: true, params }
}

const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS

/** How far back the no-response check looks. Older than this is history, not an emergency. */
export const NO_RESPONSE_LOOKBACK_MS = DAY_MS

/**
 * A new buyer lead nobody has contacted after `minutes`. The lookback keeps an old
 * lead that was merely never logged from alerting hours after the fact when the job
 * is switched on.
 */
export function leadNeedsResponseAlert(input: { createdAt: Date; now: Date; minutes: number; hasContact: boolean }): boolean {
  if (input.hasContact) return false
  const age = input.now.getTime() - input.createdAt.getTime()
  return age >= input.minutes * MINUTE_MS && age <= NO_RESPONSE_LOOKBACK_MS
}

/**
 * An open lead that someone owns, with nothing booked and no contact for `days`.
 * Won and lost leads are finished, and an unowned lead has nobody to hand a task to.
 */
export function leadNeedsFollowUp(input: {
  lastTouchAt: Date
  now: Date
  days: number
  hasOpenTask: boolean
  hasOwner: boolean
  finished: boolean
}): boolean {
  if (input.finished || !input.hasOwner || input.hasOpenTask) return false
  return input.now.getTime() - input.lastTouchAt.getTime() >= input.days * DAY_MS
}

/** A project is only judged once enough of its sales window has passed to mean something. */
export const BEHIND_TARGET_MIN_ELAPSED = 0.25

/** The units a project should have sold by `now` on its straight-line plan, rounded for display. */
export function expectedSoldUnits(input: {
  targetUnits: number | null
  launchDate: Date | null
  endDate: Date | null
  now: Date
}): number {
  const { targetUnits, launchDate, endDate, now } = input
  if (!targetUnits || !launchDate || !endDate) return 0
  const window = endDate.getTime() - launchDate.getTime()
  if (window <= 0) return 0
  const elapsed = Math.max(0, Math.min((now.getTime() - launchDate.getTime()) / window, 1))
  return Math.round(targetUnits * elapsed)
}

/**
 * Whether a project is selling slower than its plan.
 *
 * The plan is a straight line from launch to target delivery: at the halfway point
 * half the units should have gone. Selling is lumpy, so it only counts as behind
 * when sold units fall short of that line by more than the tolerance, and not at all
 * in the first quarter of the window, when a single sale swings the picture.
 *
 * Null when the project lacks what the test needs (a target, a launch date or a
 * delivery date after it): it is skipped, never guessed at.
 */
export function projectBehindTarget(input: {
  soldUnits: number
  targetUnits: number | null
  launchDate: Date | null
  endDate: Date | null
  now: Date
  tolerancePercent: number
}): boolean | null {
  const { soldUnits, targetUnits, launchDate, endDate, now, tolerancePercent } = input
  if (!targetUnits || targetUnits <= 0 || !launchDate || !endDate) return null
  const window = endDate.getTime() - launchDate.getTime()
  if (window <= 0) return null

  const elapsed = (now.getTime() - launchDate.getTime()) / window
  if (elapsed < BEHIND_TARGET_MIN_ELAPSED) return false
  const expected = targetUnits * Math.min(elapsed, 1)
  return soldUnits < expected * (1 - tolerancePercent / 100)
}

/**
 * Stock running low: at or under `minPercent` of the project's units still
 * available. A sold-out project is not "low", it is done, so zero does not alert.
 */
export function inventoryLow(input: { available: number; total: number; minPercent: number }): boolean {
  const { available, total, minPercent } = input
  if (total <= 0 || available <= 0) return false
  return (available / total) * 100 <= minPercent
}

/**
 * Too many deals falling through. A deal is a sale or a cancellation; below
 * `minDeals` there is not enough to call a rate, since one cancellation out of two
 * deals is 50% and means nothing.
 */
export function cancellationsHigh(input: { cancellations: number; sold: number; ratePercent: number; minDeals: number }): boolean {
  const deals = input.cancellations + input.sold
  if (deals < input.minDeals || deals === 0) return false
  return (input.cancellations / deals) * 100 >= input.ratePercent
}

// ─── Once-only keys ──────────────────────────────────────────────────────────

/** `2026-W41`: the ISO week of a date, in UTC, so a weekly alert has one key per week. */
export function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  // ISO weeks belong to the year of their Thursday.
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** `2026-10`: the month of a date, so a monthly alert has one key per month. */
export function monthKeyOf(date: Date): string {
  return date.toISOString().slice(0, 7)
}

/** `2026-10-07`: a day, for an alert that may recur daily but not twice in one. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}
