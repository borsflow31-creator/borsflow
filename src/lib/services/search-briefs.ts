import { prisma } from '@/lib/prisma'
import { isWorkspaceMember } from '@/lib/crm/access'
import { matchBriefToProperties, recordMatches } from '@/lib/crm/matching'
import { PROPERTY_TYPES, TRANSACTION_TYPES, VERDICT_DIMENSIONS } from '@/lib/crm/lifecycle'
import { leadBelongsToWorkspace } from '@/lib/api/workspace'
import { ServiceError } from './errors'
import { createInterest } from './interests'
import { defined, has, readBoolean, readEnum, readId, readNumber, readString } from './parse'

type Input = Record<string, unknown>

export interface BriefContext {
  workspaceId: string
  userId: string
}

const MAX_BRIEFS_PER_LEAD = 20
const MAX_SET = 30

/** A list of short strings, stored as JSON; null/[] clears it. */
function readList(input: Input, key: string, label: string): string | null | undefined {
  if (!has(input, key)) return undefined
  const raw = input[key]
  if (raw === null) return null
  if (!Array.isArray(raw)) throw new ServiceError(`${label} must be a list`)
  const items = Array.from(new Set(raw.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean)))
  if (items.length > MAX_SET) throw new ServiceError(`${label} can have at most ${MAX_SET} entries`)
  if (items.some(v => v.length > 100)) throw new ServiceError(`${label} entries are too long`)
  return items.length ? JSON.stringify(items) : null
}

function readCriteria(input: Input): string | null | undefined {
  if (!has(input, 'criteria')) return undefined
  const raw = input.criteria
  if (raw === null) return null
  const valid = Array.isArray(raw) && raw.length <= 20 && raw.every((c: any) => c && typeof c.field === 'string' && typeof c.operator === 'string')
  if (!valid) throw new ServiceError('Criteria must be a list of conditions, each with a field and an operator')
  return raw.length ? JSON.stringify(raw) : null
}

function parseFields(input: Input, mode: 'create' | 'update') {
  const data: Record<string, unknown> = {
    name: readString(input, 'name', 'Name', { max: 120, required: mode === 'create' }),
    notes: readString(input, 'notes', 'Notes', { max: 2000 }),
    isActive: readBoolean(input, 'isActive', 'Active'),
    notifyByEmail: readBoolean(input, 'notifyByEmail', 'Notify by email'),
    transactionType: readEnum(input, 'transactionType', 'Transaction type', TRANSACTION_TYPES),
    logicOperator: readEnum(input, 'logicOperator', 'Logic operator', ['AND', 'OR'] as const),
    priceMin: readNumber(input, 'priceMin', 'Minimum price', { min: 0 }),
    priceMax: readNumber(input, 'priceMax', 'Maximum price', { min: 0 }),
    surfaceMin: readNumber(input, 'surfaceMin', 'Minimum surface', { min: 0 }),
    bedroomsMin: readNumber(input, 'bedroomsMin', 'Minimum bedrooms', { min: 0, integer: true }),
    roomsMin: readNumber(input, 'roomsMin', 'Minimum rooms', { min: 0, integer: true }),
    propertyTypes: readList(input, 'propertyTypes', 'Property types'),
    cities: readList(input, 'cities', 'Cities'),
    districts: readList(input, 'districts', 'Districts'),
    criteria: readCriteria(input),
  }
  for (const key of ['mustHaveParking', 'mustHaveElevator', 'mustHaveGarden', 'mustHaveTerrace', 'mustHaveBalcony']) {
    data[key] = readBoolean(input, key, key)
  }

  const types = data.propertyTypes ? (JSON.parse(data.propertyTypes as string) as string[]) : []
  if (types.some(t => !(PROPERTY_TYPES as readonly string[]).includes(t))) {
    throw new ServiceError(`Property types must be among: ${PROPERTY_TYPES.join(', ')}`)
  }
  if (typeof data.priceMin === 'number' && typeof data.priceMax === 'number' && data.priceMin > data.priceMax) {
    throw new ServiceError('The minimum price cannot be more than the maximum')
  }
  return defined(data)
}

const briefInclude = {
  lead: { select: { id: true, firstName: true, lastName: true, email: true } },
  owner: { select: { id: true, name: true, email: true } },
} as const

/**
 * Register what a buyer is looking for. Saving a brief also checks it against the
 * stock that is already live, so a buyer who registers today hears about the
 * three flats that fit as well as the ones listed tomorrow; the matches wait for
 * the digest cron to mail them rather than going out inside this request.
 */
export async function createBrief(ctx: BriefContext, input: Input) {
  const leadId = readId(input, 'leadId', 'Buyer')
  if (!leadId) throw new ServiceError('Buyer is required')
  if (!(await leadBelongsToWorkspace(leadId, ctx.workspaceId))) throw new ServiceError('Buyer not found in this workspace')
  if ((await prisma.searchBrief.count({ where: { leadId } })) >= MAX_BRIEFS_PER_LEAD) {
    throw new ServiceError(`A buyer can have at most ${MAX_BRIEFS_PER_LEAD} search briefs`)
  }

  const ownerId = readId(input, 'ownerId', 'Agent')
  if (ownerId && !(await isWorkspaceMember(ctx.workspaceId, ownerId))) throw new ServiceError('The agent must be a member of this workspace')

  const fields = parseFields(input, 'create')
  const brief = await prisma.searchBrief.create({
    data: {
      ...(fields as { name: string }),
      workspaceId: ctx.workspaceId,
      leadId,
      ownerId: ownerId ?? ctx.userId,
      createdById: ctx.userId,
    },
    include: briefInclude,
  })

  const { matched } = await refreshBriefMatches(brief.id)
  return { brief, matched }
}

