/**
 * Scenario 23 — team roles and the admin's activity log.
 *
 *  a. Roles, with no database: a commercial (stored as `member`) creates and edits
 *     their own records only and cannot manage the team; an admin can.
 *  b. The log reads what everyone did: a commercial's lead creation and an
 *     admin's role change both come back, newest first, with the actor's name.
 *  c. Filters: by person, by event group, by date, and paging with a cursor
 *     neither repeats nor drops a row.
 *  d. Sign-ins land in every workspace the person belongs to, and the members
 *     list reports each person's last one.
 *  e. Only owners and admins may read the log: the commercial's role resolves to
 *     `member`, which the route refuses.
 *  f. Scoping: another workspace's events never appear.
 *
 * Needs VERIFY_DATABASE_URL (a throwaway database with the migrations applied).
 */

import {
  assert,
  assertEq,
  cleanup,
  makeWorkspace,
  runScenario,
  section,
  uid,
  useVerifyDatabase,
  verifyClient,
  type Fixture,
} from './_harness'
import { hasPermission } from '../../src/lib/workspace'
import { isActivityGroup } from '../../src/lib/team/audit-types'

function pureChecks() {
  section('roles: a commercial works their own records, an admin runs the team')
  assertEq(hasPermission('member', 'content:create'), true, 'a commercial can create')
  assertEq(hasPermission('member', 'content:write_own'), true, 'a commercial can edit their own')
  assertEq(hasPermission('member', 'content:write'), false, "a commercial cannot edit other people's")
  assertEq(hasPermission('member', 'workspace:manage_members'), false, 'a commercial cannot manage the team')
  assertEq(hasPermission('admin', 'workspace:manage_members'), true, 'an admin can')
  assertEq(isActivityGroup('signins'), true, 'signins is a log filter')
  assertEq(isActivityGroup('nope'), false, 'an unknown filter is ignored')
}

export default function scenario() {
  return runScenario('23 team roles and activity log', async () => {
    pureChecks()

    useVerifyDatabase()
    const prisma = verifyClient()
    const { listWorkspaceActivity, listWorkspaceMembers } = await import('../../src/lib/services/team/audit-log')
    const { TeamLogger } = await import('../../src/lib/team/logger')
    const { CrmLogger } = await import('../../src/lib/crm/logger')
    const { getWorkspaceRole } = await import('../../src/lib/api/workspace')

    const fixtures: Fixture[] = []
    const extraUsers: string[] = []
    try {
      const fx = await makeWorkspace(prisma, 'team')
      fixtures.push(fx)
      const other = await makeWorkspace(prisma, 'team-other')
      fixtures.push(other)

      const mkUser = async (name: string) => {
        const u = await prisma.user.create({ data: { email: `${uid('team-')}@verify.invalid`, name }, select: { id: true } })
        extraUsers.push(u.id)
        return u.id
      }
      const adminId = await mkUser('Ada Admin')
      const salesId = await mkUser('Carl Commercial')
      await prisma.workspaceMember.createMany({
        data: [
          { workspaceId: fx.workspaceId, userId: adminId, role: 'admin' },
          { workspaceId: fx.workspaceId, userId: salesId, role: 'member' },
          // The commercial also belongs to another workspace.
          { workspaceId: other.workspaceId, userId: salesId, role: 'member' },
        ],
      })

      section('the log shows what each person did, newest first')
      const t0 = Date.now()
      await CrmLogger.logCreated({ workspaceId: fx.workspaceId, userId: salesId, leadId: uid('lead-'), leadName: 'Jane Buyer' })
      await new Promise((r) => setTimeout(r, 15))
      await TeamLogger.log({
        workspaceId: fx.workspaceId,
        userId: adminId,
        type: 'member_role_changed',
        entityId: salesId,
        description: 'Carl Commercial changed from member to viewer',
        metadata: { from: 'member', to: 'viewer', name: 'Carl Commercial' },
      })
      await CrmLogger.logCreated({ workspaceId: other.workspaceId, userId: salesId, leadId: uid('lead-'), leadName: 'Elsewhere' })

      const all = await listWorkspaceActivity(fx.workspaceId)
      assertEq(all.entries.length, 2, 'both events, none from the other workspace')
      assertEq(all.entries[0].type, 'member_role_changed', 'newest first')
      assertEq(all.entries[0].actor.name, 'Ada Admin', 'the admin is named as the actor')
      assertEq(all.entries[1].actor.name, 'Carl Commercial', "the commercial's lead creation is attributed to them")
      assert(all.entries[1].leadId, 'the lead row links to its lead')
      assertEq(all.nextCursor, null, 'one page')

      section('filters')
      const bySales = await listWorkspaceActivity(fx.workspaceId, { userId: salesId })
      assertEq(bySales.entries.map((e) => e.type).join(), 'lead_created', 'by person')
      const team = await listWorkspaceActivity(fx.workspaceId, { group: 'team' })
      assertEq(team.entries.map((e) => e.type).join(), 'member_role_changed', 'by group')
      const future = await listWorkspaceActivity(fx.workspaceId, { from: new Date(t0 + 60 * 60 * 1000) })
      assertEq(future.entries.length, 0, 'by date')

      section('paging with a cursor')
      const first = await listWorkspaceActivity(fx.workspaceId, { limit: 1 })
      assertEq(first.entries.length, 1, 'page one has one row')
      assert(first.nextCursor, 'and a cursor')
      const second = await listWorkspaceActivity(fx.workspaceId, { limit: 1, cursor: first.nextCursor! })
      assertEq(second.entries.length, 1, 'page two has the other row')
      assert(second.entries[0].id !== first.entries[0].id, 'no row repeats')
      assertEq(second.nextCursor, null, 'and it is the last page')

      section('sign-ins reach every workspace the person is in')
      await TeamLogger.logSignIn(salesId, 'credentials')
      const signIns = await prisma.activity.findMany({ where: { userId: salesId, type: 'user_signed_in' }, select: { workspaceId: true } })
      assertEq(new Set(signIns.map((s) => s.workspaceId)).size, 2, 'one row in each of the two workspaces')
      const members = await listWorkspaceMembers(fx.workspaceId)
      assertEq(members.map((m) => m.role).join(), 'owner,admin,member', 'owner, then admin, then commercial')
      assert(members.find((m) => m.userId === salesId)?.lastSignInAt, "the commercial's last sign-in is shown")
      assertEq(members.find((m) => m.userId === adminId)?.lastSignInAt, null, 'the admin never signed in')

      section('only owners and admins may read the log')
      assertEq(await getWorkspaceRole(fx.workspaceId, salesId), 'member', 'the commercial resolves to member, which the route refuses')
      assertEq(await getWorkspaceRole(fx.workspaceId, adminId), 'admin', 'the admin is allowed')
      assertEq(await getWorkspaceRole(fx.workspaceId, fx.userId), 'owner', 'so is the owner, who has no member row')
    } finally {
      for (const f of fixtures) await cleanup(prisma, f)
      for (const id of extraUsers) await prisma.user.delete({ where: { id } }).catch(() => {})
      await prisma.$disconnect()
    }
  })
}
