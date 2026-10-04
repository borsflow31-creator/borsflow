/**
 * Scenario 11 — an enquiry posted to the public endpoint creates the lead, attaches
 * the interest, and fires lead_created.
 *
 * Exercises the real route handler, so the honeypot, the payload cap and the rate
 * limit are tested as shipped, not as a model of them.
 */

import { assert, assertEq, cleanup, makeWorkspace, runScenario, section, uid, useVerifyDatabase, verifyClient } from './_harness'

export default function scenario() {
  return runScenario('11 enquiry intake', async () => {
    useVerifyDatabase()
    const { NextRequest } = await import('next/server')
    const { POST } = await import('../../src/app/api/public/enquiries/route')
    const prisma = verifyClient()
    const fixture = await makeWorkspace(prisma, 'intake')

    // Rate-limit rows persist between runs, so every run uses addresses of its own;
    // a fixed IP would make the scenario fail when repeated within the hour.
    const run = `${Math.floor(Math.random() * 200) + 20}.${Math.floor(Math.random() * 250)}`
    const ipFor = (n: number) => `10.${run}.${n}`
    const post = (body: unknown, ip = ipFor(7), raw?: string) =>
      POST(new NextRequest('http://localhost/api/public/enquiries', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body: raw ?? JSON.stringify(body),
      }))

    try {
      const property = await prisma.property.create({
        data: { workspaceId: fixture.workspaceId, reference: 'WEB-1', title: 'Flat on the form', city: 'Lisbon', propertyType: 'apartment', status: 'live', price: 300000 },
        select: { id: true },
      })
      // The automation the enquiry should start: a welcome sequence for new leads.
      const welcome = await prisma.emailAutomation.create({
        data: {
          name: 'Welcome', workspaceId: fixture.workspaceId, subjectType: 'Lead', status: 'active',
          triggers: { create: [{ type: 'lead_created', conditions: '{}' }] },
          steps: { create: [{ order: 0, name: 'Hello', delayMinutes: 0 }] },
        },
        select: { id: true },
      })

      section('a website enquiry creates the lead, attaches the interest, and starts the welcome automation')
      const email = `Visitor-${uid()}@Example.com`
      const res = await post({ workspaceId: fixture.workspaceId, firstName: 'Vera', lastName: 'Visitor', email, message: 'Is it still available?', propertyReference: 'WEB-1' })
      assertEq(res.status, 200, 'accepted')
      assertEq(JSON.stringify(await res.json()), '{"ok":true}', 'and the response reveals nothing about the lead')

      const lead = await prisma.lead.findFirstOrThrow({ where: { pipeline: { workspaceId: fixture.workspaceId }, email: { equals: email, mode: 'insensitive' } } })
      assertEq(lead.source, 'website', 'sourced as a website enquiry')
      assertEq(lead.pipelineId, fixture.pipelines.Lead, 'on the contacts board')
      const interest = await prisma.interest.findUniqueOrThrow({ where: { propertyId_leadId: { propertyId: property.id, leadId: lead.id } } })
      assertEq(interest.source, 'enquiry', 'attached to the property they named')
      assertEq(interest.stage, 'Enquiry', 'at the first buyer stage')
      assertEq(await prisma.automationEnrollment.count({ where: { automationId: welcome.id, subjectId: lead.id } }), 1, 'lead_created fired and enrolled them')
      assertEq(await prisma.activity.count({ where: { leadId: lead.id, type: 'lead_created' } }), 1, 'the creation is on the timeline')
      assertEq(await prisma.activity.count({ where: { leadId: lead.id, type: 'note_added' } }), 1, 'and so is what they wrote')

      section('a repeat enquiry is the same contact, with a second interest, not a second lead')
      const other = await prisma.property.create({
        data: { workspaceId: fixture.workspaceId, reference: 'WEB-2', title: 'Second flat', city: 'Lisbon', propertyType: 'apartment', status: 'live', price: 310000 },
        select: { id: true },
      })
      await post({ workspaceId: fixture.workspaceId, email: email.toLowerCase(), propertyId: other.id })
      assertEq(await prisma.lead.count({ where: { pipeline: { workspaceId: fixture.workspaceId }, email: { equals: email, mode: 'insensitive' } } }), 1, 'still one contact')
      assertEq(await prisma.interest.count({ where: { leadId: lead.id } }), 2, 'two interests')
      assertEq(await prisma.automationEnrollment.count({ where: { automationId: welcome.id, subjectId: lead.id } }), 1, 'not enrolled in the welcome sequence twice')

      section('an unknown property reference does not lose the enquiry')
      const e2 = `lost-${uid()}@example.com`
      assertEq((await post({ workspaceId: fixture.workspaceId, email: e2, propertyReference: 'NOPE' })).status, 200, 'accepted')
      const lost = await prisma.lead.findFirst({ where: { email: e2 } })
      assert(!!lost, 'the contact was still created')
      assertEq(await prisma.interest.count({ where: { leadId: lost!.id } }), 0, 'with nothing attached')

      section('the honeypot says yes and creates nothing')
      const bot = `bot-${uid()}@example.com`
      assertEq((await post({ workspaceId: fixture.workspaceId, email: bot, website: 'http://spam.example' })).status, 200, 'looks accepted')
      assertEq(await prisma.lead.count({ where: { email: bot } }), 0, 'but no lead exists')

      section('invalid and oversized input is rejected')
      assertEq((await post({ workspaceId: fixture.workspaceId, email: 'not-an-email' })).status, 400, 'a malformed address')
      assertEq((await post({ workspaceId: fixture.workspaceId })).status, 400, 'no way to reach them')
      assertEq((await post({ email: 'x@example.com' })).status, 400, 'no workspace')
      assertEq((await post({ workspaceId: 'does-not-exist', email: 'x@example.com' })).status, 400, 'an unknown workspace looks like any bad input')
      assertEq((await post(null, ipFor(50), '{"workspaceId":"x","message":"' + 'a'.repeat(20_000) + '"}')).status, 413, 'an oversized payload')
      assertEq((await post(null, ipFor(51), '[1,2]')).status, 400, 'a non-object body')

      section('an unsubscribed address is recorded but never enrolled')
      const gone = `gone-${uid()}@example.com`
      await prisma.emailUnsubscribe.create({ data: { workspaceId: fixture.workspaceId, email: gone, source: 'admin' } })
      await post({ workspaceId: fixture.workspaceId, email: gone, firstName: 'Gone' }, ipFor(60))
      const goneLead = await prisma.lead.findFirstOrThrow({ where: { email: gone } })
      assertEq(await prisma.automationEnrollment.count({ where: { subjectId: goneLead.id } }), 0, 'a captured address cannot resurrect an unsubscribed one')

      section('a flood from one address is rate limited, and others are unaffected')
      const statuses: number[] = []
      for (let i = 0; i < 12; i++) statuses.push((await post({ workspaceId: fixture.workspaceId, email: `flood-${i}-${uid()}@example.com` }, ipFor(9))).status)
      assertEq(statuses.slice(0, 10).every(s => s === 200), true, 'the first ten go through')
      assertEq(statuses[11], 429, 'then it is throttled')
      assertEq((await post({ workspaceId: fixture.workspaceId, email: `calm-${uid()}@example.com` }, ipFor(77))).status, 200, 'another address is not')

      section('CORS preflight is answered, since the form lives on the agency site')
      const { OPTIONS } = await import('../../src/app/api/public/enquiries/route')
      assertEq(OPTIONS().status, 204, 'OPTIONS')
    } finally {
      await cleanup(prisma, fixture)
      await prisma.$disconnect()
    }
  })
}

if (require.main === module) {
  scenario()
}
