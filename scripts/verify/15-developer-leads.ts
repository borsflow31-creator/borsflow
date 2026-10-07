/**
 * Scenario 15 — developer lead handling: scoring, assignment, follow-up grouping.
 *
 *  a. A lead's score adds up from what is known about it, never exceeds 100,
 *     and a lost lead scores 0 so it sinks below live ones. These numbers order
 *     a salesperson's day, so a component that double-counts or a bound that
 *     slips is a lead worked in the wrong order.
 *  b. Automatic assignment gives the next lead to whoever carries the fewest open
 *     ones, breaks ties by who was fed longest ago, and is deterministic.
 *  c. Follow-ups sort into overdue / today / upcoming by the viewer's calendar
 *     day: a task due earlier today is not "overdue" until the day has passed.
 *  d. The dashboard's period windows tile the calendar with no gap or overlap,
 *     including across a year boundary, so a delta compares like with like.
 *
 * No database: every rule here is pure and lives in lib/ so it can be proved
 * without standing one up.
 */

import { scoreLead } from '../../src/lib/crm/lead-score'
import { DEVELOPER_SALES_PIPELINE } from '../../src/lib/crm/lifecycle'
import { pickLeastLoaded } from '../../src/lib/services/developer/lead-assignment'
import { periodRanges } from '../../src/lib/services/developer/dashboard'
import { groupTasks } from '../../src/components/developer/task-groups'
import { assert, assertEq, runScenario, section } from './_harness'

