import { DEVELOPER_STAGE_LOST } from './lifecycle'

/**
 * How warm a lead is, 0-100, from what is known about them.
 *
 * Pure, so it can be recomputed on every write and tested without a database.
 * The point is to put the people most worth calling at the top of a list, not to
 * predict anything: every component is something a salesperson can see and
 * change, and the breakdown is returned so the card can say why a lead scores
 * what it does.
 *
 * Points (they add to 100):
 *   contactable  up to 20  a phone number, an email address, 10 each
 *   budget       15        a budget is recorded
 *   project      up to 15  a project of interest (10) and a unit type (5)
 *   source       up to 15  how strong the channel is at producing buyers
 *   stage        up to 25  how far along the board they are
 *   recency      up to 10  last contacted within a week (10) or a month (5)
 *
 * A lead on the lost stage scores 0, so lost leads sink below live ones.
 */

export interface LeadScoreInput {
  email?: string | null
  phone?: string | null
  budgetMin?: number | null
  budgetMax?: number | null
  interestedProgramId?: string | null
  interestedTypology?: string | null
  source?: string | null
  stage: string
  /** The board's stages in order, so progress can be read from position. */
  stages: readonly string[]
  lastContactedAt?: Date | null
  now?: Date
}

export type ScoreBreakdown = {
  contactable: number
  budget: number
  project: number
  source: number
  stage: number
  recency: number
}

/**
 * Walk-ins and referrals arrive intending to buy; paid social is the broadest and
 * weakest net. Unknown sources get the floor rather than nothing, so a lead with
 * a free-text source is not punished for it.
 */
const SOURCE_POINTS: Record<string, number> = {
  walk_in: 15,
  referral: 15,
  broker: 13,
  event: 12,
  phone: 12,
  website: 10,
  whatsapp: 10,
  portal: 8,
  google_ads: 8,
  facebook: 6,
  instagram: 6,
}
const SOURCE_FLOOR = 3

const DAY_MS = 24 * 60 * 60 * 1000

export function scoreLead(input: LeadScoreInput): { score: number; breakdown: ScoreBreakdown } {
  const now = input.now ?? new Date()
  const zero: ScoreBreakdown = { contactable: 0, budget: 0, project: 0, source: 0, stage: 0, recency: 0 }

  if (input.stage === DEVELOPER_STAGE_LOST) return { score: 0, breakdown: zero }

  const contactable = (input.phone?.trim() ? 10 : 0) + (input.email?.trim() ? 10 : 0)

  const budget =
    (input.budgetMin ?? 0) > 0 || (input.budgetMax ?? 0) > 0 ? 15 : 0

  const project = (input.interestedProgramId ? 10 : 0) + (input.interestedTypology?.trim() ? 5 : 0)

  const sourceKey = input.source?.trim().toLowerCase() ?? ''
  const source = sourceKey ? SOURCE_POINTS[sourceKey] ?? SOURCE_FLOOR : 0

  // Position among the live stages: first is 0, last is full marks. A stage the
  // board does not know (renamed, or a board that is not the buyer-sales one)
  // earns nothing rather than guessing.
  const live = input.stages.filter((s) => s !== DEVELOPER_STAGE_LOST)
  const index = live.indexOf(input.stage)
  const stage = index < 0 || live.length < 2 ? 0 : Math.round((index / (live.length - 1)) * 25)

  let recency = 0
  if (input.lastContactedAt) {
    const age = now.getTime() - input.lastContactedAt.getTime()
    recency = age <= 7 * DAY_MS ? 10 : age <= 30 * DAY_MS ? 5 : 0
  }

  const breakdown: ScoreBreakdown = { contactable, budget, project, source, stage, recency }
  const score = Math.min(100, contactable + budget + project + source + stage + recency)
  return { score, breakdown }
}