export async function updateBrief(id: string, ctx: BriefContext, input: Input) {
  const current = await prisma.searchBrief.findUnique({ where: { id }, select: { id: true, workspaceId: true } })
  if (!current || current.workspaceId !== ctx.workspaceId) throw new ServiceError('Search brief not found', 404)

  const ownerId = readId(input, 'ownerId', 'Agent')
  if (ownerId && !(await isWorkspaceMember(ctx.workspaceId, ownerId))) throw new ServiceError('The agent must be a member of this workspace')

  const data: Record<string, unknown> = parseFields(input, 'update')
  if (ownerId !== undefined) data.ownerId = ownerId

  const brief = await prisma.searchBrief.update({ where: { id }, data, include: briefInclude })
  const { matched } = await refreshBriefMatches(id)
  return { brief, matched }
}

/** Match a brief against live stock and record anything new. Idempotent. */
export async function refreshBriefMatches(briefId: string): Promise<{ matched: number }> {
  const brief = await prisma.searchBrief.findUnique({ where: { id: briefId }, select: { id: true, workspaceId: true, leadId: true, ownerId: true } })
  if (!brief) return { matched: 0 }

  const found = await matchBriefToProperties(briefId)
  let created = 0
  // Grouped by property because recordMatches works one property at a time.
  for (const m of found) {
    const { created: n } = await recordMatches(
      { id: m.propertyId, workspaceId: brief.workspaceId },
      [{ searchBriefId: brief.id, leadId: brief.leadId, ownerId: brief.ownerId, score: m.score, reasons: m.reasons }],
      'new'
    )
    created += n
  }
  return { matched: created }
}

/**
 * Turn a match into an interest. A match never becomes one by itself -- that would
 * fill the buyer board with speculation -- so this is the agent's decision.
 *
 * The interest records which brief found it and how well the property fit, and the
 * match records the interest it became: attribution is captured at the moment it
 * happens, not reconstructed later.
 */
export async function convertMatch(matchId: string, ctx: BriefContext) {
  const match = await prisma.propertyMatch.findUnique({
    where: { id: matchId },
    include: { searchBrief: { select: { ownerId: true } } },
  })
  if (!match || match.workspaceId !== ctx.workspaceId) throw new ServiceError('Match not found', 404)

  let interestId: string
  try {
    const interest = await createInterest(ctx, {
      leadId: match.leadId,
      propertyId: match.propertyId,
      source: 'match',
      searchBriefId: match.searchBriefId,
      matchScore: match.score,
      ownerId: match.searchBrief.ownerId ?? undefined,
    })
    interestId = interest.id
  } catch (error) {
    // The buyer is already attached to this property: link the match to it.
    if (!(error instanceof ServiceError && error.status === 409)) throw error
    const existing = await prisma.interest.findUniqueOrThrow({
      where: { propertyId_leadId: { propertyId: match.propertyId, leadId: match.leadId } },
      select: { id: true },
    })
    interestId = existing.id
  }

  return prisma.propertyMatch.update({
    where: { id: matchId },
    data: { status: 'converted', interestId },
  })
}

export async function dismissMatch(matchId: string, ctx: BriefContext) {
  const result = await prisma.propertyMatch.updateMany({
    where: { id: matchId, workspaceId: ctx.workspaceId, status: { not: 'converted' } },
    data: { status: 'dismissed', dismissedAt: new Date() },
  })
  if (result.count === 0) throw new ServiceError('Match not found, or already turned into an interest', 404)
}

/**
 * What a buyer's viewings have told us, aggregated.
 *
 * Structured feedback refines a brief twice over: the agent sees where the buyer's
 * taste differs from what they wrote down, and the price verdicts suggest a ceiling.
 * It only ever *suggests*: rewriting a buyer's stated budget from a heuristic would
 * be the system overruling the buyer.
 */
export async function briefInsights(leadId: string) {
  const feedback = await prisma.viewingFeedback.findMany({
    where: { leadId, attended: true },
    select: {
      interestLevel: true, priceVerdict: true, conditionVerdict: true, locationVerdict: true, layoutVerdict: true,
      property: { select: { id: true, title: true, price: true, city: true } },
    },
  })

  const verdicts = Object.fromEntries(
    VERDICT_DIMENSIONS.map(d => [d, { negative: 0, neutral: 0, positive: 0 }])
  ) as Record<string, { negative: number; neutral: number; positive: number }>
  const levels: number[] = []
  const tooExpensive: number[] = []

  for (const f of feedback) {
    if (f.interestLevel != null) levels.push(f.interestLevel)
    for (const d of VERDICT_DIMENSIONS) {
      const v = f[`${d}Verdict` as keyof typeof f] as 'negative' | 'neutral' | 'positive' | null
      if (v) verdicts[d][v]++
    }
    if (f.priceVerdict === 'negative' && f.property.price > 0) tooExpensive.push(f.property.price)
  }

  return {
    viewings: feedback.length,
    averageInterest: levels.length ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10 : null,
    verdicts,
    // Below the cheapest property the buyer called too expensive.
    suggestion: tooExpensive.length ? { priceMax: Math.min(...tooExpensive) - 1 } : null,
  }
}
