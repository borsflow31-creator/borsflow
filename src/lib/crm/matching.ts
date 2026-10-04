import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notifications/notify'
import { scoreBriefAgainstProperty, type MatchReason } from '@/lib/crm/brief-scoring'

/**
 * New-listing matching: the inverse of a segment. A segment evaluates one rule's
 * criteria against every lead; this evaluates every buyer's brief against one new
 * property.
 *
 * It deliberately does not touch segments. Matching reads SearchBrief, so a listing
 * going live never triggers a segment refresh -- there is no per-event path that
 * wants one, which is the structural answer to "do not recompute a workspace's
 * segments on a write".
 */

export interface BriefMatch {
  searchBriefId: string
  leadId: string
  ownerId: string | null
  score: number
  reasons: MatchReason[]
}

export type ListingEvent = 'new' | 'price_drop'

/**
 * Briefs worth scoring for a property: a SQL prefilter on the indexed bands, so a
 * listing never loads every brief in the workspace. It only discards briefs that
 * cannot match (price outside the band, a must-have the property lacks); the exact
 * answer is scoreBriefAgainstProperty's, which re-checks everything.
 */
export async function matchPropertyToBriefs(propertyId: string): Promise<BriefMatch[]> {
  const property = await prisma.property.findUnique({ where: { id: propertyId } })
  if (!property || !['live'].includes(property.status)) return []

  const and: Prisma.SearchBriefWhereInput[] = [
    { OR: [{ priceMin: null }, { priceMin: { lte: property.price } }] },
    { OR: [{ priceMax: null }, { priceMax: { gte: property.price } }] },
  ]
  // A requirement the property has no value for cannot be met.
  and.push(property.surfaceArea != null ? { OR: [{ surfaceMin: null }, { surfaceMin: { lte: property.surfaceArea } }] } : { surfaceMin: null })
  and.push(property.bedrooms != null ? { OR: [{ bedroomsMin: null }, { bedroomsMin: { lte: property.bedrooms } }] } : { bedroomsMin: null })
  and.push(property.rooms != null ? { OR: [{ roomsMin: null }, { roomsMin: { lte: property.rooms } }] } : { roomsMin: null })
  if (!property.hasParking) and.push({ mustHaveParking: false })
  if (!property.hasElevator) and.push({ mustHaveElevator: false })
  if (!property.hasGarden) and.push({ mustHaveGarden: false })
  if (!property.hasTerrace) and.push({ mustHaveTerrace: false })
  if (!property.hasBalcony) and.push({ mustHaveBalcony: false })

  const briefs = await prisma.searchBrief.findMany({
    where: {
      workspaceId: property.workspaceId,
      isActive: true,
      transactionType: property.transactionType,
      AND: and,
    },
  })

  const matches: BriefMatch[] = []
  for (const brief of briefs) {
    const result = scoreBriefAgainstProperty(brief, property)
    if (!result) continue
    matches.push({ searchBriefId: brief.id, leadId: brief.leadId, ownerId: brief.ownerId, score: result.score, reasons: result.reasons })
  }
  return matches.sort((a, b) => b.score - a.score)
}

/** The other direction: live properties that fit one brief, best first. For a brief that was just saved. */
export async function matchBriefToProperties(briefId: string, limit = 50) {
  const brief = await prisma.searchBrief.findUnique({ where: { id: briefId } })
  if (!brief || !brief.isActive) return []

  const properties = await prisma.property.findMany({
    where: {
      workspaceId: brief.workspaceId,
      status: 'live',
      transactionType: brief.transactionType,
      ...(brief.priceMax != null ? { price: { lte: brief.priceMax, gt: 0 } } : {}),
    },
    orderBy: { listedAt: 'desc' },
    take: 500,
  })

  const out: { propertyId: string; score: number; reasons: MatchReason[] }[] = []
  for (const property of properties) {
    const result = scoreBriefAgainstProperty(brief, property)
    if (result) out.push({ propertyId: property.id, ...result })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}

/** Persist matches. Re-running for the same property is a no-op for rows that exist. */
export async function recordMatches(
  property: { id: string; workspaceId: string },
  matches: BriefMatch[],
  event: ListingEvent
): Promise<{ created: number }> {
  if (matches.length === 0) return { created: 0 }

  const result = await prisma.propertyMatch.createMany({
    data: matches.map(m => ({
      workspaceId: property.workspaceId,
      propertyId: property.id,
      searchBriefId: m.searchBriefId,
      leadId: m.leadId,
      score: m.score,
      reasons: m.reasons as unknown as Prisma.InputJsonValue,
    })),
    // The unique (propertyId, searchBriefId) is the whole idempotence mechanism.
    skipDuplicates: true,
  })

  // A price drop is news to a buyer who dismissed the property, but it never
  // re-creates a match that was already delivered: the buyer is not told twice.
  if (event === 'price_drop') {
    await prisma.propertyMatch.updateMany({
      where: { propertyId: property.id, status: 'dismissed', searchBriefId: { in: matches.map(m => m.searchBriefId) } },
      data: { status: 'new', dismissedAt: null },
    })
  }

  await prisma.searchBrief.updateMany({
    where: { id: { in: matches.map(m => m.searchBriefId) } },
    data: { lastMatchedAt: new Date(), matchCount: { increment: 1 } },
  })

  return { created: result.count }
}

/**
 * A listing went live, or its price dropped. Find the buyers it suits, record the
 * matches, and alert the agents holding those buyers.
 *
 * The buyers themselves are NOT mailed from here. A vendor bulk-loading thirty
 * flats must not send one buyer thirty emails, so the buyer-facing mail is a
 * digest sent by the property-matches cron from the rows recorded here.
 *
 * Never throws: it runs after the user's own action, and a matching failure must
 * not fail it.
 */
export async function onPropertyListed(propertyId: string, event: ListingEvent): Promise<number> {
  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, workspaceId: true, title: true, ownerId: true, price: true, workspace: { select: { ownerId: true } } },
    })
    if (!property) return 0

    const matches = await matchPropertyToBriefs(propertyId)
    if (matches.length === 0) return 0

    const { created } = await recordMatches(property, matches, event)

    // Agents: whoever holds a matching buyer, whoever holds the listing, else the
    // owner of the workspace so the alert is never dropped.
    const recipients = Array.from(
      new Set([...matches.map(m => m.ownerId), property.ownerId].filter((id): id is string => !!id))
    )
    if (recipients.length === 0) recipients.push(property.workspace.ownerId)

    void notify({
      recipients,
      type: 'crm.property_matched',
      workspaceId: property.workspaceId,
      title: `${matches.length} buyer${matches.length === 1 ? '' : 's'} match ${property.title}`,
      href: `/properties/${property.id}?tab=matches`,
      // A price drop is a new event for the same property.
      dedupeKey: `property.matched:${property.id}:${event}:${property.price}`,
    })

    return created
  } catch (error) {
    console.error('[matching] onPropertyListed failed:', error)
    return 0
  }
}
