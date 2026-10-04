/**
 * Scenario 13 — commissions, the public surface, and plan capacity.
 *
 *  a. Accepting an offer accrues exactly one commission, split without exceeding it.
 *  b. The shares can be re-cut, but not past 100% and not by a non-admin.
 *  c. The forecast reads the live pipeline; a sale at a different price re-shares the
 *     realized commission at the price it closed at; a paid commission is frozen.
 *  d. A public listing and a portal feed carry only the allow-listed fields: the
 *     street of a private address, the vendor and the listing agent never appear, and a
 *     rotated token kills the old link.
 *  e. Stock limits count what exists, so closing a listing frees its place.
 */

import { assert, assertEq, assertThrows, cleanup, makeWorkspace, runScenario, section, uid, useVerifyDatabase, verifyClient } from './_harness'

const SECRET_STREET = '12 Rua Secreta'

export default function scenario() {
  return runScenario('13 commissions, public surface and capacity', async () => {
    useVerifyDatabase()
    const { acceptOffer, createOffer } = await import('../../src/lib/services/offers')
    const { createInterest } = await import('../../src/lib/services/interests')
    const { createMandate } = await import('../../src/lib/services/mandates')
    const { updateProperty } = await import('../../src/lib/services/properties')
    const commissions = await import('../../src/lib/services/commissions')
    const { loadPublicListing } = await import('../../src/lib/crm/public-listing')
    const { renderPortalFeed } = await import('../../src/lib/crm/portal-feed')
    const { mintToken } = await import('../../src/lib/crm/public-links')
    const { capacityError } = await import('../../src/lib/billing/capacity')
    const prisma = verifyClient()
    const fixture = await makeWorkspace(prisma, 'money')
    const ctx = { workspaceId: fixture.workspaceId, userId: fixture.userId }
    const admin = { ...ctx, canModerate: true }

    const vendorEmail = `vendor-${uid()}@verify.invalid`
    const vendor = await prisma.lead.create({
      data: { firstName: 'Vera', lastName: 'Vendor', email: vendorEmail, pipelineId: fixture.pipelines.Lead },
      select: { id: true },
    })

    const makeListing = async (title: string, price: number, extra: Record<string, unknown> = {}) => {
      const property = await prisma.property.create({
        data: {
          workspaceId: fixture.workspaceId, reference: `M-${uid()}`, title, city: 'Lisbon', propertyType: 'apartment',
          status: 'live', price, pipelineId: fixture.pipelines.Property, stage: 'Live', listedAt: new Date(),
          vendorId: vendor.id, ownerId: fixture.userId, description: 'Bright and quiet.',
          addressLine: SECRET_STREET, isAddressPublic: false, latitude: 38.72231, longitude: -9.13931,
          ...extra,
        },
        select: { id: true },
      })
      await createMandate(ctx, { propertyId: property.id, status: 'active', mandateType: 'exclusive', feeType: 'percent', commissionPercent: 5, askingPrice: price })
      return property
    }

    const buyer = async (propertyId: string) => {
      const lead = await prisma.lead.create({
        data: { firstName: 'Bea', lastName: 'Buyer', email: `bea-${uid()}@verify.invalid`, pipelineId: fixture.pipelines.Lead },
        select: { id: true },
      })
      return createInterest(ctx, { leadId: lead.id, propertyId })
    }

    try {
      const a = await makeListing('Sold flat', 500_000)
      const b = await makeListing('Forecast flat', 400_000)

      section('forecast before any offer: fee at asking price, weighted by stage')
      const before = await commissions.forecast(fixture.workspaceId)
      assertEq(before.potential, 45_000, '5% of 500k + 5% of 400k')
      assertEq(before.weighted, 0.25 * 45_000, 'both live, so weighted at the live rate')

      section('accepting an offer accrues exactly one commission')
      const interest = await buyer(a.id)
      const offer = await createOffer(ctx, { interestId: interest.id, amount: 500_000 })
      await acceptOffer(offer.id, ctx)
      const accrued = await prisma.commission.findMany({ where: { propertyId: a.id }, include: { splits: true } })
      assertEq(accrued.length, 1, 'one commission for the sale')
      assertEq(accrued[0].status, 'accrued', 'accrued, not yet earned')
      assertEq(accrued[0].grossAmount, 25_000, 'a 5% fee on the offer')
      const sum = accrued[0].splits.reduce((s, x) => s + x.amount, 0)
      assert(accrued[0].splits.length > 0 && sum <= accrued[0].grossAmount + 0.01, `splits (${sum}) do not exceed the commission`)
      assert(accrued[0].splits.some(s => s.role === 'agency'), 'the agency has a share')

      section('re-cutting the shares: bounded, and admin only')
      await assertThrows(() => commissions.setSplits(accrued[0].id, admin, [
        { role: 'listing_agent', userId: fixture.userId, sharePercent: 70 },
        { role: 'agency', sharePercent: 40 },
      ]), 'shares over 100% are refused')
      await assertThrows(() => commissions.setSplits(accrued[0].id, { ...admin, canModerate: false }, [{ role: 'agency', sharePercent: 100 }]), 'a non-admin cannot re-cut')
      await assertThrows(() => commissions.setSplits(accrued[0].id, admin, [{ role: 'listing_agent', userId: 'not-a-member', sharePercent: 50 }]), 'a share to a non-member is refused')
      const recut = await commissions.setSplits(accrued[0].id, admin, [
        { role: 'listing_agent', userId: fixture.userId, sharePercent: 60 },
        { role: 'agency', sharePercent: 40 },
      ])
      assertEq(recut.splits.find(s => s.role === 'agency')?.amount, 10_000, '40% of 25,000')
      assertEq(recut.splits.find(s => s.role === 'listing_agent')?.amount, 15_000, '60% of 25,000')

      section('the forecast now weights the property under offer higher')
      const mid = await commissions.forecast(fixture.workspaceId)
      assertEq(mid.weighted, 0.8 * 25_000 + 0.25 * 20_000, 'under offer at 0.8, live at 0.25')

      section('only a realized commission can be paid')
      await assertThrows(() => commissions.markPaid(accrued[0].id, admin), 'an accrued commission is not owed yet')

      section('the sale closes at a different price: realized and re-shared at that price')
      await updateProperty(a.id, ctx, { status: 'sold', soldPrice: 480_000 })
      const realized = await prisma.commission.findUniqueOrThrow({ where: { id: accrued[0].id }, include: { splits: true } })
      assertEq(realized.status, 'realized', 'the sale closed')
      assertEq(realized.grossAmount, 24_000, '5% of the 480k it closed at')
      assertEq(realized.splits.find(s => s.role === 'agency')?.amount, 9_600, 'the agency share follows the new total')
      assertEq((await prisma.mandate.findFirstOrThrow({ where: { propertyId: a.id } })).status, 'completed', 'the mandate is completed')

      section('paid is final')
      await commissions.markPaid(accrued[0].id, admin)
      await assertThrows(() => commissions.setSplits(accrued[0].id, admin, [{ role: 'agency', sharePercent: 100 }]), 'a paid commission cannot be re-cut')
      const paid = await prisma.commissionSplit.findMany({ where: { commissionId: accrued[0].id } })
      assert(paid.every(s => s.status === 'paid'), 'every share is paid with it')

      section('a public listing carries only the allow-listed fields')
      const media = await prisma.propertyMedia.create({
        data: { propertyId: b.id, workspaceId: fixture.workspaceId, kind: 'photo', filePath: `crm/${fixture.workspaceId}/properties/${b.id}/x.jpg`, fileName: 'x.jpg', fileType: 'image/jpeg', isCover: true },
        select: { id: true },
      })
      const { token } = await mintToken('property', b.id)
      assertEq(await loadPublicListing(token), null, 'unpublished: the link shows nothing')
      await prisma.property.update({ where: { id: b.id }, data: { isPublished: true, publishedAt: new Date() } })
      const listing = await loadPublicListing(token)
      assert(listing, 'published and live: visible')
      const serialized = JSON.stringify(listing)
      assert(!serialized.includes(SECRET_STREET), 'a private address is withheld')
      assert(!serialized.includes(vendorEmail), 'the vendor never appears')
      assert(!serialized.includes('Vera'), 'nor the vendor name')
      assert(!serialized.includes('verify.invalid'), 'nor any email at all')
      assert(listing!.latitude !== 38.72231, 'a private home is shown only approximately')
      assert(listing!.media[0].url.includes(`/api/public/properties/${token}/media/${media.id}`), 'images go through the proxy, not the bucket')
      assert(!listing!.media[0].url.includes('crm/'), 'the storage path is not exposed')

      section('a portal feed carries the same, and only published live stock')
      const feed = await prisma.portalFeed.create({
        data: { workspaceId: fixture.workspaceId, name: 'Test', portal: 'idealista', format: 'xml', token: `t-${uid()}` },
      })
      const rendered = await renderPortalFeed(feed)
      assertEq(rendered.count, 1, 'only the published, live property (the sold one is out)')
      assert(!rendered.body.includes(SECRET_STREET) && !rendered.body.includes(vendorEmail), 'the feed withholds the same fields')
      const json = await renderPortalFeed({ ...feed, format: 'json' })
      assert(!json.body.includes(SECRET_STREET), 'and so does the JSON form')
      await prisma.property.update({ where: { id: b.id }, data: { isPublished: false } })
      assertEq((await renderPortalFeed(feed)).count, 0, 'unpublishing removes it from the feed')
      assertEq(await loadPublicListing(token), null, 'and from its public page')
      await prisma.property.update({ where: { id: b.id }, data: { isPublished: true } })

      section('each token resolves to its own listing, and an unknown token to nothing')
      const other = await makeListing('Another flat', 300_000)
      await prisma.property.update({ where: { id: other.id }, data: { isPublished: true } })
      const otherToken = (await mintToken('property', other.id)).token
      assertEq((await loadPublicListing(otherToken))?.title, 'Another flat', 'the second link shows the second listing')
      assertEq((await loadPublicListing(token))?.title, 'Forecast flat', 'the first still shows the first')
      assertEq(await loadPublicListing(`nope-${uid()}`), null, 'a token that matches nothing shows nothing')
      await prisma.property.update({ where: { id: other.id }, data: { isPublished: false } })

      section('rotating the link kills the old one')
      const rotated = await mintToken('property', b.id, { rotate: true })
      assert(rotated.token !== token, 'a new token')
      assertEq(await loadPublicListing(token), null, 'the old link no longer resolves')
      assert(await loadPublicListing(rotated.token), 'the new one does')

      section('stock limits count what exists (Free plan)')
      const status = async (resource: Parameters<typeof capacityError>[1], opts: Parameters<typeof capacityError>[2] = {}) =>
        (await capacityError(fixture.workspaceId, resource, opts))?.status ?? null
      assertEq(await status('portalFeeds'), 402, 'Free includes no portal feeds')
      assertEq(await status('pipelines', { subjectType: 'Lead' }), 402, 'one board per kind on Free, and the seeded one is it')
      assertEq(await status('properties'), null, 'two properties in play, plenty of room')

      await prisma.property.createMany({
        data: Array.from({ length: 23 }, (_, n) => ({
          workspaceId: fixture.workspaceId, reference: `CAP-${uid()}-${n}`, title: `Filler ${n}`, city: 'Porto', propertyType: 'apartment',
          status: 'live', price: 100_000, pipelineId: fixture.pipelines.Property, stage: 'Live',
        })),
      })
      assertEq(await status('properties'), 402, '25 in play: the next one is refused')
      const body = await (await capacityError(fixture.workspaceId, 'properties'))!.json()
      assertEq(body.code, 'PLAN_LIMIT', 'with the code the upgrade prompt listens for')
      assertEq(body.limit, 25, 'and the limit')

      await prisma.property.updateMany({ where: { workspaceId: fixture.workspaceId, title: 'Filler 0' }, data: { status: 'sold' } })
      assertEq(await status('properties'), null, 'a sold listing frees its place straight away')

      section('a higher plan lifts the limit')
      await prisma.workspace.update({ where: { id: fixture.workspaceId }, data: { plan: 'STARTER' } })
      assertEq(await status('portalFeeds'), 402, 'Starter allows one feed and one exists')
      await prisma.portalFeed.delete({ where: { id: feed.id } })
      assertEq(await status('portalFeeds'), null, 'so a deleted feed makes room')
      await prisma.workspace.update({ where: { id: fixture.workspaceId }, data: { plan: 'PRO' } })
      assertEq(await status('pipelines', { subjectType: 'Lead' }), null, 'Pro has unlimited boards')
    } catch (error) {
      throw error
    } finally {
      await cleanup(prisma, fixture)
      await prisma.$disconnect()
    }
  })
}

if (require.main === module) {
  scenario()
}
