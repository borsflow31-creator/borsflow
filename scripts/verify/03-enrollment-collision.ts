/**
 * Scenario 3 — the enrollment collision, which is the whole reason Part A exists.
 *
 * A buyer booking viewings on two properties must sit in a viewing-follow-up
 * sequence twice, once per property, progressing independently. Keyed on
 * (automationId, leadId) that was impossible: the second enrollment collided
 * with the first, and the buyer silently got one sequence instead of two.
 *
 * Two halves, because the fix has two layers:
 *
 *   3a  the database layer — the unique constraint now admits two enrollments
 *       that share a lead but differ in subject, and still rejects a genuine
 *       duplicate. Runs with no Interest table: subjectId is polymorphic and
 *       deliberately has no foreign key, so synthetic subject ids exercise the
 *       constraint directly. This is the bottleneck fix.
 *
 *   3b  the dispatch layer — dispatchStageChanged actually creating those
 *       enrollments for two real interests on one buyer, plus the re-entry and
 *       concurrency behaviour. Needs the Interest table and its subject loader,
 *       so it is skipped until those exist, and reports as skipped rather than
 *       passing vacuously.
 */

import { assert, assertEq, assertThrows, cleanup, makeWorkspace, runScenario, section, useVerifyDatabase, verifyClient, uid } from './_harness'

