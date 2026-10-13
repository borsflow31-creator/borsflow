/**
 * Scenario 21 — the new-lead form: duplicate matching, unit choice, auto-fill.
 *
 *  a. Contact matching. An email matches whatever its case and spacing; a phone
 *     matches across separators and the 00/+ prefix, but a local number is
 *     never assumed to be an international one. A wrong "this person already
 *     exists" sends a salesperson to someone else's record.
 *  b. Unit choice. Units given to a lead must exist in the workspace, still be
 *     available, and belong to the lead's project; with no project chosen they
 *     set it. Units already on a lead stay allowed after they sell.
 *  c. Auto-fill. Picking units fills only empty brief fields, never one the
 *     user typed; removing them clears only what they filled; changing the
 *     project drops units from other projects.
 *
 * No database: every rule here is pure.
 */

import {
  checkLotSelection, normalizeEmail, normalizePhone, readLotIds,
} from '../../src/lib/crm/contact-match'
import {
  applyLots, changeProgram, markEdited, valuesFromLots, type BriefDraft, type PickedLot,
} from '../../src/components/developer/lead-autofill'
import { assert, assertEq, runScenario, section } from './_harness'

/** Structural equality, for results that are objects. */
function same(actual: unknown, expected: unknown, message: string): void {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), message)
}

const EMPTY: BriefDraft = { interestedTypology: '', preferredLocation: '', budgetMin: '', budgetMax: '' }

function lot(id: string, over: Partial<PickedLot> = {}): PickedLot {
  return {
    id,
    lotNumber: id.toUpperCase(),
    type: 'apartment',
    typology: 'T3',
    floor: 2,
    bedrooms: 2,
    surfaceArea: 78,
    totalPrice: 12_500_000,
    building: { name: 'A' },
    program: { id: 'p1', name: 'El Feth', city: 'Oran' },
    ...over,
  }
}

