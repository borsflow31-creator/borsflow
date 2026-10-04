/**
 * Email Segmentation Service
 *
 * Manages subject segmentation logic and segment member management for targeted
 * email marketing campaigns.
 *
 * A segment is derived, not stored: a rule holds criteria, and materializing it
 * evaluates those criteria against every row of the rule's subject type,
 * replacing SegmentMember. The evaluator itself lives in src/lib/crm/criteria.ts
 * and the per-subject row loading in src/lib/crm/subject-registry.ts, so a
 * segment over interests or mandates needs no code here beyond its loader.
 */

import { prisma } from '@/lib/prisma'
import { matchesCriteria, parseJson, type Criteria } from '@/lib/crm/criteria'
import { asSubjectType, contactLeadIdFor, type SubjectType } from '@/lib/crm/subjects'
import { loaderFor, type SubjectLoader } from '@/lib/crm/subject-registry'

// Re-exported because the automation engine and the segment routes import the
// criteria shape from here, and it is the same shape the builder produces.
export type { Criteria }

/** How many members to write per insert when materializing a large segment. */
const MEMBER_INSERT_CHUNK = 1000

// Segment rule structure
export interface SegmentRule {
  id: string
  name: string
  description?: string
  workspaceId: string
  subjectType: SubjectType
  criteria: Criteria[]
  logicOperator: 'AND' | 'OR'
  isActive: boolean
  estimatedSize?: number
  lastCalculated?: Date
  tags?: string[]
}

// Segment member structure
export interface SegmentMember {
  id: string
  segmentationRuleId: string
  subjectType: SubjectType
  subjectId: string
  /** The contact this membership mails; null for subjects with none (Property). */
  leadId: string | null
  matchedAt: Date
  score?: number
}

// Segment statistics structure
export interface SegmentStatistics {
  totalMembers: number
  averageScore: number
  scoreDistribution: Record<string, number>
  topPerformers: Array<{ subjectType: SubjectType; subjectId: string; score: number }>
}


/** Shape a SegmentationRule row the way callers of this service expect. */
function toSegmentRule(rule: {
  id: string
  name: string
  description: string | null
  workspaceId: string
  subjectType: string
  criteria: string
  logicOperator: string
  isActive: boolean
  estimatedSize: number | null
  lastCalculated: Date | null
  tags: string | null
}): SegmentRule {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description || undefined,
    workspaceId: rule.workspaceId,
    subjectType: asSubjectType(rule.subjectType),
    // Malformed criteria used to throw out of whichever route read the rule.
    criteria: parseJson<Criteria[]>(rule.criteria, []),
    logicOperator: rule.logicOperator as 'AND' | 'OR',
    isActive: rule.isActive,
    estimatedSize: rule.estimatedSize || undefined,
    lastCalculated: rule.lastCalculated || undefined,
    tags: parseJson<string[] | undefined>(rule.tags, undefined),
  }
}

/**
 * Email Segmentation Service Class
 * 
 * Manages customer segmentation logic and segment member management
 * for targeted email marketing campaigns.
 */
export class EmailSegmentationService {
  /**
   * Create a new segmentation rule
   */
  async createSegmentRule(
    workspaceId: string,
    data: {
      name: string
      description?: string
      subjectType?: SubjectType
      criteria: Criteria[]
      logicOperator?: 'AND' | 'OR'
      tags?: string[]
      createdById: string
    }
  ): Promise<SegmentRule> {
    const segmentRule = await prisma.segmentationRule.create({
      data: {
        name: data.name,
        description: data.description,
        workspaceId,
        subjectType: asSubjectType(data.subjectType),
        criteria: JSON.stringify(data.criteria),
        logicOperator: data.logicOperator || 'AND',
        isActive: true,
        tags: data.tags ? JSON.stringify(data.tags) : undefined,
        createdById: data.createdById
      }
    })

    // Calculate initial segment size
    await this.calculateSegmentSize(segmentRule.id)

    return toSegmentRule(segmentRule)
  }

