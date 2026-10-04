/**
 * Scenario 7 — competing offers: accepting one rejects the rest, atomically.
 *
 * The Property row is the mutex: acceptOffer's first write moves it 'live' ->
 * 'under_offer' conditionally, so of two concurrent accepts exactly one gets
 * past it. The loser throws and rolls back before it can reject the winner.
 */

import { assert, assertEq, cleanup, makeWorkspace, runScenario, section, uid, useVerifyDatabase, verifyClient } from './_harness'

export default function scenario() {
  return runScenario('07 competing offers', async () => {
    useVerifyDatabase()
    const { acceptOffer, createOffer, withdrawOffer } = await import('../../src/lib/services/offers')
    const { createInterest } = await import('../../src/lib/services/interests')
    const prisma = verifyClient()
    const fixture = await makeWorkspace(prisma, 'offers')
    const ctx = { workspaceId: fixture.workspaceId, userId: fixture.userId }

    const setup = async () => {
      const property = await prisma.property.create({
        data: {
          workspaceId: fixture.workspaceId, reference: `O-${uid()}`, title: 'Contested flat', city: 'Porto', propertyType: 'apartment',
          status: 'live', price: 500000, pipelineId: fixture.pipelines.Property, stage: 'Live', listedAt: new Date(),
        },
        select: { id: true },
      })
      const buyers = []
      for (const name of ['Alma', 'Bruno', 'Clara']) {
        const lead = await prisma.lead.create({
          data: { firstName: name, lastName: 'Buyer', email: `${name}-${uid()}@verify.invalid`, pipelineId: fixture.pipelines.Lead },
          select: { id: true },
        })
        const interest = await createInterest(ctx, { leadId: lead.id, propertyId: property.id })
        buyers.push({ lead, interest })
      }
      return { property, buyers }
    }

    try {
      section('two buyers make competing offers on one live property')
      const { property, buyers } = await setup()
      const [a, b, c] = await Promise.all(
        [510000, 525000, 495000].map((amount, i) => createOffer(ctx, { interestId: buyers[i].interest.id, amount }))
      )
      assertEq(await prisma.offer.count({ where: { propertyId: property.id, status: 'pending' } }), 3, 'three pending offers')

      section('accepting one rejects the others in the same transaction')
      const result = await acceptOffer(b.id, ctx)
      assertEq(result.offer.status, 'accepted', 'the chosen offer is accepted')
      assertEq(result.rejected.length, 2, 'both rivals are reported as rejected')
      const statuses = await prisma.offer.findMany({ where: { propertyId: property.id }, select: { id: true, status: true, decisionReason: true } })
      assertEq(statuses.find(o => o.id === a.id)?.status, 'rejected', 'A rejected')
      assertEq(statuses.find(o => o.id === c.id)?.status, 'rejected', 'C rejected')
      assertEq(statuses.find(o => o.id === a.id)?.decisionReason, 'another_offer_accepted', 'with the reason recorded')
      const prop = await prisma.property.findUniqueOrThrow({ where: { id: property.id }, select: { status: true, stage: true } })
      assertEq(prop.status, 'under_offer', 'the property is under offer')
      assertEq(prop.stage, 'Under offer', 'and its card moved to the matching column')

      section("the losers' buyers are lost, the winner is not")
      const interests = await prisma.interest.findMany({ where: { propertyId: property.id }, select: { id: true, status: true } })
      assertEq(interests.find(i => i.id === buyers[1].interest.id)?.status, 'active', 'winner stays active')
      assertEq(interests.find(i => i.id === buyers[0].interest.id)?.status, 'lost', 'A lost')
      assertEq(interests.find(i => i.id === buyers[2].interest.id)?.status, 'lost', 'C lost')

      section('one commission accrued for the sale, shared within its total')
      const commissions = await prisma.commission.findMany({ where: { propertyId: property.id, status: { not: 'cancelled' } }, include: { splits: true } })
      assertEq(commissions.length, 1, 'exactly one live commission')
      assert(commissions[0].splits.reduce((s, x) => s + x.amount, 0) <= commissions[0].grossAmount + 0.01, 'splits do not exceed the commission')

      section('an accepted offer cannot be accepted or decided again')
      let again = false
      try { await acceptOffer(b.id, ctx) } catch { again = true }
      assert(again, 'a second accept is refused')

      section('withdrawing the accepted offer puts the property back on the market')
      await withdrawOffer(b.id, ctx)
      const back = await prisma.property.findUniqueOrThrow({ where: { id: property.id }, select: { status: true, stage: true } })
      assertEq(back.status, 'live', 'live again, so it can receive offers')
      assertEq(back.stage, 'Live', 'and back in its column')

      section('two concurrent accepts: exactly one wins, the other fails cleanly (20 rounds)')
      let wins = 0
      for (let round = 0; round < 20; round++) {
        const fx = await setup()
        const [x, y] = await Promise.all(
          [600000, 610000].map((amount, i) => createOffer(ctx, { interestId: fx.buyers[i].interest.id, amount }))
        )
        const outcomes = await Promise.allSettled([acceptOffer(x.id, ctx), acceptOffer(y.id, ctx)])
        const fulfilled = outcomes.filter(o => o.status === 'fulfilled').length
        assertEq(fulfilled, 1, `round ${round}: exactly one accept succeeds`)
        wins += fulfilled

        const rows = await prisma.offer.findMany({ where: { propertyId: fx.property.id }, select: { status: true } })
        assertEq(rows.filter(r => r.status === 'accepted').length, 1, `round ${round}: exactly one accepted offer`)
        assertEq(rows.filter(r => r.status === 'pending').length, 0, `round ${round}: nothing left pending`)
        const p = await prisma.property.findUniqueOrThrow({ where: { id: fx.property.id }, select: { status: true } })
        assertEq(p.status, 'under_offer', `round ${round}: property under offer`)
        assertEq(await prisma.commission.count({ where: { propertyId: fx.property.id } }), 1, `round ${round}: exactly one commission`)
      }
      assertEq(wins, 20, 'one winner per round')

      section('offers cannot be made on a property that is not on the market')
      const sold = await prisma.property.create({
        data: { workspaceId: fixture.workspaceId, reference: `S-${uid()}`, title: 'Sold', city: 'Porto', propertyType: 'apartment', status: 'sold', pipelineId: fixture.pipelines.Property, stage: 'Sold' },
        select: { id: true },
      })
      const lead = await prisma.lead.create({
        data: { firstName: 'Dora', lastName: 'Buyer', email: `d-${uid()}@verify.invalid`, pipelineId: fixture.pipelines.Lead },
        select: { id: true },
      })
      const interest = await createInterest(ctx, { leadId: lead.id, propertyId: sold.id })
      let refused = false
      try { await createOffer(ctx, { interestId: interest.id, amount: 1 }) } catch { refused = true }
      assert(refused, 'an offer on a sold property is refused')
    } finally {
      await cleanup(prisma, fixture)
      await prisma.$disconnect()
    }
  })
}

if (require.main === module) {
  scenario()
}
