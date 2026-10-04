/**
 * Scenario 12 — mandate expiry: the work queue, the automation, de-listing, and the
 * vendor report.
 *
 * A mandate 20 days from its end appears in the renewal queue and triggers its
 * automation; one that has passed is expired and its property comes off the market;
 * running the watch again changes nothing; a renewed mandate that approaches a new
 * end date runs the sequence again, once.
 */

import { assert, assertEq, cleanup, makeWorkspace, runScenario, section, uid, useVerifyDatabase, verifyClient } from './_harness'

const DAY = 86_400_000

export default function scenario() {
  return runScenario('12 mandate expiry and vendor reports', async () => {
    useVerifyDatabase()
    const { runMandateWatch, expiringMandatesWhere } = await import('../../src/lib/crm/mandate-watch')
    const { renewMandate } = await import('../../src/lib/services/mandates')
    const { buildVendorReport, sendDueVendorReports } = await import('../../src/lib/crm/vendor-report')
    const prisma = verifyClient()
    const fixture = await makeWorkspace(prisma, 'expiry')
    const ctx = { workspaceId: fixture.workspaceId, userId: fixture.userId }
    const now = new Date()

    try {
      const vendor = await prisma.lead.create({
        data: { firstName: 'Vera', lastName: 'Vendor', email: `v-${uid()}@verify.invalid`, pipelineId: fixture.pipelines.Lead },
        select: { id: true },
      })
      const makeMandate = async (ref: string, days: number, extra: Record<string, unknown> = {}) => {
        const property = await prisma.property.create({
          data: { workspaceId: fixture.workspaceId, reference: `P-${ref}`, title: `Flat ${ref}`, city: 'Porto', propertyType: 'apartment', status: 'live', price: 500000, surfaceArea: 100, listedAt: new Date(now.getTime() - 30 * DAY), vendorId: vendor.id, pipelineId: fixture.pipelines.Property, stage: 'Live' },
          select: { id: true },
        })
        const mandate = await prisma.mandate.create({
          data: { workspaceId: fixture.workspaceId, reference: `M-${ref}`, propertyId: property.id, leadId: vendor.id, status: 'active', startDate: new Date(now.getTime() - 60 * DAY), endDate: new Date(now.getTime() + days * DAY), ...extra },
          select: { id: true },
        })
        return { property, mandate }
      }

      const soon = await makeMandate('SOON', 20)
      const later = await makeMandate('LATER', 90)
      const past = await makeMandate('PAST', -2)

      const reminder = await prisma.emailAutomation.create({
        data: {
          name: 'Renewal reminder', workspaceId: fixture.workspaceId, subjectType: 'Mandate', status: 'active',
          triggers: { create: [{ type: 'mandate_expiring', conditions: JSON.stringify({ withinDays: 30 }) }] },
          steps: { create: [{ order: 0, name: 'Time to renew', delayMinutes: 0 }] },
        },
        select: { id: true },
      })

      section('the renewal queue holds the mandate ending in 20 days, and the one already past, not the one in 90')
      const queue = await prisma.mandate.findMany({ where: expiringMandatesWhere(fixture.workspaceId, now), select: { id: true }, orderBy: { endDate: 'asc' } })
      assertEq(queue.map(m => m.id).join(','), [past.mandate.id, soon.mandate.id].join(','), 'soonest first, overdue included')

      section('the watch warns, starts the automation, and expires what has passed')
      const first = await runMandateWatch(now)
      assertEq(first.enrolled, 1, 'only the 20-day mandate was enrolled')
      assertEq(await prisma.automationEnrollment.count({ where: { automationId: reminder.id, subjectType: 'Mandate', subjectId: soon.mandate.id } }), 1, 'it triggered its automation')
      assertEq(await prisma.automationEnrollment.count({ where: { automationId: reminder.id, subjectId: later.mandate.id } }), 0, 'the 90-day one did not')
      assertEq(first.expired, 1, 'the past mandate was expired')
      assertEq((await prisma.mandate.findUniqueOrThrow({ where: { id: past.mandate.id } })).status, 'expired', 'marked expired')
      const delisted = await prisma.property.findUniqueOrThrow({ where: { id: past.property.id }, select: { status: true } })
      assertEq(delisted.status, 'expired', 'and its property comes off the market')
      assertEq((await prisma.property.findUniqueOrThrow({ where: { id: soon.property.id } })).status, 'live', 'while the others stay live')

      section('running it again changes nothing')
      const second = await runMandateWatch(now)
      assertEq(second.enrolled, 0, 'no second enrollment')
      assertEq(second.expired, 0, 'nothing left to expire')
      assertEq(await prisma.automationEnrollment.count({ where: { automationId: reminder.id } }), 1, 'still one enrollment')

      section('a finished sequence is not revived for the same end date, but is for a renewed term')
      await prisma.automationEnrollment.updateMany({ where: { automationId: reminder.id }, data: { status: 'completed', completedAt: new Date() } })
      assertEq((await runMandateWatch(now)).enrolled, 0, 'same end date: not run again on every tick')
      await renewMandate(soon.mandate.id, ctx, { endDate: new Date(now.getTime() + 25 * DAY).toISOString() })
      assertEq((await runMandateWatch(now)).enrolled, 1, 'a new term inside the window runs the sequence again')
      assertEq((await runMandateWatch(now)).enrolled, 0, 'once')

      section('renewing an expired mandate puts it back on the market')
      await renewMandate(past.mandate.id, ctx, { endDate: new Date(now.getTime() + 120 * DAY).toISOString() })
      assertEq((await prisma.mandate.findUniqueOrThrow({ where: { id: past.mandate.id } })).status, 'active', 'active again')

      section('the vendor report holds the numbers, and names no buyer')
      const buyer = await prisma.lead.create({
        data: { firstName: 'Secret', lastName: 'Buyer', email: `b-${uid()}@verify.invalid`, pipelineId: fixture.pipelines.Lead },
        select: { id: true },
      })
      const interest = await prisma.interest.create({
        data: { workspaceId: fixture.workspaceId, pipelineId: fixture.pipelines.Interest, stage: 'Enquiry', leadId: buyer.id, propertyId: soon.property.id },
        select: { id: true },
      })
      const meeting = await prisma.meeting.create({
        data: { workspaceId: fixture.workspaceId, title: 'Viewing', startTime: new Date(now.getTime() - DAY), endTime: new Date(now.getTime() - DAY + 1800_000), duration: 30, meetingType: 'in_person', platform: 'in_person', status: 'completed', propertyId: soon.property.id, interestId: interest.id, leadId: buyer.id },
        select: { id: true },
      })
      await prisma.viewingFeedback.create({
        data: { workspaceId: fixture.workspaceId, meetingId: meeting.id, propertyId: soon.property.id, interestId: interest.id, leadId: buyer.id, interestLevel: 4, priceVerdict: 'negative', locationVerdict: 'positive' },
      })
      const report = await buildVendorReport(soon.mandate.id)
      assert(report !== null, 'a report was built')
      assertEq(report!.enquiries, 1, 'one enquiry')
      assertEq(report!.viewings.total, 1, 'one viewing')
      assertEq(report!.feedback.price.negative, 1, 'a negative price verdict')
      assertEq(report!.feedback.location.positive, 1, 'a positive location verdict')
      assertEq(report!.viewings.averageInterest, 4, 'average interest')
      assertEq(JSON.stringify(report).includes('Secret'), false, 'no buyer is named anywhere in it')
      assertEq(JSON.stringify(report).includes('b-'), false, 'nor is an address leaked')

      section('the scheduled report is sent once per interval, and not to a suppressed vendor')
      await prisma.mandate.update({ where: { id: soon.mandate.id }, data: { mandateType: 'exclusive', reportEveryDays: 7, lastReportSentAt: null } })
      const sent = await sendDueVendorReports(now)
      assertEq(sent.sent, 1, 'the exclusive mandate with a schedule was sent its report')
      assertEq((await sendDueVendorReports(now)).sent, 0, 'not again inside the interval')
      assertEq((await sendDueVendorReports(new Date(now.getTime() + 8 * DAY))).sent, 1, 'but again after it')
      const vendorEmail = (await prisma.lead.findUniqueOrThrow({ where: { id: vendor.id } })).email!
      await prisma.emailUnsubscribe.create({ data: { workspaceId: fixture.workspaceId, email: vendorEmail, source: 'admin' } })
      assertEq((await sendDueVendorReports(new Date(now.getTime() + 20 * DAY))).sent, 0, 'an unsubscribed vendor is not mailed')
    } finally {
      await cleanup(prisma, fixture)
      await prisma.$disconnect()
    }
  })
}

if (require.main === module) {
  scenario()
}
