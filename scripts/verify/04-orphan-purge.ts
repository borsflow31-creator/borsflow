/**
 * Scenario 4 — deleting a subject sweeps its memberships and enrollments.
 *
 * SegmentMember and AutomationEnrollment identify their subject by a polymorphic
 * (subjectType, subjectId), which cannot carry a foreign key. Statement triggers
 * (migration 20261007060000) do the cleanup, and Prisma cannot see them, so
 * nothing in the schema would notice if a reset lost them. This does.
 */

import { assert, assertEq, cleanup, makeWorkspace, runScenario, section, uid, useVerifyDatabase, verifyClient } from './_harness'

export default function scenario() {
  return runScenario('04 orphan purge', async () => {
    useVerifyDatabase()
    const prisma = verifyClient()
    const fixture = await makeWorkspace(prisma, 'purge')

    try {
      const vendor = await prisma.lead.create({
        data: { firstName: 'Vera', lastName: 'Vendor', email: `v-${uid()}@verify.invalid`, pipelineId: fixture.pipelines.Lead },
        select: { id: true },
      })
      const buyer = await prisma.lead.create({
        data: { firstName: 'Ben', lastName: 'Buyer', email: `b-${uid()}@verify.invalid`, pipelineId: fixture.pipelines.Lead },
        select: { id: true },
      })

      const rule = await prisma.segmentationRule.create({
        data: { name: 'all', workspaceId: fixture.workspaceId, subjectType: 'Property', criteria: '[]' },
        select: { id: true },
      })
      const automation = await prisma.emailAutomation.create({
        data: { name: 'seq', workspaceId: fixture.workspaceId, subjectType: 'Interest', status: 'active' },
        select: { id: true },
      })

      const makeProperty = (ref: string) =>
        prisma.property.create({
          data: { workspaceId: fixture.workspaceId, reference: ref, title: ref, city: 'Lisbon', propertyType: 'apartment', vendorId: vendor.id },
          select: { id: true },
        })

      const track = async (subjectType: string, subjectId: string, leadId: string | null, enroll: boolean) => {
        await prisma.segmentMember.create({ data: { segmentationRuleId: rule.id, subjectType, subjectId, leadId } })
        if (enroll && leadId) {
          await prisma.automationEnrollment.create({
            data: { automationId: automation.id, subjectType, subjectId, leadId, workspaceId: fixture.workspaceId },
          })
        }
      }
      const rows = (subjectType: string, subjectId: string) =>
        Promise.all([
          prisma.segmentMember.count({ where: { subjectType, subjectId } }),
          prisma.automationEnrollment.count({ where: { subjectType, subjectId } }),
        ])

      section('deleting a Property removes its memberships and enrollments')
      const p1 = await makeProperty('PURGE-1')
      await track('Property', p1.id, vendor.id, true)
      assertEq((await rows('Property', p1.id)).join(','), '1,1', 'rows exist before the delete')
      await prisma.property.delete({ where: { id: p1.id } })
      assertEq((await rows('Property', p1.id)).join(','), '0,0', 'rows are swept with the property')

      section('deleting an Interest removes its rows while the buyer survives')
      const p2 = await makeProperty('PURGE-2')
      const interest = await prisma.interest.create({
        data: { workspaceId: fixture.workspaceId, pipelineId: fixture.pipelines.Interest, stage: 'Enquiry', leadId: buyer.id, propertyId: p2.id },
        select: { id: true },
      })
      await track('Interest', interest.id, buyer.id, true)
      await prisma.interest.delete({ where: { id: interest.id } })
      assertEq((await rows('Interest', interest.id)).join(','), '0,0', 'interest rows swept even though the leadId FK did not fire')
      assert(!!(await prisma.lead.findUnique({ where: { id: buyer.id } })), 'the buyer is untouched')

      section('deleting a Mandate removes its rows')
      const mandate = await prisma.mandate.create({
        data: { workspaceId: fixture.workspaceId, reference: `M-${uid()}`, propertyId: p2.id, leadId: vendor.id },
        select: { id: true },
      })
      await track('Mandate', mandate.id, vendor.id, true)
      await prisma.mandate.delete({ where: { id: mandate.id } })
      assertEq((await rows('Mandate', mandate.id)).join(','), '0,0', 'mandate rows swept')

      section('a bulk delete is cleaned by one statement-level trigger')
      const ids: string[] = []
      for (let i = 0; i < 100; i++) {
        const p = await makeProperty(`BULK-${i}-${uid()}`)
        ids.push(p.id)
      }
      await prisma.segmentMember.createMany({
        data: ids.map(subjectId => ({ segmentationRuleId: rule.id, subjectType: 'Property', subjectId, leadId: vendor.id })),
      })
      assertEq(await prisma.segmentMember.count({ where: { subjectType: 'Property', subjectId: { in: ids } } }), 100, '100 memberships')
      await prisma.property.deleteMany({ where: { id: { in: ids } } })
      assertEq(await prisma.segmentMember.count({ where: { subjectType: 'Property', subjectId: { in: ids } } }), 0, 'all swept by one deleteMany')

      section('rows of a different subject type with a colliding id are left alone')
      const survivor = `shared-${uid()}`
      await track('Lead', buyer.id, buyer.id, false)
      await prisma.segmentMember.create({ data: { segmentationRuleId: rule.id, subjectType: 'Mandate', subjectId: survivor, leadId: vendor.id } })
      const p3 = await makeProperty('PURGE-3')
      await prisma.property.delete({ where: { id: p3.id } })
      assertEq(await prisma.segmentMember.count({ where: { subjectType: 'Mandate', subjectId: survivor } }), 1, 'the Mandate row survives a Property delete')

      section('deleting the workspace leaves nothing behind')
      await prisma.workspace.delete({ where: { id: fixture.workspaceId } })
      assertEq(await prisma.segmentMember.count({ where: { segmentationRuleId: rule.id } }), 0, 'no memberships')
      assertEq(await prisma.automationEnrollment.count({ where: { automationId: automation.id } }), 0, 'no enrollments')
    } finally {
      await cleanup(prisma, fixture)
      await prisma.$disconnect()
    }
  })
}

if (require.main === module) {
  scenario()
}