export default function scenario() {
  return runScenario('21 lead intake (no DB)', async () => {
    section('email: case and spacing do not matter')
    assertEq(normalizeEmail('  Amina.B@Mail.COM '), 'amina.b@mail.com', 'trimmed and lowercased')
    assertEq(normalizeEmail(''), null, 'empty is no email')
    assertEq(normalizeEmail('not-an-email'), null, 'no @ is no email')

    section('phone: separators and 00/+ are the same number')
    assertEq(normalizePhone('+213 555-12 34 56'), '+213555123456', 'spaces and dashes dropped')
    assertEq(normalizePhone('00213 (555) 12.34.56'), '+213555123456', '00 is written as +')
    assertEq(normalizePhone('0555 12 34 56'), '0555123456', 'a local number stays local')
    assert(normalizePhone('0555123456') !== normalizePhone('+213555123456'), 'local is never assumed to be international')
    assert(normalizePhone('+33 6 12 34 56 78') !== normalizePhone('+213 6 12 34 56 78'), 'different country codes differ')
    assertEq(normalizePhone('12 34'), null, 'too short to be a number')
    assertEq(normalizePhone('call me'), null, 'letters are not a number')

    section('unit ids from a request body')
    assertEq(readLotIds(undefined), undefined, 'absent leaves interests alone')
    assertEq(readLotIds(null)?.length, 0, 'null clears them')
    assertEq(readLotIds(['a', 'a', 3, '', 'b'])?.join(','), 'a,b', 'strings only, deduplicated')

    section('unit choice: checked against the database')
    const found = [
      { id: 'a', programId: 'p1', status: 'available' },
      { id: 'b', programId: 'p1', status: 'available' },
      { id: 'c', programId: 'p2', status: 'available' },
      { id: 'd', programId: 'p1', status: 'reserved' },
    ]
    same(checkLotSelection([], found, null), { ok: true, programId: null }, 'no units, nothing to check')
    same(checkLotSelection(['a', 'b'], found, 'p1'), { ok: true, programId: 'p1' }, 'units of the chosen project pass')
    same(checkLotSelection(['a'], found, null), { ok: true, programId: 'p1' }, 'with no project, the units set it')
    same(checkLotSelection(['a', 'c'], found, null), { ok: false, error: 'mixed_programs' }, 'one project per lead')
    same(checkLotSelection(['c'], found, 'p1'), { ok: false, error: 'wrong_program' }, 'a unit of another project is refused')
    same(checkLotSelection(['zz'], found, 'p1'), { ok: false, error: 'not_found' }, 'a unit outside the workspace is refused')
    same(checkLotSelection(['d'], found, 'p1'), { ok: false, error: 'not_available' }, 'a reserved unit cannot be offered')
    same(checkLotSelection(['d'], found, 'p1', ['d']), { ok: true, programId: 'p1' }, 'a unit already on the lead stays after it sells')

    section('auto-fill: what units say')
    const one = valuesFromLots([lot('a')])
    assertEq(one.budgetMax, '12500000', 'one unit: its price is the ceiling')
    assertEq(one.budgetMin, '', 'one unit: the floor stays the buyer\'s')
    assertEq(one.preferredLocation, 'Oran', 'location is the project\'s city')
    const two = valuesFromLots([lot('a'), lot('b', { typology: 'T4', totalPrice: 16_000_000 })])
    assertEq(two.interestedTypology, 'T3, T4', 'several typologies are listed')
    assertEq(`${two.budgetMin}-${two.budgetMax}`, '12500000-16000000', 'several units give a range')
    assertEq(valuesFromLots([lot('a', { totalPrice: 0 })]).budgetMax, '', 'an unpriced unit sets no budget')

    section('auto-fill: empty fields only, never a typed one')
    const typed = { ...EMPTY, budgetMax: '10000000' }
    const filled = applyLots(typed, {}, [lot('a')])
    assertEq(filled.brief.budgetMax, '10000000', 'a typed budget is kept')
    assertEq(filled.brief.interestedTypology, 'T3', 'an empty typology is filled')
    assert(!('budgetMax' in filled.autoFilled), 'a typed field is not marked as from a unit')
    assertEq(filled.autoFilled.interestedTypology, 'A', 'a filled field says which unit')

    section('auto-fill: removing units clears only what they filled')
    const cleared = applyLots(filled.brief, filled.autoFilled, [])
    assertEq(cleared.brief.interestedTypology, '', 'filled typology goes')
    assertEq(cleared.brief.budgetMax, '10000000', 'typed budget stays')
    assertEq(Object.keys(cleared.autoFilled).length, 0, 'nothing is marked any more')

    section('auto-fill: a field edited after filling becomes the user\'s')
    const auto = applyLots(EMPTY, {}, [lot('a')])
    const edited = { brief: { ...auto.brief, preferredLocation: 'Oran centre' }, autoFilled: markEdited(auto.autoFilled, 'preferredLocation') }
    const afterRemove = applyLots(edited.brief, edited.autoFilled, [])
    assertEq(afterRemove.brief.preferredLocation, 'Oran centre', 'an edited value survives removing the unit')
    assertEq(afterRemove.brief.budgetMax, '', 'an untouched filled value is cleared')

    section('auto-fill: adding a unit refreshes what units filled')
    const more = applyLots(auto.brief, auto.autoFilled, [lot('a'), lot('b', { totalPrice: 9_000_000 })])
    assertEq(`${more.brief.budgetMin}-${more.brief.budgetMax}`, '9000000-12500000', 'the range follows the units')

    section('auto-fill: a filled end never crosses a typed one')
    const crossing = applyLots({ ...EMPTY, budgetMax: '5000000' }, {}, [lot('a'), lot('b', { totalPrice: 9_000_000 })])
    assertEq(crossing.brief.budgetMax, '5000000', 'the typed ceiling is kept')
    assertEq(crossing.brief.budgetMin, '', 'the floor that would exceed it is left out')

    section('project change drops units from other projects')
    const mixed = [lot('a'), lot('x', { program: { id: 'p2', name: 'Bir El Djir', city: 'Oran' } })]
    const moved = changeProgram(EMPTY, {}, mixed, 'p2')
    assertEq(moved.lots.map((l) => l.id).join(','), 'x', 'only the new project\'s units remain')
    const none = changeProgram(auto.brief, auto.autoFilled, [lot('a')], '')
    assertEq(none.lots.length, 0, 'clearing the project clears the units')
    assertEq(none.brief.budgetMax, '', 'and what they filled')
  })
}
