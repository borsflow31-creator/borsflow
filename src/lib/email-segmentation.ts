/**
 * Email Segmentation Service
 * 
 * Manages customer segmentation logic and segment member management
 * for targeted email marketing campaigns.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Criteria structure
export interface Criteria {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'is_null' | 'is_not_null' | 'is_empty' | 'is_not_empty'
  value: any
}

// Segment rule structure
export interface SegmentRule {
  id: string
  name: string
  description?: string
  workspaceId: string
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
  leadId: string
  matchedAt: Date
  score?: number
  metadata?: Record<string, any>
}

// Segment statistics structure
export interface SegmentStatistics {
  totalMembers: number
  averageScore: number
  scoreDistribution: Record<string, number>
  topPerformers: Array<{ leadId: string; score: number }>
  distributionByField: Record<string, Record<string, number>>
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
        criteria: JSON.stringify(data.criteria),
        logicOperator: data.logicOperator || 'AND',
        isActive: true,
        tags: data.tags ? JSON.stringify(data.tags) : undefined,
        createdById: data.createdById
      }
    })

    // Calculate initial segment size
    await this.calculateSegmentSize(segmentRule.id)

    return {
      id: segmentRule.id,
      name: segmentRule.name,
      description: segmentRule.description || undefined,
      workspaceId: segmentRule.workspaceId,
      criteria: JSON.parse(segmentRule.criteria),
      logicOperator: segmentRule.logicOperator as 'AND' | 'OR',
      isActive: segmentRule.isActive,
      estimatedSize: segmentRule.estimatedSize || undefined,
      lastCalculated: segmentRule.lastCalculated || undefined,
      tags: segmentRule.tags ? JSON.parse(segmentRule.tags) : undefined
    }
  }

  /**
   * Update a segmentation rule
   */
  async updateSegmentRule(
    segmentRuleId: string,
    data: {
      name?: string
      description?: string
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
    if (data.criteria !== undefined) updateData.criteria = JSON.stringify(data.criteria)
    if (data.logicOperator !== undefined) updateData.logicOperator = data.logicOperator
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags)

    const segmentRule = await prisma.segmentationRule.update({
      where: { id: segmentRuleId },
      data: updateData
    })

    // Recalculate segment size if criteria changed
    if (data.criteria !== undefined || data.logicOperator !== undefined) {
      await this.calculateSegmentSize(segmentRuleId)
    }

    return {
      id: segmentRule.id,
      name: segmentRule.name,
      description: segmentRule.description || undefined,
      workspaceId: segmentRule.workspaceId,
      criteria: JSON.parse(segmentRule.criteria),
      logicOperator: segmentRule.logicOperator as 'AND' | 'OR',
      isActive: segmentRule.isActive,
      estimatedSize: segmentRule.estimatedSize || undefined,
      lastCalculated: segmentRule.lastCalculated || undefined,
      tags: segmentRule.tags ? JSON.parse(segmentRule.tags) : undefined
    }
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

    return {
      id: segmentRule.id,
      name: segmentRule.name,
      description: segmentRule.description || undefined,
      workspaceId: segmentRule.workspaceId,
      criteria: JSON.parse(segmentRule.criteria),
      logicOperator: segmentRule.logicOperator as 'AND' | 'OR',
      isActive: segmentRule.isActive,
      estimatedSize: segmentRule.estimatedSize || undefined,
      lastCalculated: segmentRule.lastCalculated || undefined,
      tags: segmentRule.tags ? JSON.parse(segmentRule.tags) : undefined
    }
  }

  /**
   * Get all segmentation rules for workspace
   */
  async getSegmentRules(workspaceId: string): Promise<SegmentRule[]> {
    const segmentRules = await prisma.segmentationRule.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' }
    })

    return segmentRules.map(rule => ({
      id: rule.id,
      name: rule.name,
      description: rule.description || undefined,
      workspaceId: rule.workspaceId,
      criteria: JSON.parse(rule.criteria),
      logicOperator: rule.logicOperator as 'AND' | 'OR',
      isActive: rule.isActive,
      estimatedSize: rule.estimatedSize || undefined,
      lastCalculated: rule.lastCalculated || undefined,
      tags: rule.tags ? JSON.parse(rule.tags) : undefined
    }))
  }

  /**
   * Calculate segment size and update members
   */
  async calculateSegmentSize(segmentRuleId: string): Promise<number> {
    const segmentRule = await prisma.segmentationRule.findUnique({
      where: { id: segmentRuleId }
    })

    if (!segmentRule) {
      throw new Error(`Segment rule not found: ${segmentRuleId}`)
    }

    const criteria = JSON.parse(segmentRule.criteria)
    const logicOperator = segmentRule.logicOperator

    // Get all leads for the workspace. The pipeline is included so dotted-path
    // criteria like `pipeline.name` resolve — getFieldValue already walks them.
    const leads = await prisma.lead.findMany({
      where: {
        pipeline: {
          workspaceId: segmentRule.workspaceId
        }
      },
      include: { pipeline: true }
    })

    // Filter leads based on criteria
    const matchedLeads = leads.filter(lead => 
      this.matchesCriteria(lead, criteria, logicOperator as 'AND' | 'OR')
    )

    // Update segment members
    await this.updateSegmentMembers(segmentRuleId, matchedLeads)

    // Update segment rule with calculated size
    const updatedRule = await prisma.segmentationRule.update({
      where: { id: segmentRuleId },
      data: {
        estimatedSize: matchedLeads.length,
        lastCalculated: new Date()
      }
    })

    return matchedLeads.length
  }

  /**
   * Update segment members
   */
  private async updateSegmentMembers(
    segmentRuleId: string,
    matchedLeads: any[]
  ): Promise<void> {
    // Get existing members
    const existingMembers = await prisma.segmentMember.findMany({
      where: { segmentationRuleId: segmentRuleId }
    })

    const existingMemberIds = new Set(existingMembers.map(m => m.leadId))
    const matchedLeadIds = new Set(matchedLeads.map(l => l.id))

    // Remove members that no longer match
    const membersToRemove = existingMembers.filter(m => !matchedLeadIds.has(m.leadId))
    for (const member of membersToRemove) {
      await prisma.segmentMember.delete({
        where: { id: member.id }
      })
    }

    // Add new members
    for (const lead of matchedLeads) {
      if (!existingMemberIds.has(lead.id)) {
        const score = this.calculateLeadScore(lead)
        await prisma.segmentMember.create({
          data: {
            segmentationRuleId: segmentRuleId,
            leadId: lead.id,
            matchedAt: new Date(),
            score,
            metadata: JSON.stringify({
              status: lead.status,
              stage: lead.stage,
              value: lead.value
            })
          }
        })
      }
    }
  }

  /**
   * Check if lead matches criteria.
   *
   * Public because the automation engine evaluates trigger conditions and step
   * send-conditions with the same criteria shape SegmentModal produces — one
   * evaluator, not two that can drift apart.
   */
  matchesCriteria(
    lead: any,
    criteria: Criteria[],
    logicOperator: 'AND' | 'OR'
  ): boolean {
    if (!Array.isArray(criteria) || criteria.length === 0) return true
    if (logicOperator === 'AND') {
      return criteria.every(criterion => this.matchesCriterion(lead, criterion))
    } else {
      return criteria.some(criterion => this.matchesCriterion(lead, criterion))
    }
  }

  /**
   * Check if lead matches single criterion
   */
  matchesCriterion(lead: any, criterion: Criteria): boolean {
    const fieldValue = this.getFieldValue(lead, criterion.field)

    switch (criterion.operator) {
      case 'equals':
        return fieldValue === criterion.value
      case 'not_equals':
        return fieldValue !== criterion.value
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(criterion.value).toLowerCase())
      case 'not_contains':
        return !String(fieldValue).toLowerCase().includes(String(criterion.value).toLowerCase())
      case 'starts_with':
        return String(fieldValue).toLowerCase().startsWith(String(criterion.value).toLowerCase())
      case 'ends_with':
        return String(fieldValue).toLowerCase().endsWith(String(criterion.value).toLowerCase())
      case 'greater_than':
        return Number(fieldValue) > Number(criterion.value)
      case 'less_than':
        return Number(fieldValue) < Number(criterion.value)
      case 'in':
        return Array.isArray(criterion.value) && criterion.value.includes(fieldValue)
      case 'not_in':
        return Array.isArray(criterion.value) && !criterion.value.includes(fieldValue)
      case 'is_null':
      // SegmentModal labels these "is empty" / "is not empty"; accept both spellings
      // so criteria saved from the UI actually evaluate.
      case 'is_empty':
        return fieldValue === null || fieldValue === undefined || fieldValue === ''
      case 'is_not_null':
      case 'is_not_empty':
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
      default:
        return false
    }
  }

  /**
   * Get field value from lead object
   */
  private getFieldValue(lead: any, field: string): any {
    const parts = field.split('.')
    let value = lead

    for (const part of parts) {
      if (value === null || value === undefined) {
        return null
      }
      value = value[part]
    }

    return value
  }

  /**
   * Calculate lead score
   */
  private calculateLeadScore(lead: any): number {
    let score = 0

    // Status-based scoring
    const statusScores: Record<string, number> = {
      'new': 10,
      'contacted': 20,
      'qualified': 40,
      'proposal': 60,
      'negotiation': 80,
      'won': 100,
      'lost': 0
    }

    score += statusScores[lead.status] || 0

    // Value-based scoring
    if (lead.value) {
      score += Math.min(Math.floor(lead.value / 1000), 50)
    }

    // Stage-based scoring
    if (lead.stage === 'proposal' || lead.stage === 'negotiation') {
      score += 20
    }

    // Contact information completeness
    if (lead.email) score += 10
    if (lead.phone) score += 10
    if (lead.company) score += 10

    return Math.min(score, 100)
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
      leadId: member.leadId,
      matchedAt: member.matchedAt,
      score: member.score || undefined,
      metadata: member.metadata ? JSON.parse(member.metadata) : undefined
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
        leadId: m.leadId,
        score: m.score || 0
      }))

    // Distribution by field
    const distributionByField: Record<string, Record<string, number>> = {}
    
    for (const member of members) {
      if (member.metadata) {
        const metadata = JSON.parse(member.metadata)
        
        for (const [field, value] of Object.entries(metadata)) {
          if (!distributionByField[field]) {
            distributionByField[field] = {}
          }
          
          const valueStr = String(value)
          if (!distributionByField[field][valueStr]) {
            distributionByField[field][valueStr] = 0
          }
          
          distributionByField[field][valueStr]++
        }
      }
    }

    return {
      totalMembers,
      averageScore,
      scoreDistribution,
      topPerformers,
      distributionByField
    }
  }

  /**
   * Get leads matching segment criteria
   */
  async getLeadsForSegment(segmentRuleId: string): Promise<any[]> {
    const segmentRule = await prisma.segmentationRule.findUnique({
      where: { id: segmentRuleId },
      include: {
        members: {
          include: {
            lead: true
          }
        }
      }
    })

    if (!segmentRule) {
      return []
    }

    return segmentRule.members.map(member => member.lead)
  }

  /**
   * Refresh all active segments for workspace
   */
  async refreshWorkspaceSegments(workspaceId: string): Promise<number> {
    const segmentRules = await prisma.segmentationRule.findMany({
      where: {
        workspaceId,
        isActive: true
      }
    })

    let totalProcessed = 0

    for (const segmentRule of segmentRules) {
      const size = await this.calculateSegmentSize(segmentRule.id)
      totalProcessed += size
    }

    return totalProcessed
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

    return {
      id: segmentRule.id,
      name: segmentRule.name,
      description: segmentRule.description || undefined,
      workspaceId: segmentRule.workspaceId,
      criteria: JSON.parse(segmentRule.criteria),
      logicOperator: segmentRule.logicOperator as 'AND' | 'OR',
      isActive: segmentRule.isActive,
      estimatedSize: segmentRule.estimatedSize || undefined,
      lastCalculated: segmentRule.lastCalculated || undefined,
      tags: segmentRule.tags ? JSON.parse(segmentRule.tags) : undefined
    }
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
      .map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description || undefined,
        workspaceId: rule.workspaceId,
        criteria: JSON.parse(rule.criteria),
        logicOperator: rule.logicOperator as 'AND' | 'OR',
        isActive: rule.isActive,
        estimatedSize: rule.estimatedSize || undefined,
        lastCalculated: rule.lastCalculated || undefined,
        tags: rule.tags ? JSON.parse(rule.tags) : undefined
      }))
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
        criteria: originalRule.criteria,
        logicOperator: originalRule.logicOperator,
        isActive: false, // Start as inactive
        tags: originalRule.tags,
        createdById
      }
    })

    // Calculate segment size for new rule
    await this.calculateSegmentSize(newRule.id)

    return {
      id: newRule.id,
      name: newRule.name,
      description: newRule.description || undefined,
      workspaceId: newRule.workspaceId,
      criteria: JSON.parse(newRule.criteria),
      logicOperator: newRule.logicOperator as 'AND' | 'OR',
      isActive: newRule.isActive,
      estimatedSize: newRule.estimatedSize || undefined,
      lastCalculated: newRule.lastCalculated || undefined,
      tags: newRule.tags ? JSON.parse(newRule.tags) : undefined
    }
  }
}

// Export singleton instance
export const emailSegmentationService = new EmailSegmentationService()
