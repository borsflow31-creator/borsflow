/**
 * Scenario 10 — data that existed BEFORE the real-estate migrations still works.
 *
 * Meant to run against a database that was built from the pre-migration schema,
 * loaded with legacy rows, and then migrated (see scripts/verify/README.md). It
 * looks for the seeded legacy ids and skips itself when they are not there, so it
 * is harmless against a database that never had legacy data.
 *
 * Checks the backfill (every old membership and enrollment became a 'Lead'
 * subject), that old leads/products/segments/automations still function through
 * the new engine, and that existing workspaces gained the default boards.
 */

import { assert, assertEq, runScenario, section, useVerifyDatabase, verifyClient } from './_harness'

export default function scenario() {
  return runScenario('10 legacy data survives the migrations', async () => {
    useVerifyDatabase()
    const prisma = verifyClient()
    try {
      const legacy = await prisma.workspace.findUnique({ where: { id: 'w1' }, select: { id: true } })
      if (!legacy) {
        console.log('    SKIPPED — no legacy fixture (workspace w1) in this database.')
        return
      }

      // Materializing the segment (below) replaces its members, so the original
      // backfilled row 'sm1' only exists until this scenario has run once.
      const member = await prisma.segmentMember.findUnique({ where: { id: 'sm1' } })
      if (!member) {
        console.log('    SKIPPED — the legacy fixture was already consumed by an earlier run. Rebuild the database to repeat it.')
        return
      }

      section('old segment members and enrollments were backfilled as Lead subjects')
      assertEq(member.subjectType, 'Lead', 'segment member subjectType')
      assertEq(member.subjectId, 'l1', 'subjectId = the old leadId')
      assertEq(member.leadId, 'l1', 'leadId kept')
      assertEq(member.score, 55, 'score kept')
      const enrollment = await prisma.automationEnrollment.findUniqueOrThrow({ where: { id: 'e1' } })
      assertEq(enrollment.subjectType, 'Lead', 'enrollment subjectType')
      assertEq(enrollment.subjectId, 'l1', 'enrollment subjectId')
      assertEq(enrollment.status, 'active', 'still active')

      section('rules, automations and pipelines defaulted to Lead')
      assertEq((await prisma.segmentationRule.findUniqueOrThrow({ where: { id: 'r1' } })).subjectType, 'Lead', 'rule')
      assertEq((await prisma.emailAutomation.findUniqueOrThrow({ where: { id: 'a1' } })).subjectType, 'Lead', 'automation')
      assertEq((await prisma.pipeline.findUniqueOrThrow({ where: { id: 'p1' } })).subjectType, 'Lead', 'pipeline')

      section('the old segment still materializes through the new engine')
      useVerifyDatabase()
      const { emailSegmentationService } = await import('../../src/lib/email-segmentation')
      const size = await emailSegmentationService.calculateSegmentSize('r1')
      assertEq(size, 1, 'one qualified lead matches')
      const members = await prisma.segmentMember.findMany({ where: { segmentationRuleId: 'r1' } })
      assertEq(members.length, 1, 'one member')
      assertEq(members[0].subjectId, 'l1', 'it is Ada')

      section('the old automation still dispatches on a stage change, for the old lead')
      const { automationEngine } = await import('../../src/lib/automation-engine')
      await prisma.automationEnrollment.update({ where: { id: 'e1' }, data: { status: 'completed' } })
      const enrolled = await automationEngine.dispatchStageChanged({
        subjectType: 'Lead', subjectId: 'l1', pipelineId: 'p1', workspaceId: 'w1', fromStage: 'New', toStage: 'Qualified',
      })
      assertEq(enrolled, 1, 'the completed enrollment was revived')
      assertEq(await prisma.automationEnrollment.count({ where: { automationId: 'a1' } }), 1, 'no duplicate row')

      section('products are untouched, and their custom fields are still product fields')
      const product = await prisma.product.findUniqueOrThrow({ where: { id: 'pr1' } })
      assertEq(product.name, 'Agency fee', 'product kept')
      assertEq((await prisma.productCustomField.findUniqueOrThrow({ where: { id: 'cf1' } })).entityType, 'product', 'custom field defaulted to product')

      section('legacy leads are still leads, with their stage')
      const leads = await prisma.lead.findMany({ where: { pipelineId: 'p1' }, orderBy: { id: 'asc' }, select: { stage: true } })
      assertEq(leads.map(l => l.stage).join(','), 'Qualified,New,Won', 'stages unchanged')

      section('every existing workspace gained the missing boards, and kept its own')
      for (const workspaceId of ['w1', 'w2']) {
        const boards = await prisma.pipeline.findMany({ where: { workspaceId }, select: { subjectType: true, name: true } })
        const kinds = boards.map(b => b.subjectType).sort().join(',')
        assertEq(kinds, 'Interest,Lead,Property', `${workspaceId} has one board of each kind`)
      }
      const w1Lead = await prisma.pipeline.findMany({ where: { workspaceId: 'w1', subjectType: 'Lead' }, select: { id: true } })
      assert(w1Lead.length === 1 && w1Lead[0].id === 'p1', "w1 kept its own lead pipeline instead of getting a second one")

      section('the seeded owner board has the stages from the brief')
      const owner = await prisma.pipeline.findFirstOrThrow({ where: { workspaceId: 'w1', subjectType: 'Property' } })
      assertEq(
        owner.stages,
        JSON.stringify(['Prospect', 'Valuation booked', 'Valuation done', 'Mandate signed', 'Live', 'Under offer', 'Sold']),
        'owner / mandate acquisition'
      )
      const buyer = await prisma.pipeline.findFirstOrThrow({ where: { workspaceId: 'w1', subjectType: 'Interest' } })
      assertEq(
        buyer.stages,
        JSON.stringify(['Enquiry', 'Qualified', 'Brief recorded', 'Viewing booked', 'Viewing done', 'Offer', 'Under contract', 'Closed']),
        'buyer journey'
      )
    } finally {
      await prisma.$disconnect()
    }
  })
}

if (require.main === module) {
  scenario()
}