  /**
   * Update a segmentation rule
   */
  async updateSegmentRule(
    segmentRuleId: string,
    data: {
      name?: string
      description?: string
      subjectType?: SubjectType
      criteria?: Criteria[]
      logicOperator?: 'AND' | 'OR'
      isActive?: boolean
      tags?: string[]
      updatedBy: string
    }
  ): Promise<SegmentRule> {
    const updateData: any = {
      updatedBy: data.updatedBy
    }

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.subjectType !== undefined) updateData.subjectType = asSubjectType(data.subjectType)
    if (data.criteria !== undefined) updateData.criteria = JSON.stringify(data.criteria)
    if (data.logicOperator !== undefined) updateData.logicOperator = data.logicOperator
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags)

    const segmentRule = await prisma.segmentationRule.update({
      where: { id: segmentRuleId },
      data: updateData
    })

    // Recalculate when anything that decides membership changed. A subjectType
    // change matters most: the existing members are rows of the previous type and
    // must be swept, which materialization does.
    if (data.criteria !== undefined || data.logicOperator !== undefined || data.subjectType !== undefined) {
      await this.calculateSegmentSize(segmentRuleId)
    }

    return toSegmentRule(segmentRule)
  }

  /**
   * Delete a segmentation rule
   */
  async deleteSegmentRule(segmentRuleId: string): Promise<boolean> {
    const result = await prisma.segmentationRule.delete({
      where: { id: segmentRuleId }
    })

    return !!result
  }

  /**
   * Get segmentation rule by ID
   */
  async getSegmentRule(segmentRuleId: string): Promise<SegmentRule | null> {
    const segmentRule = await prisma.segmentationRule.findUnique({
      where: { id: segmentRuleId }
    })

    if (!segmentRule) {
      return null
    }

    return toSegmentRule(segmentRule)
  }

  /**
   * Get all segmentation rules for workspace
   */
  async getSegmentRules(workspaceId: string): Promise<SegmentRule[]> {
    const segmentRules = await prisma.segmentationRule.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' }
    })

    return segmentRules.map(toSegmentRule)
  }

  /**
   * Materialize a segment: evaluate its criteria against every row of its
   * subject type, replace SegmentMember, and cache the size.
   *
   * Evaluation happens in JS rather than as a Prisma `where` because the
   * operator vocabulary does not translate: case-insensitive `in`, same-day date
   * equality, and dotted paths that reach through relations and into JSON.
   */
  async calculateSegmentSize(segmentRuleId: string): Promise<number> {
    const segmentRule = await prisma.segmentationRule.findUnique({
      where: { id: segmentRuleId }
    })

    if (!segmentRule) {
      throw new Error(`Segment rule not found: ${segmentRuleId}`)
    }

    const subjectType = asSubjectType(segmentRule.subjectType)
    const loader = loaderFor(subjectType)
    const criteria = parseJson<Criteria[]>(segmentRule.criteria, [])

    const rows = await loader.loadAll(segmentRule.workspaceId)
    const matched = rows.filter(row =>
      matchesCriteria(row, criteria, segmentRule.logicOperator as 'AND' | 'OR')
    )

    await this.replaceSegmentMembers(segmentRuleId, subjectType, loader, matched)

    await prisma.segmentationRule.update({
      where: { id: segmentRuleId },
      data: {
        estimatedSize: matched.length,
        lastCalculated: new Date()
      }
    })

    return matched.length
  }

  /**
   * Replace a rule's membership with exactly the rows that matched.
   *
   * Delete-all-then-insert, in one transaction, rather than diffing: a
   * continuing member's score can change, and Prisma has no set-based way to
   * write a per-row score to an existing row. Two statements beat the previous
   * one-query-per-changed-row, and the transaction means no reader ever sees a
   * half-built segment. The cost is that matchedAt resets on every refresh,
   * which nothing surfaces as "in segment since".
   *
   * The delete is scoped by rule only, deliberately not by subjectType: when a
   * rule's subject changes, the previous type's members must be swept too.
   */
  private async replaceSegmentMembers(
    segmentationRuleId: string,
    subjectType: SubjectType,
    loader: SubjectLoader,
    matched: any[]
  ): Promise<void> {
    const matchedAt = new Date()
    const rows = matched.map(row => ({
      segmentationRuleId,
      subjectType,
      subjectId: row.id as string,
      // Derived here and nowhere else: a CHECK constraint ties leadId to
      // subjectType, and Prisma cannot see it.
      leadId: contactLeadIdFor(subjectType, row),
      matchedAt,
      score: loader.score(row),
    }))

    const chunks: (typeof rows)[] = []
    for (let i = 0; i < rows.length; i += MEMBER_INSERT_CHUNK) {
      chunks.push(rows.slice(i, i + MEMBER_INSERT_CHUNK))
    }

    await prisma.$transaction([
      prisma.segmentMember.deleteMany({ where: { segmentationRuleId } }),
      ...chunks.map(data => prisma.segmentMember.createMany({ data })),
    ])
  }

  /**
   * Get segment members
   */
  async getSegmentMembers(
    segmentRuleId: string,
    options?: {
      limit?: number
      offset?: number
      orderBy?: 'score' | 'matchedAt'
      orderDirection?: 'asc' | 'desc'
    }
  ): Promise<SegmentMember[]> {
    const limit = options?.limit || 100
    const offset = options?.offset || 0
    const orderBy = options?.orderBy || 'matchedAt'
    const orderDirection = options?.orderDirection || 'desc'

    const members = await prisma.segmentMember.findMany({
      where: { segmentationRuleId: segmentRuleId },
      orderBy: { [orderBy]: orderDirection },
      take: limit,
      skip: offset
    })

    return members.map(member => ({
      id: member.id,
      segmentationRuleId: member.segmentationRuleId,
      subjectType: asSubjectType(member.subjectType),
      subjectId: member.subjectId,
      leadId: member.leadId,
      matchedAt: member.matchedAt,
      score: member.score || undefined,
    }))
  }

  /**
   * Get segment statistics
   */
  async getSegmentStatistics(segmentRuleId: string): Promise<SegmentStatistics> {
    const members = await prisma.segmentMember.findMany({
      where: { segmentationRuleId: segmentRuleId }
    })

    const totalMembers = members.length
    const scores = members.map(m => m.score || 0)
    const averageScore = scores.length > 0 
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
      : 0

    // Score distribution
    const scoreDistribution: Record<string, number> = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0
    }

    for (const score of scores) {
      if (score <= 20) scoreDistribution['0-20']++
      else if (score <= 40) scoreDistribution['21-40']++
      else if (score <= 60) scoreDistribution['41-60']++
      else if (score <= 80) scoreDistribution['61-80']++
      else scoreDistribution['81-100']++
    }

    // Top performers
    const topPerformers = members
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 10)
      .map(m => ({
        subjectType: asSubjectType(m.subjectType),
        subjectId: m.subjectId,
        score: m.score || 0
      }))

    // There was a histogram here built from SegmentMember.metadata. That column
    // snapshotted {status, stage, value} at match time and is no longer written,
    // because it was stale the moment it was written and duplicated what
    // subjectId already reaches. A distribution over live fields belongs on the
    // subject rows, not on the membership join.

    return {
      totalMembers,
      averageScore,
      scoreDistribution,
      topPerformers
    }
  }

  /**
   * Refresh the stalest active rules, across all workspaces.
   *
   * Replaces refreshWorkspaceSegments, which recalculated every rule in a
   * workspace and had no callers. Materializing a segment loads every row of its
   * subject type, so it must never sit on a write path: a lead edit that also
   * rebuilt twenty segments would make the edit as slow as the largest segment.
   *
   * The three paths that may recompute are this cron, the targeted recalculation
   * immediately before a campaign send, and an explicit user save. New-listing
   * matching deliberately reads SearchBrief rather than SegmentationRule, so no
   * per-event path even wants a refresh.
   *
   * Each rule is isolated: one rule with unloadable subjects must not starve the
   * rest of the batch.
   */
  async refreshStaleSegments(
    options?: { limit?: number; maxAgeMinutes?: number }
  ): Promise<{ refreshed: number; failed: number }> {
    const limit = options?.limit ?? 25
    const cutoff = new Date(Date.now() - (options?.maxAgeMinutes ?? 60) * 60_000)

    const stale = await prisma.segmentationRule.findMany({
      where: {
        isActive: true,
        OR: [{ lastCalculated: null }, { lastCalculated: { lt: cutoff } }],
      },
      // Nulls first on Postgres ascending, so never-calculated rules go first.
      orderBy: { lastCalculated: 'asc' },
      take: limit,
      select: { id: true },
    })

    let refreshed = 0
    let failed = 0

    for (const { id } of stale) {
      try {
        await this.calculateSegmentSize(id)
        refreshed++
      } catch (error) {
        failed++
        console.error(`[email-segmentation] rule ${id} failed to refresh:`, error)
      }
    }

    return { refreshed, failed }
  }

  /**
   * Get segment rule by name
   */
  async getSegmentRuleByName(workspaceId: string, name: string): Promise<SegmentRule | null> {
    const segmentRule = await prisma.segmentationRule.findFirst({
      where: {
        workspaceId,
        name
      }
    })

    if (!segmentRule) {
      return null
    }

    return toSegmentRule(segmentRule)
  }

  /**
   * Get segment rules by tag
   */
  async getSegmentRulesByTag(workspaceId: string, tag: string): Promise<SegmentRule[]> {
    const segmentRules = await prisma.segmentationRule.findMany({
      where: { workspaceId }
    })

    return segmentRules
      .filter(rule => {
        if (!rule.tags) return false
        const tags = JSON.parse(rule.tags)
        return tags.includes(tag)
      })
      .map(toSegmentRule)
  }

  /**
   * Get all tags for workspace segments
   */
  async getSegmentTags(workspaceId: string): Promise<string[]> {
    const segmentRules = await prisma.segmentationRule.findMany({
      where: { workspaceId }
    })

    const tagSet = new Set<string>()

    for (const rule of segmentRules) {
      if (rule.tags) {
        const tags = JSON.parse(rule.tags)
        for (const tag of tags) {
          tagSet.add(tag)
        }
      }
    }

    return Array.from(tagSet).sort()
  }

  /**
   * Duplicate a segment rule
   */
  async duplicateSegmentRule(
    segmentRuleId: string,
    newName: string,
    createdById: string
  ): Promise<SegmentRule> {
    const originalRule = await prisma.segmentationRule.findUnique({
      where: { id: segmentRuleId }
    })

    if (!originalRule) {
      throw new Error(`Segment rule not found: ${segmentRuleId}`)
    }

    const newRule = await prisma.segmentationRule.create({
      data: {
        name: newName,
        description: originalRule.description,
        workspaceId: originalRule.workspaceId,
        subjectType: originalRule.subjectType,
        criteria: originalRule.criteria,
        logicOperator: originalRule.logicOperator,
        isActive: false, // Start as inactive
        tags: originalRule.tags,
        createdById
      }
    })

    // Calculate segment size for new rule
    await this.calculateSegmentSize(newRule.id)

    return toSegmentRule(newRule)
  }
}

// Export singleton instance
export const emailSegmentationService = new EmailSegmentationService()
