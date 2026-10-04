/**
 * Scenario 9 — a property on the owner board, and a viewing's feedback landing on
 * the property, the interest and the lead timeline.
 *
 * Covers checks 1 and 4 of the brief at the service level. (Photo upload goes
 * through Supabase Storage and is not exercised here; the ordered, typed media
 * model is, via a link item.)
 */

import { assert, assertEq, cleanup, makeWorkspace, runScenario, section, uid, useVerifyDatabase, verifyClient } from './_harness'

export default function scenario() {
  return runScenario('09 property board and viewing feedback', async () => {
    useVerifyDatabase()
    const { createProperty, updateProperty } = await import('../../src/lib/services/properties')
    const { createViewing, recordViewingFeedback } = await import('../../src/lib/services/viewings')
    const prisma = verifyClient()
    const fixture = await makeWorkspace(prisma, 'prop')
    const ctx = { workspaceId: fixture.workspaceId, userId: fixture.userId }

    try {
      section('a property is created with an address and appears on the owner board')
      const property = await createProperty(ctx, {
        title: 'Sunny T3 with terrace',
        city: 'Lisbon',
        district: 'Alfama',
        addressLine: 'Rua das Flores 12',
        postalCode: '1100-001',
        countryCode: 'pt',
        latitude: 38.711,
        longitude: -9.13,
        propertyType: 'apartment',
        price: 450000,
        bedrooms: 3,
        surfaceArea: 110,
        energyRating: 'B',
      })
      assertEq(property.status, 'prospect', 'starts as a prospect')
      assertEq(property.stage, 'Prospect', 'in the first column')
      assertEq(property.pipelineId, fixture.pipelines.Property, 'on the owner board')
      assertEq(property.countryCode, 'PT', 'country code normalised')
      assert(/^PRP-\d{4}$/.test(property.reference), `a reference was generated (${property.reference})`)

      const onBoard = await prisma.property.findMany({ where: { pipelineId: fixture.pipelines.Property }, select: { id: true, stage: true } })
      assert(onBoard.some(p => p.id === property.id && p.stage === 'Prospect'), 'the owner board query returns it in Prospect')

      section('media is ordered and typed')
      await prisma.propertyMedia.createMany({
        data: [
          { propertyId: property.id, workspaceId: fixture.workspaceId, kind: 'photo', filePath: `crm/${fixture.workspaceId}/properties/${property.id}/a.jpg`, position: 0, isCover: true },
          { propertyId: property.id, workspaceId: fixture.workspaceId, kind: 'floorplan', filePath: `crm/${fixture.workspaceId}/properties/${property.id}/b.pdf`, position: 1 },
          { propertyId: property.id, workspaceId: fixture.workspaceId, kind: 'virtual_tour', externalUrl: 'https://tour.example.com/x', position: 2 },
        ],
      })
      const media = await prisma.propertyMedia.findMany({ where: { propertyId: property.id }, orderBy: { position: 'asc' }, select: { kind: true, isCover: true } })
      assertEq(media.map(m => m.kind).join(','), 'photo,floorplan,virtual_tour', 'ordered and typed')
      assertEq(media.filter(m => m.isCover).length, 1, 'one cover')

      section('status and board column stay in step, in both directions')
      let result = await updateProperty(property.id, ctx, { status: 'live' })
      assertEq(result.property.stage, 'Live', 'going live moves the card to Live')
      assert(result.property.listedAt !== null, 'listedAt is stamped, so days-on-market counts from here')

      result = await updateProperty(property.id, ctx, { stage: 'Under offer', order: 0 })
      assertEq(result.property.status, 'under_offer', 'dragging to Under offer sets the status')

      result = await updateProperty(property.id, ctx, { status: 'live' })
      assertEq(result.property.stage, 'Live', 'and back')

      let rejected = false
      try { await updateProperty(property.id, ctx, { stage: 'No such column' }) } catch { rejected = true }
      assert(rejected, 'a stage that is not on the board is refused')

      section('a price change is recorded on the active mandate')
      const vendor = await prisma.lead.create({
        data: { firstName: 'Vera', lastName: 'Vendor', email: `v-${uid()}@verify.invalid`, pipelineId: fixture.pipelines.Lead },
        select: { id: true },
      })
      const mandate = await prisma.mandate.create({
        data: { workspaceId: fixture.workspaceId, reference: `M-${uid()}`, propertyId: property.id, leadId: vendor.id, status: 'active', askingPrice: 450000 },
        select: { id: true },
      })
      await updateProperty(property.id, ctx, { price: 430000 })
      const changes = await prisma.mandatePriceChange.findMany({ where: { mandateId: mandate.id }, select: { fromPrice: true, toPrice: true } })
      assertEq(changes.length, 1, 'one price change recorded')
      assertEq(`${changes[0].fromPrice}>${changes[0].toPrice}`, '450000>430000', 'with both prices')
      assertEq((await prisma.mandate.findUniqueOrThrow({ where: { id: mandate.id }, select: { askingPrice: true } })).askingPrice, 430000, 'the mandate follows')

      section('a viewing is a Meeting with a property, and attaches the buyer')
      const buyer = await prisma.lead.create({
        data: { firstName: 'Ben', lastName: 'Buyer', email: `b-${uid()}@verify.invalid`, pipelineId: fixture.pipelines.Lead },
        select: { id: true },
      })
      const viewing = await createViewing(ctx, {
        propertyId: property.id,
        leadId: buyer.id,
        startTime: new Date(Date.now() + 86_400_000).toISOString(),
        duration: 45,
      })
      assertEq(viewing.propertyId, property.id, 'the meeting points at the property')
      assertEq(viewing.meetingType, 'in_person', 'in person')
      assert(!!viewing.interestId, 'an interest was created for the buyer')
      const interest = await prisma.interest.findUniqueOrThrow({ where: { id: viewing.interestId! }, select: { stage: true } })
      assertEq(interest.stage, 'Viewing booked', "the buyer's interest moved to Viewing booked")

      section('feedback is one structured row per viewing')
      await recordViewingFeedback(viewing.id, ctx, {
        interestLevel: 4, priceVerdict: 'neutral', conditionVerdict: 'positive', locationVerdict: 'positive', layoutVerdict: 'negative',
        comments: 'Loved the terrace, kitchen is dated.',
      })
      await recordViewingFeedback(viewing.id, ctx, { interestLevel: 5 })
      const feedback = await prisma.viewingFeedback.findMany({ where: { meetingId: viewing.id } })
      assertEq(feedback.length, 1, 'revising updates the row rather than adding a second')
      assertEq(feedback[0].interestLevel, 5, 'the revision applied')
      assertEq(feedback[0].conditionVerdict, 'positive', 'and the earlier verdicts survived it')
      assertEq((await prisma.meeting.findUniqueOrThrow({ where: { id: viewing.id }, select: { status: true } })).status, 'completed', 'the meeting is settled')
      assertEq((await prisma.interest.findUniqueOrThrow({ where: { id: viewing.interestId! }, select: { stage: true } })).stage, 'Viewing done', 'and the buyer moved on')

      section('the feedback shows on the property, the interest and the lead timeline')
      const onProperty = await prisma.activity.count({ where: { propertyId: property.id, type: 'viewing_feedback' } })
      const onInterest = await prisma.activity.count({ where: { interestId: viewing.interestId!, type: 'viewing_feedback' } })
      const onLead = await prisma.activity.count({ where: { leadId: buyer.id, type: 'viewing_feedback' } })
      assertEq(onProperty, 2, 'property timeline (one per save)')
      assertEq(onInterest, 2, 'interest timeline')
      assertEq(onLead, 2, 'lead timeline')

      section('the vendor report query: what viewers said about this property')
      const said = await prisma.viewingFeedback.findMany({ where: { propertyId: property.id }, select: { locationVerdict: true } })
      assertEq(said.length, 1, 'one viewer so far')
      assertEq(said[0].locationVerdict, 'positive', 'verdicts are readable per dimension')
    } finally {
      await cleanup(prisma, fixture)
      await prisma.$disconnect()
    }
  })
}

if (require.main === module) {
  scenario()
}
