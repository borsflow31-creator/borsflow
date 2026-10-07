/**
 * Scenario 17 — developer alerts and document access.
 *
 *  a. Every alert rule fires at its threshold and not a moment before: 14 vs 15
 *     minutes, 1 vs 2 days, the 25% mark of a project's sales window, stock at the
 *     percentage boundary and at zero, a cancellation rate with too few deals.
 *     An alert that fires early cries wolf; one that fires late misses the lead.
 *  b. Alert settings are validated on the way in and defended on the way out: a
 *     bad number is refused when typed, and a bad number already stored falls back
 *     to the default rather than making an alert fire on everything or nothing.
 *  c. The once-only keys are right: the same week is one project alert, the next
 *     week another, including across a year boundary.
 *  d. Document visibility fails closed, and only owners and admins can restrict.
 *
 * No database: every rule here is pure and lives in lib/ so it can be proved
 * without standing one up.
 */

import {
  ALERT_RULES,
  RULE_PARAMS,
  cancellationsHigh,
  dayKey,
  defaultParams,
  expectedSoldUnits,
  inventoryLow,
  leadNeedsFollowUp,
  leadNeedsResponseAlert,
  monthKeyOf,
  projectBehindTarget,
  resolveParams,
  validateParams,
  weekKey,
} from '../../src/lib/crm/alert-rules'
import {
  canViewDocument,
  isDocumentVisibility,
  visibilityForUpload,
  visibleDocumentsWhere,
} from '../../src/lib/crm/document-access'
import { assert, assertEq, runScenario, section } from './_harness'

