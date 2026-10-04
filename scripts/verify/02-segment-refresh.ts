/**
 * Scenario 2 — segment materialization.
 *
 * Proves three things about the rewritten calculateSegmentSize:
 *
 *  1. Membership is exactly the matching rows, and the cached estimatedSize
 *     agrees with it.
 *  2. Rebuilding is two statements plus chunked inserts, not one query per
 *     changed row. The old updateSegmentMembers issued a delete per removed row
 *     and a create per added row, so a 500-member segment cost 500+ queries.
 *  3. The rebuild is scoped to the rule being rebuilt and writes the
 *     polymorphic identity, with leadId consistent with subjectType — the
 *     invariant the database CHECK enforces.
 */

import { assert, assertEq, cleanup, makeWorkspace, runScenario, section, useVerifyDatabase, verifyClient } from './_harness'

const LEAD_COUNT = 500

export default function scenario() {
  return runScenario('02 segment refresh', async () => {
    // Must happen before the segmentation service is imported.
    useVerifyDatabase()
    const { emailSegmentationService } = await import('../../src/lib/email-segmentation')

    const prisma = verifyClient()
    const fixture = await makeWorkspace(prisma, 'seg')

    try {
      section(`creating ${LEAD_COUNT} leads`)
      // Two thirds Qualified, one third Lost, so the expected match count is
      // derived rather than guessed.
      const leads = Array.from({ length: LEAD_COUNT }, (_, i) => ({
        firstName: 'Lead',
        lastName: String(i),
        email: `lead-${i}-${fixture.workspaceId}@verify.invalid`,
        status: i % 3 === 0 ? 'lost' : 'qualified',
        stage: i % 3 === 0 ? 'Lost' : 'Qualified',
        value: 1000 * i,
        pipelineId: fixture.pipelines.Lead,
        order: i,
      }))
      await prisma.lead.createMany({ data: leads })
      const expectedMatches = leads.filter(l => l.stage === 'Qualified').length

      section('materializing a Lead segment')
      const rule = await prisma.segmentationRule.create({
        data: {
          name: 'Qualified contacts',
          workspaceId: fixture.workspaceId,
          subjectType: 'Lead',
          criteria: JSON.stringify([{ field: 'stage', operator: 'equals', value: 'Qualified' }]),
          logicOperator: 'AND',
        },
        select: { id: true },
      })

      const size = await emailSegmentationService.calculateSegmentSize(rule.id)
      assertEq(size, expectedMatches, 'returned size')

      const members = await prisma.segmentMember.findMany({
        where: { segmentationRuleId: rule.id },
        select: { subjectType: true, subjectId: true, leadId: true, score: true },
      })
      assertEq(members.length, expectedMatches, 'materialized member count')

      const cached = await prisma.segmentationRule.findUnique({
        where: { id: rule.id },
        select: { estimatedSize: true, lastCalculated: true },
      })
      assertEq(cached?.estimatedSize, expectedMatches, 'cached estimatedSize')
      assert(cached?.lastCalculated != null, 'lastCalculated stamped')

      section('members carry the polymorphic identity and a consistent contact')
      assert(members.every(m => m.subjectType === 'Lead'), 'every member is a Lead subject')
      assert(members.every(m => m.leadId === m.subjectId), 'leadId equals subjectId for Lead subjects')
      assert(members.every(m => m.score !== null), 'every Lead member is scored')

      section('only matching rows are members')
      const matchedIds = new Set(members.map(m => m.subjectId))
      const lostLeads = await prisma.lead.findMany({
        where: { pipelineId: fixture.pipelines.Lead, stage: 'Lost' },
        select: { id: true },
      })
      assert(lostLeads.every(l => !matchedIds.has(l.id)), 'no non-matching lead is a member')

      section('a rebuild is a handful of operations, not one per row')
      // Counted on the singleton the service actually uses, via middleware, so
      // this measures the service's own traffic. Operations rather than raw SQL
      // is the right unit here: the claim is that rebuilding does not issue work
      // proportional to the number of members.
      const { prisma: singleton } = await import('../../src/lib/prisma')
      let operations = 0
      const seen: string[] = []
      singleton.$use(async (params, next) => {
        operations++
        seen.push(`${params.model}.${params.action}`)
        return next(params)
      })

      await emailSegmentationService.calculateSegmentSize(rule.id)
      console.log(`    ${operations} operations: ${seen.join(', ')}`)
      assert(
        operations < 10,
        `a rebuild of ${expectedMatches} members took ${operations} operations (${seen.join(', ')}); it must not scale with member count`
      )

      // Membership must be stable across a rebuild with nothing changed.
      const after = await prisma.segmentMember.findMany({
        where: { segmentationRuleId: rule.id },
        select: { subjectId: true },
      })
      assertEq(after.length, expectedMatches, 'member count after rebuild')
      assert(after.every(m => matchedIds.has(m.subjectId)), 'the same rows are members after a rebuild')

      section('a rebuild touches only its own rule')
      const other = await prisma.segmentationRule.create({
        data: {
          name: 'Lost contacts',
          workspaceId: fixture.workspaceId,
          subjectType: 'Lead',
          criteria: JSON.stringify([{ field: 'stage', operator: 'equals', value: 'Lost' }]),
          logicOperator: 'AND',
        },
        select: { id: true },
      })
      const otherSize = await emailSegmentationService.calculateSegmentSize(other.id)
      assertEq(otherSize, LEAD_COUNT - expectedMatches, 'second rule size')

      await emailSegmentationService.calculateSegmentSize(rule.id)
      assertEq(
        await prisma.segmentMember.count({ where: { segmentationRuleId: other.id } }),
        LEAD_COUNT - expectedMatches,
        "rebuilding one rule leaves the other rule's members alone"
      )

      section('membership follows the rows: a lead that stops matching is dropped')
      const first = [...matchedIds][0]
      await prisma.lead.update({ where: { id: first }, data: { stage: 'Lost' } })
      const shrunk = await emailSegmentationService.calculateSegmentSize(rule.id)
      assertEq(shrunk, expectedMatches - 1, 'size after a lead stopped matching')
      assertEq(
        await prisma.segmentMember.count({ where: { segmentationRuleId: rule.id, subjectId: first } }),
        0,
        'the lead is no longer a member'
      )

      section('malformed criteria yield an empty match rather than a crash')
      const broken = await prisma.segmentationRule.create({
        data: {
          name: 'Broken',
          workspaceId: fixture.workspaceId,
          subjectType: 'Lead',
          criteria: '{not json',
          logicOperator: 'AND',
        },
        select: { id: true },
      })
      // parseJson falls back to [], and empty criteria match everything -- the
      // point is that the route no longer 500s on a malformed rule.
      assertEq(await emailSegmentationService.calculateSegmentSize(broken.id), LEAD_COUNT, 'malformed criteria fall back')

      section('switching a rule to another subject sweeps the previous subject members')
      // The delete is scoped by rule, not by subjectType, so a rule that changes
      // subject does not keep members that are rows of the old type.
      await prisma.property.create({
        data: { workspaceId: fixture.workspaceId, reference: 'SW-1', title: 'Switch', city: 'Lisbon', propertyType: 'apartment', status: 'live', price: 100 },
      })
      assert((await prisma.segmentMember.count({ where: { segmentationRuleId: broken.id, subjectType: 'Lead' } })) > 0, 'Lead members exist before the switch')
      await prisma.segmentationRule.update({ where: { id: broken.id }, data: { subjectType: 'Property' } })
      assertEq(await emailSegmentationService.calculateSegmentSize(broken.id), 1, 'the property matches the (empty) criteria')
      assertEq(await prisma.segmentMember.count({ where: { segmentationRuleId: broken.id, subjectType: 'Lead' } }), 0, 'no Lead-subject members remain')
      const swept = await prisma.segmentMember.findMany({ where: { segmentationRuleId: broken.id }, select: { subjectType: true } })
      assertEq(swept.map(m => m.subjectType).join(','), 'Property', 'the rule now holds exactly its Property member')
    } finally {
      await cleanup(prisma, fixture)
      await prisma.$disconnect()
    }
  })
}

if (require.main === module) {
  scenario()
}
