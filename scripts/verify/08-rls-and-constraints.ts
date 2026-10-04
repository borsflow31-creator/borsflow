/**
 * Scenario 8a — row-level security, and the constraints Prisma cannot see.
 *
 * Two things the schema file will not tell you:
 *
 *  - RLS. This database exposes the public schema through PostgREST, so a table
 *    without RLS is readable with the publishable key. The convention is RLS on
 *    with no policies: anon and authenticated are denied every row, while Prisma
 *    connects as a role with BYPASSRLS. Three migrations had already forgotten
 *    it before this work started, so the check is a sweep over every table
 *    rather than a list — a table added later that forgets RLS fails here.
 *
 *  - The CHECK constraints tying SegmentMember.leadId and
 *    AutomationEnrollment.leadId to subjectType. Prisma 5 cannot model a CHECK,
 *    so nothing in the schema or the generated client hints that they exist.
 *
 * The capacity half of scenario 8 arrives with the plan metrics in phase 4.
 */

import { assert, assertEq, assertThrows, cleanup, makeWorkspace, runScenario, section, useVerifyDatabase, verifyClient, uid } from './_harness'

export default function scenario() {
  return runScenario('08a RLS and database constraints', async () => {
    useVerifyDatabase()
    const prisma = verifyClient()

    try {
      section('every table in the public schema has RLS enabled')
      const unprotected = await prisma.$queryRawUnsafe<{ relname: string }[]>(
        `select c.relname
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relkind = 'r'
            and not c.relrowsecurity
          order by c.relname`
      )
      assertEq(
        unprotected.length,
        0,
        `tables without row-level security: ${unprotected.map(r => r.relname).join(', ')}`
      )

      section('no policies exist, which is what makes it deny-all')
      // A policy would grant the anon role rows. The app is unaffected either
      // way because it connects as the table owner, so a well-meaning policy
      // added here would only ever widen exposure.
      const policies = await prisma.$queryRawUnsafe<{ tablename: string; policyname: string }[]>(
        `select tablename, policyname from pg_policies where schemaname = 'public' order by tablename`
      )
      assertEq(
        policies.length,
        0,
        `unexpected policies: ${policies.map(p => `${p.tablename}.${p.policyname}`).join(', ')}`
      )

      section('the five tables remediated by 20261007000000 are covered')
      // Named explicitly as well as swept, so a regression points straight at
      // the migration that fixed them.
      for (const table of ['ChannelMember', 'ChannelRead', 'MessageReaction', 'ProductCustomField', 'LeadFile']) {
        const rows = await prisma.$queryRawUnsafe<{ relrowsecurity: boolean }[]>(
          `select c.relrowsecurity
             from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname = $1`,
          table
        )
        assert(rows.length === 1, `${table} exists`)
        assert(rows[0].relrowsecurity, `${table} has RLS enabled`)
      }

      section('the polymorphic uniques replaced the lead-keyed ones')
      const indexes = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
        `select indexname from pg_indexes
          where schemaname = 'public'
            and tablename in ('SegmentMember', 'AutomationEnrollment')
          order by indexname`
      )
      const names = indexes.map(i => i.indexname)
      assert(
        names.includes('SegmentMember_segmentationRuleId_subjectType_subjectId_key'),
        'SegmentMember is unique on (rule, subjectType, subjectId)'
      )
      assert(
        names.includes('AutomationEnrollment_automationId_subjectType_subjectId_key'),
        'AutomationEnrollment is unique on (automation, subjectType, subjectId)'
      )
      assert(
        !names.includes('SegmentMember_segmentationRuleId_leadId_key'),
        'the old lead-keyed segment unique is gone'
      )
      assert(
        !names.includes('AutomationEnrollment_automationId_leadId_key'),
        'the old lead-keyed enrollment unique is gone — this is what blocked two interests per buyer'
      )
      assert(
        names.includes('SegmentMember_subjectType_subjectId_idx'),
        'the (subjectType, subjectId) index exists, so the purge triggers are index-driven'
      )

      section('the CHECK constraints are present and validated')
      const checks = await prisma.$queryRawUnsafe<{ conname: string; convalidated: boolean }[]>(
        `select conname, convalidated from pg_constraint
          where contype = 'c'
            and conname in ('SegmentMember_subject_contact_check', 'AutomationEnrollment_subject_check')`
      )
      assertEq(checks.length, 2, 'both CHECK constraints exist')
      assert(checks.every(c => c.convalidated), 'both are validated, not left NOT VALID')

      const fixture = await makeWorkspace(prisma, 'rls')
      try {
        const lead = await prisma.lead.create({
          data: {
            firstName: 'Check',
            lastName: 'Constraint',
            email: `check-${uid()}@verify.invalid`,
            pipelineId: fixture.pipelines.Lead,
          },
          select: { id: true },
        })
        const rule = await prisma.segmentationRule.create({
          data: {
            name: 'Check constraints',
            workspaceId: fixture.workspaceId,
            subjectType: 'Lead',
            criteria: '[]',
          },
          select: { id: true },
        })

        section('a Lead membership whose contact is not the subject is rejected')
        const otherLead = await prisma.lead.create({
          data: {
            firstName: 'Other',
            lastName: 'Lead',
            email: `other-${uid()}@verify.invalid`,
            pipelineId: fixture.pipelines.Lead,
          },
          select: { id: true },
        })
        await assertThrows(
          () => prisma.segmentMember.create({
            data: { segmentationRuleId: rule.id, subjectType: 'Lead', subjectId: lead.id, leadId: otherLead.id },
          }),
          'leadId must equal subjectId for a Lead subject'
        )

        section('a Property membership may carry its vendor, or none')
        // A property is mailed through its vendor, so the contact is optional (a
        // prospect can be recorded before the vendor is) but allowed.
        await prisma.segmentMember.create({
          data: { segmentationRuleId: rule.id, subjectType: 'Property', subjectId: `property-${uid()}`, leadId: lead.id },
        })
        await prisma.segmentMember.create({
          data: { segmentationRuleId: rule.id, subjectType: 'Property', subjectId: `property-${uid()}`, leadId: null },
        })

        section('an unknown subject type is rejected on both tables')
        await assertThrows(
          () => prisma.segmentMember.create({
            data: { segmentationRuleId: rule.id, subjectType: 'Offer', subjectId: `offer-${uid()}`, leadId: null },
          }),
          'only the four subject types may be segment members'
        )
        const automation = await prisma.emailAutomation.create({
          data: { name: 'Checks', workspaceId: fixture.workspaceId, subjectType: 'Lead', status: 'active' },
          select: { id: true },
        })
        await assertThrows(
          () => prisma.automationEnrollment.create({
            data: {
              automationId: automation.id,
              subjectType: 'Offer',
              subjectId: `offer-${uid()}`,
              leadId: lead.id,
              workspaceId: fixture.workspaceId,
            },
          }),
          'only the four subject types may be enrolled'
        )

        section('a property can be enrolled, through its vendor')
        await prisma.automationEnrollment.create({
          data: {
            automationId: automation.id,
            subjectType: 'Property',
            subjectId: `property-${uid()}`,
            leadId: lead.id,
            workspaceId: fixture.workspaceId,
          },
        })
      } finally {
        await cleanup(prisma, fixture)
      }

      section('the anon role cannot read a protected table')
      const roles = await prisma.$queryRawUnsafe<{ rolname: string }[]>(`select rolname from pg_roles where rolname = 'anon'`)
      if (roles.length === 0) {
        // Supabase creates `anon`; a plain Postgres has no such role, so there is
        // nothing to impersonate. Say so rather than pass without testing it.
        console.log("    SKIPPED — this database has no 'anon' role (it is not a Supabase database).")
      } else {
        // Scoped to a transaction and rolled back, so the role change never
        // outlives the check.
        let denied = false
        try {
          await prisma.$transaction(async tx => {
            await tx.$executeRawUnsafe(`set local role anon`)
            const rows = await tx.$queryRawUnsafe<unknown[]>(`select 1 from "Lead" limit 1`)
            // RLS with no policies returns zero rows rather than raising, unless
            // the role also lacks the table privilege, which raises instead.
            denied = rows.length === 0
            throw new Error('rollback')
          })
        } catch (error: any) {
          if (!/rollback/.test(error?.message || '')) {
            // insufficient_privilege is the stronger outcome, and also a pass.
            denied = /permission denied|insufficient/i.test(error?.message || '')
            if (!denied) throw error
          }
        }
        assert(denied, 'the anon role reads no rows from a protected table')
      }
    } finally {
      await prisma.$disconnect()
    }
  })
}

if (require.main === module) {
  scenario()
}