const MIN = 60 * 1000
const DAY = 24 * 60 * MIN
const now = new Date('2026-10-07T12:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms)
const d = (iso: string) => new Date(iso + 'T00:00:00Z')

export default function scenario() {
  return runScenario('17 developer alerts (no DB)', async () => {
    section('no response: the boundary is the setting, to the minute')
    const base = { now, minutes: 15, hasContact: false }
    assertEq(leadNeedsResponseAlert({ ...base, createdAt: ago(14 * MIN + 59_000) }), false, '14m59s: not yet')
    assertEq(leadNeedsResponseAlert({ ...base, createdAt: ago(15 * MIN) }), true, 'exactly 15 minutes')
    assertEq(leadNeedsResponseAlert({ ...base, createdAt: ago(16 * MIN) }), true, '16 minutes')
    assertEq(leadNeedsResponseAlert({ ...base, createdAt: ago(60 * MIN), hasContact: true }), false, 'any contact silences it')
    assertEq(leadNeedsResponseAlert({ ...base, createdAt: ago(23 * 60 * MIN) }), true, 'still alerts within the day')
    assertEq(leadNeedsResponseAlert({ ...base, createdAt: ago(25 * 60 * MIN) }), false, 'a lead from yesterday is history, not an emergency')
    assertEq(leadNeedsResponseAlert({ ...base, minutes: 60, createdAt: ago(30 * MIN) }), false, 'a longer setting waits longer')
    assertEq(leadNeedsResponseAlert({ ...base, minutes: 5, createdAt: ago(6 * MIN) }), true, 'a shorter setting fires sooner')

    section('no follow-up: needs an owner, an open lead, and nothing booked')
    const f = { now, days: 2, hasOpenTask: false, hasOwner: true, finished: false }
    assertEq(leadNeedsFollowUp({ ...f, lastTouchAt: ago(1 * DAY + 23 * 60 * MIN) }), false, '47 hours: not yet')
    assertEq(leadNeedsFollowUp({ ...f, lastTouchAt: ago(2 * DAY) }), true, 'exactly 2 days')
    assertEq(leadNeedsFollowUp({ ...f, lastTouchAt: ago(10 * DAY), hasOpenTask: true }), false, 'a booked follow-up is enough')
    assertEq(leadNeedsFollowUp({ ...f, lastTouchAt: ago(10 * DAY), hasOwner: false }), false, 'no owner, nobody to give a task to')
    assertEq(leadNeedsFollowUp({ ...f, lastTouchAt: ago(10 * DAY), finished: true }), false, 'won or lost leads are finished')

    section('behind target: a straight line, judged only once it means something')
    const p = { targetUnits: 100, launchDate: d('2026-01-01'), endDate: d('2027-01-01'), tolerancePercent: 25 }
    // 2026-07-02 is half way through the window, so about 50 units are expected.
    const half = new Date('2026-07-02T00:00:00Z')
    assertEq(projectBehindTarget({ ...p, now: half, soldUnits: 50 }), false, 'on plan')
    assertEq(projectBehindTarget({ ...p, now: half, soldUnits: 38 }), false, 'a little behind, inside the tolerance')
    assertEq(projectBehindTarget({ ...p, now: half, soldUnits: 37 }), true, 'more than 25% below the line')
    assertEq(projectBehindTarget({ ...p, now: half, soldUnits: 0 }), true, 'nothing sold at halfway')
    assertEq(projectBehindTarget({ ...p, now: new Date('2026-02-15T00:00:00Z'), soldUnits: 0 }), false, 'before a quarter of the window one sale swings it, so no alert')
    // Day 91 of 365 is 24.9% through the window; day 94 is 25.8%.
    assertEq(projectBehindTarget({ ...p, now: new Date('2026-04-02T00:00:00Z'), soldUnits: 0 }), false, 'a hair under a quarter: still too early to judge')
    assertEq(projectBehindTarget({ ...p, now: new Date('2026-04-05T00:00:00Z'), soldUnits: 0 }), true, 'just past a quarter, with nothing sold, alerts')
    assertEq(projectBehindTarget({ ...p, now: new Date('2027-06-01T00:00:00Z'), soldUnits: 60 }), true, 'after delivery the plan is the whole target')
    assertEq(projectBehindTarget({ ...p, now: half, soldUnits: 10, targetUnits: null }), null, 'no target: skipped, not guessed')
    assertEq(projectBehindTarget({ ...p, now: half, soldUnits: 10, launchDate: null }), null, 'no launch date: skipped')
    assertEq(projectBehindTarget({ ...p, now: half, soldUnits: 10, endDate: d('2025-12-01') }), null, 'delivery before launch is nonsense: skipped')
    assertEq(projectBehindTarget({ ...p, now: half, soldUnits: 37, tolerancePercent: 50 }), false, 'a wider tolerance forgives more')
    assertEq(expectedSoldUnits({ ...p, now: half }), 50, 'expected units at the halfway point')
    assertEq(expectedSoldUnits({ ...p, now: new Date('2030-01-01T00:00:00Z') }), 100, 'never more than the target')
    assertEq(expectedSoldUnits({ ...p, now: new Date('2025-01-01T00:00:00Z') }), 0, 'never less than zero before launch')

    section('low inventory: at the line, not at zero')
    assertEq(inventoryLow({ available: 11, total: 100, minPercent: 10 }), false, '11% is fine')
    assertEq(inventoryLow({ available: 10, total: 100, minPercent: 10 }), true, 'exactly 10%')
    assertEq(inventoryLow({ available: 1, total: 100, minPercent: 10 }), true, 'almost gone')
    assertEq(inventoryLow({ available: 0, total: 100, minPercent: 10 }), false, 'sold out is done, not low')
    assertEq(inventoryLow({ available: 0, total: 0, minPercent: 10 }), false, 'an empty project does not divide by zero')

    section('cancellations: a rate needs enough deals to mean something')
    assertEq(cancellationsHigh({ cancellations: 1, sold: 1, ratePercent: 20, minDeals: 5 }), false, '1 of 2 is 50% but only two deals')
    assertEq(cancellationsHigh({ cancellations: 1, sold: 4, ratePercent: 20, minDeals: 5 }), true, '1 of 5 is exactly 20%')
    assertEq(cancellationsHigh({ cancellations: 1, sold: 5, ratePercent: 20, minDeals: 5 }), false, '1 of 6 is under 20%')
    assertEq(cancellationsHigh({ cancellations: 0, sold: 50, ratePercent: 20, minDeals: 5 }), false, 'no cancellations never alerts')
    assertEq(cancellationsHigh({ cancellations: 0, sold: 0, ratePercent: 20, minDeals: 1 }), false, 'no deals does not divide by zero')

    section('settings: refused when typed, defended when stored')
    for (const type of ALERT_RULES) {
      const defaults = defaultParams(type)
      for (const spec of RULE_PARAMS[type]) {
        assertEq(defaults[spec.key], spec.default, `${type}.${spec.key} has its default`)
        assert(spec.default >= spec.min && spec.default <= spec.max, `${type}.${spec.key} default is inside its own limits`)
      }
    }
    const typed = validateParams('lead_no_response', { minutes: '30' })
    assert(typed.ok && typed.params.minutes === 30, 'a number typed as text is accepted')
    assert(!validateParams('lead_no_response', { minutes: 0 }).ok, 'zero minutes is refused')
    assert(!validateParams('lead_no_response', { minutes: 1441 }).ok, 'more than a day is refused')
    assert(!validateParams('lead_no_response', { minutes: 1.5 }).ok, 'a fraction is refused')
    assert(!validateParams('lead_no_response', { minutes: 'soon' }).ok, 'text is refused')
    const blank = validateParams('lead_no_followup', {})
    assert(blank.ok && blank.params.days === 2, 'a blank field takes the default')
    assert(validateParams('contract_signed', { anything: 1 }).ok, 'a rule with no numbers accepts none')
    assertEq(resolveParams('lead_no_response', { minutes: 99999 }).minutes, 15, 'a stored out-of-range value falls back to the default')
    assertEq(resolveParams('lead_no_response', { minutes: '30' }).minutes, 15, 'a stored string falls back')
    assertEq(resolveParams('lead_no_response', null).minutes, 15, 'no stored value is the default')
    assertEq(resolveParams('lead_no_response', { minutes: 45 }).minutes, 45, 'a good stored value is kept')
    assertEq(resolveParams('high_cancellations', { ratePercent: 30 }).minDeals, 5, 'a missing second number takes its default')

    section('once-only keys: the period is the key')
    assertEq(weekKey(new Date('2026-10-07T12:00:00Z')), weekKey(new Date('2026-10-09T23:00:00Z')), 'the same week is one key')
    assert(weekKey(new Date('2026-10-07T12:00:00Z')) !== weekKey(new Date('2026-10-14T12:00:00Z')), 'next week is another')
    assertEq(weekKey(new Date('2026-10-05T00:00:00Z')), weekKey(new Date('2026-10-11T23:59:00Z')), 'Monday to Sunday is one week')
    assertEq(weekKey(new Date('2026-01-01T12:00:00Z')), '2026-W01', '1 January 2026 is week 1')
    assertEq(weekKey(new Date('2024-12-30T12:00:00Z')), '2025-W01', 'late December can belong to next year\'s week 1')
    assertEq(weekKey(new Date('2021-01-01T12:00:00Z')), '2020-W53', 'early January can belong to last year\'s week 53')
    assertEq(monthKeyOf(new Date('2026-10-31T23:59:00Z')), '2026-10', 'a month key')
    assertEq(dayKey(new Date('2026-10-07T23:59:00Z')), '2026-10-07', 'a day key')

    section('document access: fails closed, and only managers restrict')
    assert(canViewDocument(false, 'team'), 'a member sees a team document')
    assert(!canViewDocument(false, 'managers'), 'a member does not see a managers-only one')
    assert(canViewDocument(true, 'managers'), 'an owner or admin sees both')
    assert(canViewDocument(true, 'team'), 'and team documents')
    assert(!canViewDocument(false, 'something-new'), 'an unknown level hides the document')
    assert(!canViewDocument(false, null) && !canViewDocument(false, undefined), 'a missing level hides it too')
    assertEq(JSON.stringify(visibleDocumentsWhere(false)), '{"visibility":"team"}', 'a member\'s list is filtered to the team')
    assertEq(JSON.stringify(visibleDocumentsWhere(true)), '{}', 'a manager\'s list is not')
    assertEq(visibilityForUpload(true, 'managers'), 'managers', 'an admin can restrict a new file')
    assertEq(visibilityForUpload(false, 'managers'), 'team', 'a member asking for it is ignored')
    assertEq(visibilityForUpload(true, 'nonsense'), 'team', 'a bad request falls back to the team')
    assertEq(visibilityForUpload(true, undefined), 'team', 'no request is the team')
    assert(isDocumentVisibility('team') && isDocumentVisibility('managers') && !isDocumentVisibility('public'), 'only the two levels exist')
  })
}

if (require.main === module) {
  scenario()
}
