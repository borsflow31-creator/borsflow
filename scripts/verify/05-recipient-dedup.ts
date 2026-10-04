/**
 * Scenario 5 — campaign recipients resolve through the segment's subject, and are
 * de-duplicated per address per send.
 *
 * An interest resolves to its buyer, a mandate or a property to its vendor. A buyer
 * with three interests (or two contacts sharing one address) must receive one copy.
 */

import { assert, assertEq, cleanup, makeWorkspace, runScenario, section, uid, useVerifyDatabase, verifyClient } from './_harness'

export default function scenario() {
  return runScenario('05 recipient resolution and dedup', async () => {
    useVerifyDatabase()
    const { emailCampaignService } = await import('../../src/lib/email-campaign')
    const { emailSegmentationService } = await import('../../src/lib/email-segmentation')
    const prisma = verifyClient()
    const fixture = await makeWorkspace(prisma, 'recip')
    const recipients = (campaign: any) => (emailCampaignService as any).getCampaignRecipients(campaign) as Promise<any[]>

    try {
      const lead = (first: string, email: string | null) =>
        prisma.lead.create({
          data: { firstName: first, lastName: 'T', email, pipelineId: fixture.pipelines.Lead },
          select: { id: true },
        })
      const buyer = await lead('Buyer', `Buyer-${uid()}@Verify.invalid`)
      const twin = await lead('Twin', null)
      const vendor = await lead('Vendor', `vendor-${uid()}@verify.invalid`)

      const makeProperty = (ref: string, vendorId: string | null) =>
        prisma.property.create({
          data: { workspaceId: fixture.workspaceId, reference: ref, title: ref, city: 'Lisbon', propertyType: 'apartment', status: 'live', price: 100, vendorId },
          select: { id: true },
        })
      const [p1, p2, p3] = await Promise.all([makeProperty('R1', vendor.id), makeProperty('R2', vendor.id), makeProperty('R3', null)])

      const makeRule = (subjectType: string, criteria: unknown[] = []) =>
        prisma.segmentationRule.create({
          data: { name: `${subjectType} rule`, workspaceId: fixture.workspaceId, subjectType, criteria: JSON.stringify(criteria) },
          select: { id: true, subjectType: true },
        })

      section('an interest segment resolves to the buyer, once however many interests they hold')
      for (const p of [p1, p2, p3]) {
        await prisma.interest.create({
          data: { workspaceId: fixture.workspaceId, pipelineId: fixture.pipelines.Interest, stage: 'Enquiry', leadId: buyer.id, propertyId: p.id },
        })
      }
      const interestRule = await makeRule('Interest')
      assertEq(await emailSegmentationService.calculateSegmentSize(interestRule.id), 3, 'three interests in the segment')
      const got = await recipients({ workspaceId: fixture.workspaceId, segmentationRuleId: interestRule.id, segmentationRule: interestRule })
      assertEq(got.length, 1, 'one recipient for three interests')
      assertEq(got[0].leadId, buyer.id, 'attributed to the buyer, not the interest')
      assertEq(got[0].subjectType, 'Interest', 'resolved through the interest subject')

      section('the same address in a different case is the same address')
      const dup = await prisma.lead.create({
        data: { firstName: 'Dup', lastName: 'T', email: (await prisma.lead.findUniqueOrThrow({ where: { id: buyer.id } })).email!.toUpperCase(), pipelineId: fixture.pipelines.Lead },
        select: { id: true },
      })
      const leadRule = await makeRule('Lead')
      await emailSegmentationService.calculateSegmentSize(leadRule.id)
      const leadRecipients = await recipients({ workspaceId: fixture.workspaceId, segmentationRuleId: leadRule.id, segmentationRule: leadRule })
      assertEq(leadRecipients.filter(r => r.email.toLowerCase().startsWith('buyer-')).length, 1, 'buyer and the upper-cased duplicate collapse to one')
      assert(!leadRecipients.some(r => r.leadId === twin.id), 'a contact with no address is not a recipient')
      assert(leadRecipients.some(r => r.leadId === vendor.id), 'the vendor is a contact too')
      void dup

      section('a mandate segment resolves to the vendor')
      const mandate = await prisma.mandate.create({
        data: { workspaceId: fixture.workspaceId, reference: `M-${uid()}`, propertyId: p1.id, leadId: vendor.id, status: 'active', endDate: new Date(Date.now() + 5 * 86_400_000) },
        select: { id: true },
      })
      void mandate
      const mandateRule = await makeRule('Mandate', [{ field: 'daysToExpiry', operator: 'less_than', value: '30' }])
      assertEq(await emailSegmentationService.calculateSegmentSize(mandateRule.id), 1, 'a mandate matching on expiry (daysToExpiry < 30)')
      const m = await recipients({ workspaceId: fixture.workspaceId, segmentationRuleId: mandateRule.id, segmentationRule: mandateRule })
      assertEq(m.length, 1, 'one recipient')
      assertEq(m[0].leadId, vendor.id, 'the vendor')

      section('a property segment resolves to its vendor; one without a vendor is skipped')
      const propertyRule = await makeRule('Property')
      assertEq(await emailSegmentationService.calculateSegmentSize(propertyRule.id), 3, 'three properties in the segment')
      const pr = await recipients({ workspaceId: fixture.workspaceId, segmentationRuleId: propertyRule.id, segmentationRule: propertyRule })
      assertEq(pr.length, 1, 'two properties share a vendor, one has none: a single recipient')
      assertEq(pr[0].leadId, vendor.id, 'the vendor')

      section('a segment of mandates matches on the expiry date itself')
      const byDate = await makeRule('Mandate', [{ field: 'endDate', operator: 'less_than', value: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10) }])
      assertEq(await emailSegmentationService.calculateSegmentSize(byDate.id), 1, 'endDate comparison works through the shared evaluator')

      section('no segment: every contact in the workspace, still de-duplicated')
      const all = await recipients({ workspaceId: fixture.workspaceId, segmentationRuleId: null })
      assertEq(new Set(all.map(r => r.email.toLowerCase())).size, all.length, 'no address appears twice')
    } finally {
      await cleanup(prisma, fixture)
      await prisma.$disconnect()
    }
  })
}

if (require.main === module) {
  scenario()
}