export default function scenario() {
  return runScenario('03 enrollment collision', async () => {
    useVerifyDatabase()
    const prisma = verifyClient()
    const fixture = await makeWorkspace(prisma, 'enroll')

    try {
      const buyer = await prisma.lead.create({
        data: {
          firstName: 'Amara',
          lastName: 'Okonkwo',
          email: `buyer-${uid()}@verify.invalid`,
          pipelineId: fixture.pipelines.Lead,
          stage: 'Qualified',
        },
        select: { id: true },
      })

      const automation = await prisma.emailAutomation.create({
        data: {
          name: 'Viewing follow-up',
          workspaceId: fixture.workspaceId,
          subjectType: 'Interest',
          status: 'active',
          steps: {
            create: [
              { order: 0, name: 'Thanks for viewing', delayMinutes: 0 },
              { order: 1, name: 'Any thoughts?', delayMinutes: 2880 },
            ],
          },
        },
        select: { id: true },
      })

      // Stand-ins for two interests on two different properties. subjectId has no
      // foreign key by design, which is exactly what lets this test the
      // constraint without the Interest table existing yet.
      const interestA = `interest-${uid()}`
      const interestB = `interest-${uid()}`

      section('3a one buyer, two subjects, two independent enrollments')
      const enrol = (subjectId: string) =>
        prisma.automationEnrollment.create({
          data: {
            automationId: automation.id,
            subjectType: 'Interest',
            subjectId,
            leadId: buyer.id,
            workspaceId: fixture.workspaceId,
            status: 'active',
            currentStepOrder: 0,
            nextStepAt: new Date(),
          },
          select: { id: true },
        })

      const a = await enrol(interestA)
      const b = await enrol(interestB)
      assert(a.id !== b.id, 'two distinct enrollment rows')

      assertEq(
        await prisma.automationEnrollment.count({
          where: { automationId: automation.id, leadId: buyer.id },
        }),
        2,
        'one buyer holds two enrollments in the same automation (keyed on the lead this was impossible)'
      )

      section('they progress independently')
      await prisma.automationEnrollment.update({
        where: { id: a.id },
        data: { currentStepOrder: 1, status: 'active' },
      })
      const [rowA, rowB] = await Promise.all([
        prisma.automationEnrollment.findUniqueOrThrow({ where: { id: a.id }, select: { currentStepOrder: true, status: true } }),
        prisma.automationEnrollment.findUniqueOrThrow({ where: { id: b.id }, select: { currentStepOrder: true, status: true } }),
      ])
      assertEq(rowA.currentStepOrder, 1, 'subject A advanced')
      assertEq(rowB.currentStepOrder, 0, 'subject B did not move with it')

      await prisma.automationEnrollment.update({ where: { id: a.id }, data: { status: 'completed' } })
      assertEq(
        (await prisma.automationEnrollment.findUniqueOrThrow({ where: { id: b.id }, select: { status: true } })).status,
        'active',
        'completing one sequence leaves the other running'
      )

      section('a genuine duplicate is still rejected')
      await assertThrows(
        () => enrol(interestA),
        'a second enrollment for the same (automation, subjectType, subjectId) must violate the unique constraint'
      )

      section('the same subject id under a different subject type is a different row')
      // subjectType is part of the identity, so an id colliding across tables
      // cannot merge two unrelated enrollments.
      await prisma.automationEnrollment.create({
        data: {
          automationId: automation.id,
          subjectType: 'Mandate',
          subjectId: interestA,
          leadId: buyer.id,
          workspaceId: fixture.workspaceId,
          status: 'active',
          nextStepAt: new Date(),
        },
      })
      assertEq(
        await prisma.automationEnrollment.count({ where: { automationId: automation.id, subjectId: interestA } }),
        2,
        'subjectType discriminates'
      )

      section('skipDuplicates makes enrollment idempotent without a read')
      // This is the mechanism dispatchStageChanged relies on: the insert's own
      // count is the decision, so two concurrent stage changes cannot both
      // conclude "not enrolled yet" and double-count activeEnrolled.
      const fresh = `interest-${uid()}`
      const row = {
        automationId: automation.id,
        subjectType: 'Interest',
        subjectId: fresh,
        leadId: buyer.id,
        workspaceId: fixture.workspaceId,
        status: 'active',
        currentStepOrder: 0,
        nextStepAt: new Date(),
      }
      const first = await prisma.automationEnrollment.createMany({ data: [row], skipDuplicates: true })
      assertEq(first.count, 1, 'first insert creates')
      const second = await prisma.automationEnrollment.createMany({ data: [row], skipDuplicates: true })
      assertEq(second.count, 0, 'second insert is a no-op, so the caller knows not to increment')

      const concurrent = await Promise.all(
        Array.from({ length: 20 }, () =>
          prisma.automationEnrollment.createMany({ data: [row], skipDuplicates: true })
        )
      )
      assertEq(
        concurrent.reduce((sum, r) => sum + r.count, 0),
        0,
        '20 concurrent inserts for an existing enrollment all report 0'
      )
      assertEq(
        await prisma.automationEnrollment.count({ where: { automationId: automation.id, subjectId: fresh } }),
        1,
        'still exactly one row'
      )

      section('the conditional revive is a lock: only a finished enrollment restarts')
      await prisma.automationEnrollment.updateMany({
        where: { automationId: automation.id, subjectId: fresh },
        data: { status: 'active', currentStepOrder: 3 },
      })
      const reviveActive = await prisma.automationEnrollment.updateMany({
        where: { automationId: automation.id, subjectType: 'Interest', subjectId: fresh, status: { not: 'active' } },
        data: { status: 'active', currentStepOrder: 0 },
      })
      assertEq(reviveActive.count, 0, 'an active enrollment is left mid-sequence')
      assertEq(
        (await prisma.automationEnrollment.findFirstOrThrow({ where: { automationId: automation.id, subjectId: fresh, subjectType: 'Interest' }, select: { currentStepOrder: true } })).currentStepOrder,
        3,
        'its step was not reset'
      )

      await prisma.automationEnrollment.updateMany({
        where: { automationId: automation.id, subjectId: fresh, subjectType: 'Interest' },
        data: { status: 'completed' },
      })
      const reviveDone = await prisma.automationEnrollment.updateMany({
        where: { automationId: automation.id, subjectType: 'Interest', subjectId: fresh, status: { not: 'active' } },
        data: { status: 'active', currentStepOrder: 0, completedAt: null },
      })
      assertEq(reviveDone.count, 1, 'a completed enrollment is revived from the top')

      section('a lead delete still reaches its enrollments through the contact FK')
      await prisma.lead.delete({ where: { id: buyer.id } })
      assertEq(
        await prisma.automationEnrollment.count({ where: { automationId: automation.id } }),
        0,
        'deleting the contact removes every enrollment that mails it'
      )

      section('3b one buyer, two real interests, enrolled twice through dispatchStageChanged')
      // The Part A acceptance test, end to end: the same buyer books viewings on
      // two properties, and each interest runs its own follow-up sequence.
      const { createInterest, updateInterest } = await import('../../src/lib/services/interests')
      const { automationEngine } = await import('../../src/lib/automation-engine')
      const ctx = { workspaceId: fixture.workspaceId, userId: fixture.userId }

      const makeProperty = (reference: string) =>
        prisma.property.create({
          data: {
            workspaceId: fixture.workspaceId,
            reference,
            title: `Flat ${reference}`,
            city: 'Lisbon',
            propertyType: 'apartment',
            status: 'live',
            price: 400000,
            pipelineId: fixture.pipelines.Property,
            stage: 'Live',
            listedAt: new Date(),
          },
          select: { id: true },
        })

      // The buyer from 3a was deleted with its cascade check; make a fresh one.
      const buyer2 = await prisma.lead.create({
        data: {
          firstName: 'Bea',
          lastName: 'Buyer',
          email: `bea-${uid()}@verify.invalid`,
          pipelineId: fixture.pipelines.Lead,
        },
        select: { id: true },
      })
      const [propA, propB, propC] = await Promise.all([makeProperty('P-A'), makeProperty('P-B'), makeProperty('P-C')])

      const followUp = await prisma.emailAutomation.create({
        data: {
          name: 'Viewing follow-up (interest)',
          workspaceId: fixture.workspaceId,
          subjectType: 'Interest',
          status: 'active',
          triggers: {
            create: [{
              type: 'stage_changed',
              conditions: JSON.stringify({ pipelineId: fixture.pipelines.Interest, toStage: 'Viewing done' }),
            }],
          },
          steps: { create: [{ order: 0, name: 'Thanks', delayMinutes: 0 }, { order: 1, name: 'Thoughts?', delayMinutes: 2880 }] },
        },
        select: { id: true },
      })

      const ivA = await createInterest(ctx, { leadId: buyer2.id, propertyId: propA.id })
      const ivB = await createInterest(ctx, { leadId: buyer2.id, propertyId: propB.id })
      assert(ivA.id !== ivB.id, 'one buyer holds two interests')

      await updateInterest(ivA.id, ctx, { stage: 'Viewing done' })
      await updateInterest(ivB.id, ctx, { stage: 'Viewing done' })

      const enrollments = await prisma.automationEnrollment.findMany({
        where: { automationId: followUp.id },
        select: { subjectId: true, leadId: true, status: true },
      })
      assertEq(enrollments.length, 2, 'the same buyer is enrolled twice, once per interest (was 1 when keyed on the lead)')
      assert(enrollments.every(e => e.leadId === buyer2.id), 'both enrollments mail the buyer')
      assertEq(new Set(enrollments.map(e => e.subjectId)).size, 2, 'on two different subjects')

      let counters = await prisma.emailAutomation.findUniqueOrThrow({ where: { id: followUp.id }, select: { totalEnrolled: true, activeEnrolled: true } })
      assertEq(counters.totalEnrolled, 2, 'totalEnrolled')
      assertEq(counters.activeEnrolled, 2, 'activeEnrolled')

      section('they progress independently: moving one interest on exits only its sequence')
      await updateInterest(ivB.id, ctx, { stage: 'Offer' })
      const after = await prisma.automationEnrollment.findMany({ where: { automationId: followUp.id }, select: { subjectId: true, status: true } })
      assertEq(after.find(e => e.subjectId === ivA.id)?.status, 'active', "A's sequence is untouched")
      assertEq(after.find(e => e.subjectId === ivB.id)?.status, 'exited', "B's sequence ended when B left the stage")

      section('re-entry revives the exited enrollment without a second row or a double count')
      await updateInterest(ivB.id, ctx, { stage: 'Viewing done' })
      assertEq(await prisma.automationEnrollment.count({ where: { automationId: followUp.id } }), 2, 'still two rows')
      counters = await prisma.emailAutomation.findUniqueOrThrow({ where: { id: followUp.id }, select: { totalEnrolled: true, activeEnrolled: true } })
      assertEq(counters.totalEnrolled, 2, 'totalEnrolled is not incremented by re-entry')
      assertEq(counters.activeEnrolled, 2, 'activeEnrolled is back to 2')

      section('a Lead automation does not fire on an interest stage change')
      const leadAutomation = await prisma.emailAutomation.create({
        data: {
          name: 'Lead only',
          workspaceId: fixture.workspaceId,
          subjectType: 'Lead',
          status: 'active',
          triggers: { create: [{ type: 'stage_changed', conditions: JSON.stringify({ toStage: 'Offer' }) }] },
          steps: { create: [{ order: 0, name: 'x', delayMinutes: 0 }] },
        },
        select: { id: true },
      })
      await updateInterest(ivA.id, ctx, { stage: 'Offer' })
      assertEq(await prisma.automationEnrollment.count({ where: { automationId: leadAutomation.id } }), 0, 'subject types do not cross')

      section('20 concurrent dispatches for one interest enroll it exactly once')
      const ivC = await createInterest(ctx, { leadId: buyer2.id, propertyId: propC.id })
      await prisma.interest.update({ where: { id: ivC.id }, data: { stage: 'Viewing done' } })
      const before = await prisma.emailAutomation.findUniqueOrThrow({ where: { id: followUp.id }, select: { activeEnrolled: true } })
      await Promise.all(
        Array.from({ length: 20 }, () =>
          automationEngine.dispatchStageChanged({
            subjectType: 'Interest',
            subjectId: ivC.id,
            pipelineId: fixture.pipelines.Interest,
            workspaceId: fixture.workspaceId,
            fromStage: 'Viewing booked',
            toStage: 'Viewing done',
          })
        )
      )
      assertEq(await prisma.automationEnrollment.count({ where: { automationId: followUp.id, subjectId: ivC.id } }), 1, 'one enrollment')
      const final = await prisma.emailAutomation.findUniqueOrThrow({ where: { id: followUp.id }, select: { activeEnrolled: true } })
      assertEq(final.activeEnrolled - before.activeEnrolled, 1, 'activeEnrolled rose by exactly one, so the counter cannot drift')
    } finally {
      await cleanup(prisma, fixture)
      await prisma.$disconnect()
    }
  })
}

if (require.main === module) {
  scenario()
}