const STAGES = DEVELOPER_SALES_PIPELINE.stages
const NOW = new Date('2026-10-07T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000)

export default function scenario() {
  return runScenario('15 developer leads (no DB)', async () => {
    section('score: components add up to 100 and not beyond')
    const full = scoreLead({
      email: 'a@b.co', phone: '+1 555', budgetMin: 100000, budgetMax: 200000,
      interestedProgramId: 'p1', interestedTypology: 'T3', source: 'referral',
      stage: 'Won', stages: STAGES, lastContactedAt: NOW, now: NOW,
    })
    assertEq(full.score, 100, 'a complete, contacted, won referral lead scores 100')
    assertEq(
      Object.values(full.breakdown).reduce((a, b) => a + b, 0), full.score,
      'the breakdown sums to the score'
    )

    const bare = scoreLead({ stage: 'New', stages: STAGES, now: NOW })
    assertEq(bare.score, 0, 'a name and nothing else scores 0')

    section('score: lost sinks to zero, whatever else is known')
    const lost = scoreLead({
      email: 'a@b.co', phone: '1', budgetMax: 5, interestedProgramId: 'p', source: 'walk_in',
      stage: 'Lost', stages: STAGES, lastContactedAt: NOW, now: NOW,
    })
    assertEq(lost.score, 0, 'lost lead scores 0')

    section('score: source, budget and recency edges')
    const base = { stage: 'New', stages: STAGES, now: NOW }
    assertEq(scoreLead({ ...base, source: 'walk_in' }).breakdown.source, 15, 'walk-in is the strongest source')
    assertEq(scoreLead({ ...base, source: 'Facebook' }).breakdown.source, 6, 'source is matched case-insensitively')
    assertEq(scoreLead({ ...base, source: 'a friend of Bob' }).breakdown.source, 3, 'free text earns the floor, not nothing')
    assertEq(scoreLead({ ...base, source: '  ' }).breakdown.source, 0, 'blank source earns nothing')
    assertEq(scoreLead({ ...base, budgetMin: 0, budgetMax: 0 }).breakdown.budget, 0, 'a zero budget is not a budget')
    assertEq(scoreLead({ ...base, budgetMax: 1 }).breakdown.budget, 15, 'a maximum alone counts')
    assertEq(scoreLead({ ...base, lastContactedAt: daysAgo(7) }).breakdown.recency, 10, 'contact 7 days ago is recent')
    assertEq(scoreLead({ ...base, lastContactedAt: daysAgo(8) }).breakdown.recency, 5, 'contact 8 days ago is a month-old touch')
    assertEq(scoreLead({ ...base, lastContactedAt: daysAgo(31) }).breakdown.recency, 0, 'contact over a month ago earns nothing')

    section('score: stage progress follows board position')
    const at = (stage: string) => scoreLead({ stage, stages: STAGES, now: NOW }).breakdown.stage
    assertEq(at('New'), 0, 'first stage is zero')
    assertEq(at('Won'), 25, 'last live stage is full marks')
    assert(at('Qualified') < at('Site visit') && at('Site visit') < at('Reserved'), 'progress rises along the board')
    assertEq(at('Some renamed column'), 0, 'a stage the board does not know earns nothing rather than a guess')

    section('assignment: fewest open leads wins')
    const c = (userId: string, openLeads: number, lastAssignedAt: Date | null = null) =>
      ({ userId, openLeads, lastAssignedAt })
    assertEq(pickLeastLoaded([c('a', 5), c('b', 2), c('c', 9)]), 'b', 'least loaded gets it')
    assertEq(pickLeastLoaded([]), null, 'nobody to assign to')
    assertEq(pickLeastLoaded([c('only', 40)]), 'only', 'a sole candidate always wins, however loaded')

    section('assignment: ties go to whoever was fed longest ago, never-fed first')
    assertEq(
      pickLeastLoaded([c('a', 3, daysAgo(1)), c('b', 3, daysAgo(5)), c('c', 3, daysAgo(2))]), 'b',
      'oldest assignment wins a tie'
    )
    assertEq(
      pickLeastLoaded([c('a', 3, daysAgo(9)), c('b', 3, null)]), 'b',
      'someone never assigned a lead goes before anyone who has been'
    )
    assertEq(pickLeastLoaded([c('z', 1), c('m', 1), c('a', 1)]), 'a', 'a full tie falls back to a stable order')
    const first = pickLeastLoaded([c('x', 2, daysAgo(3)), c('y', 2, daysAgo(3))])
    assertEq(pickLeastLoaded([c('y', 2, daysAgo(3)), c('x', 2, daysAgo(3))]), first, 'input order does not change the result')

    section('follow-ups: grouped by the viewer\'s calendar day')
    const local = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m, d, h, min).toISOString()
    const midday = new Date(2026, 9, 7, 12, 0)
    const tasks = [
      { id: 'late', dueAt: local(2026, 9, 6, 23, 59), completedAt: null },
      { id: 'earlier-today', dueAt: local(2026, 9, 7, 8, 0), completedAt: null },
      { id: 'tonight', dueAt: local(2026, 9, 7, 23, 59), completedAt: null },
      { id: 'tomorrow', dueAt: local(2026, 9, 8, 0, 0), completedAt: null },
      { id: 'finished', dueAt: local(2026, 9, 1, 9, 0), completedAt: local(2026, 9, 2, 9, 0) },
    ]
    const g = groupTasks(tasks, midday)
    assertEq(g.overdue.map((t) => t.id).join(), 'late', 'yesterday is overdue')
    assertEq(g.today.map((t) => t.id).join(), 'earlier-today,tonight', 'a task due earlier today is still today, not overdue')
    assertEq(g.upcoming.map((t) => t.id).join(), 'tomorrow', 'midnight tomorrow is upcoming')
    assertEq(g.done.map((t) => t.id).join(), 'finished', 'completed tasks are their own group, wherever they were due')

    section('periods: windows tile the calendar without gap or overlap')
    for (const [period, now] of [
      ['month', '2026-10-07'], ['quarter', '2026-10-07'], ['year', '2026-10-07'],
      ['month', '2026-01-15'], ['quarter', '2026-02-01'], ['quarter', '2026-12-31'],
    ] as const) {
      const r = periodRanges(period, new Date(`${now}T12:00:00Z`))
      assertEq(r.prevEnd.getTime(), r.start.getTime(), `${period} @ ${now}: previous ends exactly where current starts`)
      assert(r.start < r.end && r.prevStart < r.prevEnd, `${period} @ ${now}: both windows are forward`)
      assert(new Date(`${now}T12:00:00Z`) >= r.start && new Date(`${now}T12:00:00Z`) < r.end, `${period} @ ${now}: now is inside the current window`)
    }
    const wrap = periodRanges('month', new Date('2026-01-15T12:00:00Z'))
    assertEq(wrap.prevStart.toISOString().slice(0, 10), '2025-12-01', 'the month before January is December of last year')
    const quarter = periodRanges('quarter', new Date('2026-10-07T12:00:00Z'))
    assertEq(
      `${quarter.start.toISOString().slice(0, 10)}..${quarter.end.toISOString().slice(0, 10)}`, '2026-10-01..2027-01-01',
      'Q4 runs into the next year'
    )
  })
}

if (require.main === module) {
  scenario()
}
