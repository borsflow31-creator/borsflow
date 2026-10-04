/**
 * Scenario 1 — the criteria evaluator, over every subject shape.
 *
 * The evaluator moved out of EmailSegmentationService into src/lib/crm/criteria.ts
 * so that brief matching could reuse it without dragging prisma and the email
 * stack into its import graph. It was already subject-agnostic; this proves the
 * move regressed none of its behaviour, and that the operators work on
 * property-, interest- and mandate-shaped rows as well as leads.
 *
 * No database: that is the point of the extraction.
 */

import { matchesCriteria, matchesCriterion, getFieldValue, parseJson, type Criteria } from '../../src/lib/crm/criteria'
import { assert, assertEq, runScenario, section } from './_harness'

const one = (field: string, operator: Criteria['operator'], value?: any): Criteria =>
  ({ field, operator, value })

export default function scenario() {
  return runScenario('01 criteria engine (no DB)', async () => {
    section('dotted paths resolve through relations and into JSON')
    const lead = { stage: 'Qualified', pipeline: { name: 'Contacts' }, value: 250000 }
    assertEq(getFieldValue(lead, 'pipeline.name'), 'Contacts', 'lead pipeline.name')
    const interest = { stage: 'Offer', lead: { email: 'buyer@example.com' }, property: { city: 'Lisbon', customFields: { heating: 'gas' } } }
    assertEq(getFieldValue(interest, 'property.city'), 'Lisbon', 'interest property.city')
    assertEq(getFieldValue(interest, 'property.customFields.heating'), 'gas', 'dotted path into JSON')
    const mandate = { endDate: new Date('2026-11-01'), lead: { company: 'Vendor SA' }, property: { city: 'Porto' } }
    assertEq(getFieldValue(mandate, 'lead.company'), 'Vendor SA', 'mandate lead.company')
    assertEq(getFieldValue(mandate, 'lead.missing.deep'), null, 'missing path yields null, does not throw')

    section('string input is coerced for numeric comparison')
    const property = { price: 400000, bedrooms: 3, city: 'Lisbon', status: 'available', hasParking: false }
    // The builder sends every value as text; comparing a number against '350000'
    // by identity never matched, which is what the coercion exists for.
    assert(matchesCriterion(property, one('price', 'greater_than', '350000')), 'price > "350000"')
    assert(!matchesCriterion(property, one('price', 'greater_than', '450000')), 'price not > "450000"')
    assert(matchesCriterion(property, one('price', 'equals', '400000')), 'price equals "400000"')
    assert(matchesCriterion(property, one('bedrooms', 'less_than', '4')), 'bedrooms < "4"')

    section('a date equals a day, not a millisecond')
    const expiring = { endDate: new Date('2026-11-01T14:32:11.000Z') }
    assert(matchesCriterion(expiring, one('endDate', 'equals', '2026-11-01')), 'same-day equality')
    assert(!matchesCriterion(expiring, one('endDate', 'equals', '2026-11-02')), 'different day')
    assert(matchesCriterion(expiring, one('endDate', 'not_equals', '2026-11-02')), 'not_equals on a different day')
    assert(matchesCriterion(expiring, one('endDate', 'less_than', '2026-12-01')), 'mandate expiring before a date')
    assert(matchesCriterion(expiring, one('endDate', 'greater_than', '2026-10-01')), 'mandate expiring after a date')

    section('in / not_in are case-insensitive')
    // New leads default to stage "new" while a default pipeline names it "New".
    assert(matchesCriterion({ stage: 'new' }, one('stage', 'in', ['New', 'Contacted'])), 'lowercase stage matches titlecase option')
    assert(matchesCriterion({ stage: 'OFFER' }, one('stage', 'in', ['offer'])), 'uppercase subject value')
    assert(!matchesCriterion({ stage: 'Lost' }, one('stage', 'in', ['New'])), 'absent from the list')
    assert(matchesCriterion({ stage: 'Lost' }, one('stage', 'not_in', ['New'])), 'not_in')
    assert(!matchesCriterion({ stage: 'new' }, one('stage', 'not_in', ['New'])), 'not_in is case-insensitive too')
    assert(!matchesCriterion({ stage: 'new' }, one('stage', 'in', 'New' as any)), 'a non-array value cannot match in')

    section('is_null and is_empty are synonyms, in both polarities')
    for (const op of ['is_null', 'is_empty'] as const) {
      assert(matchesCriterion({ email: null }, one('email', op)), op + ' on null')
      assert(matchesCriterion({ email: '' }, one('email', op)), op + ' on empty string')
      assert(matchesCriterion({}, one('email', op)), op + ' on a missing field')
      assert(!matchesCriterion({ email: 'a@b.c' }, one('email', op)), op + ' on a value')
    }
    for (const op of ['is_not_null', 'is_not_empty'] as const) {
      assert(matchesCriterion({ email: 'a@b.c' }, one('email', op)), op + ' on a value')
      assert(!matchesCriterion({ email: null }, one('email', op)), op + ' on null')
    }

    section('text operators')
    const named = { firstName: 'Amara', company: 'Okonkwo & Daughters' }
    assert(matchesCriterion(named, one('company', 'contains', 'okonkwo')), 'contains is case-insensitive')
    assert(matchesCriterion(named, one('company', 'not_contains', 'zzz')), 'not_contains')
    assert(matchesCriterion(named, one('firstName', 'starts_with', 'AM')), 'starts_with')
    assert(matchesCriterion(named, one('firstName', 'ends_with', 'ra')), 'ends_with')

    section('an unknown operator matches nothing rather than throwing')
    assert(!matchesCriterion(named, one('firstName', 'sounds_like' as any, 'Amara')), 'unknown operator')

    section('required criteria are AND-ed even under OR')
    // The pipeline/stage scope picker is stored as a required criterion, so an
    // "any of these" segment must still be confined to its pipeline.
    const scoped: Criteria[] = [
      { field: 'pipeline.name', operator: 'equals', value: 'Contacts', required: true },
      { field: 'stage', operator: 'equals', value: 'Qualified' },
      { field: 'stage', operator: 'equals', value: 'Won' },
    ]
    assert(matchesCriteria({ pipeline: { name: 'Contacts' }, stage: 'Won' }, scoped, 'OR'), 'in scope, one branch matches')
    assert(!matchesCriteria({ pipeline: { name: 'Other' }, stage: 'Won' }, scoped, 'OR'), 'out of scope is excluded despite OR')
    assert(!matchesCriteria({ pipeline: { name: 'Contacts' }, stage: 'Lost' }, scoped, 'OR'), 'in scope, no branch matches')

    section('AND / OR over the non-required criteria')
    const both: Criteria[] = [
      { field: 'city', operator: 'equals', value: 'Lisbon' },
      { field: 'price', operator: 'less_than', value: '500000' },
    ]
    assert(matchesCriteria(property, both, 'AND'), 'both match under AND')
    assert(!matchesCriteria({ ...property, city: 'Porto' }, both, 'AND'), 'one fails under AND')
    assert(matchesCriteria({ ...property, city: 'Porto' }, both, 'OR'), 'one matches under OR')

    section('empty and malformed criteria match everything')
    assert(matchesCriteria(property, [], 'AND'), 'no criteria')
    assert(matchesCriteria(property, null as any, 'AND'), 'null criteria')
    assert(matchesCriteria(property, 'not an array' as any, 'OR'), 'non-array criteria')
    // Only required criteria: the rest is empty, which must not mean "no match".
    assert(matchesCriteria(property, [{ field: 'city', operator: 'equals', value: 'Lisbon', required: true }], 'OR'), 'required only')

    section('parseJson falls back instead of throwing')
    assertEq(parseJson<number[]>('[1,2]', []).length, 2, 'valid JSON')
    assertEq(parseJson<number[]>('{not json', []).length, 0, 'malformed JSON falls back')
    assertEq(parseJson<number[]>(null, []).length, 0, 'null falls back')
    assertEq(parseJson<number[]>('null', []).length, 0, 'literal null falls back')

    section('a brief evaluated against a property — the Part E direction')
    // The same evaluator, inverted: criteria from a buyer's brief, subject is a
    // new listing. This only works because the evaluator is type-blind.
    const brief: Criteria[] = [
      { field: 'status', operator: 'equals', value: 'available', required: true },
      { field: 'city', operator: 'in', value: ['lisbon', 'cascais'] },
      { field: 'price', operator: 'less_than', value: '450000' },
      { field: 'bedrooms', operator: 'greater_than', value: '2' },
    ]
    assert(matchesCriteria(property, brief, 'AND'), 'listing fits the brief')
    assert(!matchesCriteria({ ...property, price: 600000 }, brief, 'AND'), 'over budget')
    assert(!matchesCriteria({ ...property, status: 'sold' }, brief, 'AND'), 'sold is out of scope')
  })
}

if (require.main === module) {
  scenario()
}
