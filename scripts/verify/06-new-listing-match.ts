/**
 * Scenario 6 — a new listing is matched to buyers' briefs.
 *
 * The scorer is pure; the matcher prefilters in SQL; recording is idempotent on
 * the unique (property, brief) pair; the buyer is mailed by a digest, claimed so
 * two overlapping runs cannot both send.
 */

import { scoreBriefAgainstProperty } from '../../src/lib/crm/brief-scoring'
import { assert, assertEq, cleanup, makeWorkspace, runScenario, section, uid, useVerifyDatabase, verifyClient } from './_harness'

export default function scenario() {
  return runScenario('06 new-listing matching', async () => {
    useVerifyDatabase()
    const { createProperty, updateProperty } = await import('../../src/lib/services/properties')
    const { createBrief, convertMatch } = await import('../../src/lib/services/search-briefs')
    const { sendMatchDigests } = await import('../../src/lib/crm/match-digest')
    const prisma = verifyClient()
    const fixture = await makeWorkspace(prisma, 'match')
    const ctx = { workspaceId: fixture.workspaceId, userId: fixture.userId }

    try {
      section('the scorer: hard requirements exclude, the score only ranks what fits')
      const flat = { transactionType: 'sale', propertyType: 'apartment', price: 400000, city: 'Lisbon', district: 'Alfama', surfaceArea: 100, bedrooms: 3, rooms: 4, hasParking: true, hasElevator: false }
      const fits = scoreBriefAgainstProperty({ transactionType: 'sale', priceMax: 450000, bedroomsMin: 2, cities: '["lisbon"]', propertyTypes: '["apartment"]' }, flat)
      assert(fits !== null && fits.score > 0 && fits.score <= 100, 'a flat inside the brief scores')
      assert(fits!.reasons.length > 0 && fits!.reasons.every(r => r.weight > 0), 'with reasons the UI can show')
      assertEq(scoreBriefAgainstProperty({ transactionType: 'sale', priceMax: 350000 }, flat), null, 'over budget is no match')
      assertEq(scoreBriefAgainstProperty({ transactionType: 'sale', bedroomsMin: 4 }, flat), null, 'too few bedrooms is no match')
      assertEq(scoreBriefAgainstProperty({ transactionType: 'sale', mustHaveElevator: true }, flat), null, 'a missing must-have is no match')
      assertEq(scoreBriefAgainstProperty({ transactionType: 'sale', cities: '["porto"]' }, flat), null, 'wrong city is no match')
      assertEq(scoreBriefAgainstProperty({ transactionType: 'rent' }, flat), null, 'wrong transaction is no match')
      assert(scoreBriefAgainstProperty({ transactionType: 'sale', priceMax: 410000 }, flat)!.score < scoreBriefAgainstProperty({ transactionType: 'sale', priceMax: 900000 }, flat)!.score, 'a listing near the ceiling ranks below one well inside it')
      assert(scoreBriefAgainstProperty({ transactionType: 'sale', criteria: JSON.stringify([{ field: 'district', operator: 'equals', value: 'Alfama' }]) }, flat) !== null, 'criteria use the segment evaluator')
      assertEq(scoreBriefAgainstProperty({ transactionType: 'sale', criteria: JSON.stringify([{ field: 'district', operator: 'equals', value: 'Baixa' }]) }, flat), null, 'and exclude when they do not match')

      section('three buyers register briefs: one fits, one is over budget, one needs parking')
      const buyer = async (name: string, ownerId?: string) => {
        const lead = await prisma.lead.create({
          data: { firstName: name, lastName: 'B', email: `${name}-${uid()}@verify.invalid`, pipelineId: fixture.pipelines.Lead },
          select: { id: true },
        })
        return lead
      }
      const [ana, ben, cat] = await Promise.all([buyer('ana'), buyer('ben'), buyer('cat')])
      const brief = (leadId: string, extra: Record<string, unknown>) => createBrief(ctx, { leadId, name: `brief ${uid()}`, cities: ['Lisbon'], ...extra })
      const a = await brief(ana.id, { priceMax: 500000, bedroomsMin: 2 })
      const b = await brief(ben.id, { priceMax: 300000 })
      const c = await brief(cat.id, { priceMax: 500000, mustHaveParking: true })

      section('a property created live matches exactly the brief that fits')
      const property = await createProperty(ctx, {
        title: 'Sunny T3', city: 'Lisbon', propertyType: 'apartment', status: 'live', price: 400000, bedrooms: 3, surfaceArea: 90,
      })
      let matches = await prisma.propertyMatch.findMany({ where: { propertyId: property.id } })
      assertEq(matches.length, 1, 'one match')
      assertEq(matches[0].searchBriefId, a.brief.id, 'the right brief')
      assertEq(matches[0].status, 'new', 'waiting for the digest')
      assert(matches[0].score > 0 && Array.isArray(matches[0].reasons) && (matches[0].reasons as unknown[]).length > 0, 'scored, with reasons')
      void b; void c

      section('re-running the matcher does not duplicate (idempotent on the unique pair)')
      const { onPropertyListed } = await import('../../src/lib/crm/matching')
      await onPropertyListed(property.id, 'new')
      await onPropertyListed(property.id, 'new')
      assertEq(await prisma.propertyMatch.count({ where: { propertyId: property.id } }), 1, 'still one row')

      section('a price drop brings in the buyer who was over budget, and leaves the first untouched')
      await prisma.propertyMatch.updateMany({ where: { propertyId: property.id }, data: { status: 'notified', notifiedAt: new Date() } })
      await updateProperty(property.id, ctx, { price: 280000 })
      matches = await prisma.propertyMatch.findMany({ where: { propertyId: property.id } })
      assertEq(matches.length, 3 - 1, 'now two buyers: the over-budget one fits (the parking one still does not)')
      assertEq(matches.find(m => m.searchBriefId === a.brief.id)?.status, 'notified', 'the first buyer is not re-notified')
      assertEq(matches.find(m => m.searchBriefId === b.brief.id)?.status, 'new', 'the new one is waiting')

      section('the digest mails each buyer once, however many matches, and only the unsent')
      const extra = await createProperty(ctx, { title: 'Second', city: 'Lisbon', propertyType: 'apartment', status: 'live', price: 250000, bedrooms: 2 })
      void extra
      const first = await sendMatchDigests()
      assert(first.digests >= 1, 'a digest was sent')
      const queued = await prisma.emailRecipient.findMany({ where: { leadId: { in: [ana.id, ben.id] } }, select: { leadId: true } })
      const perBuyer = new Map<string, number>()
      for (const r of queued) perBuyer.set(r.leadId!, (perBuyer.get(r.leadId!) ?? 0) + 1)
      for (const [, count] of perBuyer) assertEq(count, 1, 'one email per buyer, not one per property')
      const second = await sendMatchDigests()
      assertEq(second.digests, 0, 'nothing left to send, so a second run sends nothing')

      section('two overlapping digest runs claim each match once')
      const another = await createProperty(ctx, { title: 'Third', city: 'Lisbon', propertyType: 'apartment', status: 'live', price: 260000, bedrooms: 2 })
      void another
      const before = await prisma.emailRecipient.count({ where: { leadId: { in: [ana.id, ben.id] } } })
      await Promise.all([sendMatchDigests(), sendMatchDigests()])
      const after = await prisma.emailRecipient.count({ where: { leadId: { in: [ana.id, ben.id] } } })
      assert(after - before <= 2, `at most one digest per buyer across both runs (sent ${after - before})`)

      section('a suppressed address is not mailed, and its matches are set aside')
      const dora = await buyer('dora')
      const doraEmail = (await prisma.lead.findUniqueOrThrow({ where: { id: dora.id } })).email!
      await prisma.emailUnsubscribe.create({ data: { workspaceId: fixture.workspaceId, email: doraEmail, source: 'admin' } })
      await brief(dora.id, { priceMax: 900000 })
      await createProperty(ctx, { title: 'Fourth', city: 'Lisbon', propertyType: 'apartment', status: 'live', price: 270000, bedrooms: 2 })
      await sendMatchDigests()
      assertEq(await prisma.emailRecipient.count({ where: { leadId: dora.id } }), 0, 'no email queued')
      assert((await prisma.propertyMatch.count({ where: { leadId: dora.id, status: 'dismissed' } })) > 0, 'her matches were set aside rather than retried forever')

      section('an agent turns a match into an interest, with the attribution captured')
      const match = await prisma.propertyMatch.findFirstOrThrow({ where: { leadId: ana.id } })
      const converted = await convertMatch(match.id, ctx)
      assertEq(converted.status, 'converted', 'the match is converted')
      const interest = await prisma.interest.findUniqueOrThrow({ where: { id: converted.interestId! } })
      assertEq(interest.source, 'match', 'the interest remembers it came from a match')
      assertEq(interest.searchBriefId, a.brief.id, 'and which brief found it')
      assertEq(interest.matchScore, match.score, 'and how well it fit')

      section('a property that is not live matches no one')
      const draft = await createProperty(ctx, { title: 'Draft', city: 'Lisbon', propertyType: 'apartment', status: 'prospect', price: 100000 })
      assertEq(await prisma.propertyMatch.count({ where: { propertyId: draft.id } }), 0, 'prospects are not announced')
    } finally {
      await cleanup(prisma, fixture)
      await prisma.$disconnect()
    }
  })
}

if (require.main === module) {
  scenario()
}
