/**
 * Scenario 16 — developer sales operations: documents, reminders, commissions, export.
 *
 *  a. A template never reaches a buyer with a hole in it: a mistyped placeholder is
 *     reported (and left visible), a missing fact becomes a blank line and is
 *     reported, repeated and spaced placeholders all resolve, and HTML mode escapes
 *     both the wording and the values.
 *  b. The reminder cadence sends one reminder per step, only the latest step that
 *     has been reached, never twice, and never a backlog after an outage.
 *  c. The sale stage is derived from the unit, its documents and its calls, and
 *     cannot disagree with them.
 *  d. A unit's commission is taken on the price without VAT, and the default split
 *     adds up to exactly the fee, to the cent.
 *  e. The CSV writer survives commas, quotes and line breaks, opens in Excel with
 *     accents intact, and cannot turn a lead's name into a spreadsheet formula.
 *  f. A portal code is stored as a hash, matches only itself, and is bound to its unit.
 *
 * No database: every rule here is pure and lives in lib/ so it can be proved
 * without standing one up.
 */

import { BLANK, DEFAULT_TEMPLATES, MERGE_FIELDS, placeholdersIn, renderTemplate } from '../../src/lib/documents/sales-merge'
import { LATE_STEPS, daysPastDue, reminderStepFor } from '../../src/lib/crm/reminders'
import { saleStage } from '../../src/lib/crm/sale-stage'
import { defaultSplits, lotNetPrice, resolveAmounts } from '../../src/lib/services/commissions'
import { csvCell, toCsv } from '../../src/lib/export/csv'
import { assert, assertEq, runScenario, section } from './_harness'

const due = new Date('2026-10-10T09:00:00Z')
const at = (iso: string) => new Date(iso)

export default function scenario() {
  return runScenario('16 developer sales (no DB)', async () => {
    section('templates: unknown placeholders are reported and left visible')
    const typo = renderTemplate('Dear {{buyr_name}}, unit {{unit}}.', { buyer_name: 'Ana', unit: 'A1' })
    assertEq(typo.unknown.join(), 'buyr_name', 'the typo is named')
    assert(typo.text.includes('{{buyr_name}}'), 'and stays in the text, so it cannot be mistaken for a filled field')
    assertEq(typo.text.includes('A1'), true, 'known placeholders still resolve alongside it')

    section('templates: a missing fact becomes a blank line, reported')
    const noFee = renderTemplate('Deposit: {{reservation_fee}}', { reservation_fee: '' })
    assertEq(noFee.text, `Deposit: ${BLANK}`, 'an empty value leaves a line to write on')
    assertEq(noFee.missing.join(), 'reservation_fee', 'and is listed as missing')
    assertEq(renderTemplate('{{unit}}', { unit: null }).missing.length, 1, 'null counts as missing')
    assertEq(renderTemplate('{{unit}}', { unit: '   ' }).missing.length, 1, 'whitespace counts as missing')
    assertEq(renderTemplate('{{discount}}', { discount: '0.00' }).missing.length, 0, 'a real zero is a value, not a gap')

    section('templates: spacing, case and repetition')
    const loose = renderTemplate('{{ Unit }} / {{unit}} / {{UNIT}}', { unit: 'B7' })
    assertEq(loose.text, 'B7 / B7 / B7', 'whitespace and case inside the braces do not matter, repeats all resolve')
    assertEq(placeholdersIn('{{a}} {{ B }} {{a}}').join(), 'a,b', 'placeholdersIn is unique and lowercased')

    section('templates: HTML mode escapes wording and values')
    const html = renderTemplate('<b>Hi</b> {{buyer_name}}', { buyer_name: '<script>alert(1)</script>' }, 'html')
    assert(!html.text.includes('<script>') && !html.text.includes('<b>'), 'no markup survives in either the template or a value')
    assert(renderTemplate('a & b {{unit}}', { unit: 'x' }, 'text').text.includes('a & b'), 'text mode leaves characters alone')

    section('templates: the built-in drafts only use placeholders that exist')
    for (const [kind, template] of Object.entries(DEFAULT_TEMPLATES)) {
      const unknown = placeholdersIn(`${template.subject ?? ''}\n${template.body}`).filter((p) => !(MERGE_FIELDS as readonly string[]).includes(p))
      assertEq(unknown.length, 0, `${kind} default has no unknown placeholders`)
    }
    assert(DEFAULT_TEMPLATES.reservation.body.includes('DRAFT'), 'the built-in wording says in its own text that it is a draft')

    section('reminders: the cadence')
    assertEq(daysPastDue(due, at('2026-10-10T23:59:00Z')), 0, 'same UTC day is day zero however late')
    assertEq(daysPastDue(due, at('2026-10-03T00:01:00Z')), -7, 'a week before')
    assertEq(reminderStepFor(due, at('2026-10-02T12:00:00Z')), null, '8 days before: nothing yet')
    assertEq(reminderStepFor(due, at('2026-10-03T12:00:00Z')), 'before7', '7 days before')
    assertEq(reminderStepFor(due, at('2026-10-09T12:00:00Z')), 'before7', 'still the heads-up the day before')
    assertEq(reminderStepFor(due, at('2026-10-10T12:00:00Z')), 'due', 'due day')
    assertEq(reminderStepFor(due, at('2026-10-12T12:00:00Z')), 'due', 'two days late is still the due-day reminder')
    assertEq(reminderStepFor(due, at('2026-10-13T12:00:00Z')), 'late3', '3 days late')
    assertEq(reminderStepFor(due, at('2026-10-17T12:00:00Z')), 'late7', '7 days late')
    assertEq(reminderStepFor(due, at('2026-10-24T12:00:00Z')), 'late14', '14 days late')
    assertEq(reminderStepFor(due, at('2026-12-01T12:00:00Z')), 'late14', 'long overdue stays on the last step')

    section('reminders: once only, and no backlog after an outage')
    assertEq(reminderStepFor(due, at('2026-10-13T12:00:00Z'), ['late3']), null, 'a step already sent is not sent again')
    assertEq(reminderStepFor(due, at('2026-10-13T12:00:00Z'), new Set(['before7', 'due'])), 'late3', 'earlier steps being sent does not block the next')
    assertEq(reminderStepFor(due, at('2026-10-24T12:00:00Z'), []), 'late14', 'a week of downtime sends the one true reminder, not every missed step')
    assertEq(reminderStepFor(due, at('2026-10-24T12:00:00Z'), ['late14']), null, 'and a second run finds nothing to send')
    assertEq(reminderStepFor(due, at('2026-10-03T12:00:00Z'), ['before7']), null, 'running twice in the same window is harmless')
    assert(LATE_STEPS.includes('late3') && !LATE_STEPS.includes('due'), 'only the late steps alert the agent')

    section('sale stage: derived from the unit, its documents and its calls')
    const none: never[] = []
    assertEq(saleStage({ status: 'available', documents: none, calls: none }), null, 'an available unit has no sale')
    assertEq(saleStage({ status: 'optioned', documents: none, calls: none }), null, 'an option is not yet a sale')
    assertEq(saleStage({ status: 'reserved', documents: none, calls: none }), 'reserved', 'just reserved')
    assertEq(saleStage({ status: 'reserved', documents: [{ kind: 'reservation', status: 'sent' }], calls: none }), 'reserved', 'a reservation form sent but not accepted is still just reserved')
    assertEq(saleStage({ status: 'reserved', documents: [{ kind: 'reservation', status: 'accepted' }], calls: none }), 'contract_pending', 'accepted reservation moves it on')
    assertEq(saleStage({ status: 'reserved', documents: [{ kind: 'contract', status: 'sent' }], calls: none }), 'contract_pending', 'a contract out for signature is pending')
    assertEq(saleStage({ status: 'contract_signed', documents: none, calls: none }), 'contract_signed', 'under contract, nothing called yet')
    assertEq(saleStage({ status: 'contract_signed', documents: none, calls: [{ status: 'draft' }] }), 'contract_signed', 'a draft call is not a running plan')
    assertEq(saleStage({ status: 'contract_signed', documents: none, calls: [{ status: 'issued' }] }), 'plan_active', 'an issued call starts the plan')
    assertEq(saleStage({ status: 'deed_signed', documents: none, calls: [{ status: 'paid' }, { status: 'issued' }] }), 'plan_active', 'still owed')
    assertEq(saleStage({ status: 'deed_signed', documents: none, calls: [{ status: 'paid' }, { status: 'paid' }] }), 'completed', 'everything paid is complete')
    assertEq(saleStage({ status: 'delivered', documents: none, calls: [{ status: 'issued' }] }), 'completed', 'keys handed over is complete')

    section('commission: taken on the price without VAT')
    assertEq(lotNetPrice(120, 20), 100, '120 including 20% VAT is 100 net')
    assertEq(lotNetPrice(105.5, 5.5), 100, 'a reduced rate')
    assertEq(lotNetPrice(100, 0), 100, 'a zero-rated sale is unchanged')
    assertEq(lotNetPrice(245000, 20), 204166.67, 'rounded to the cent')

    section('commission: the default split adds up to the fee')
    const solo = defaultSplits(null, 'agent-1')
    assertEq(solo.reduce((s, x) => s + x.sharePercent, 0), 100, 'agency plus the selling agent make 100%')
    assert(solo.some((s) => s.userId === null && s.role === 'agency'), 'the agency keeps its share')
    assert(solo.some((s) => s.userId === 'agent-1' && s.role === 'selling_agent'), 'the unit\'s agent is the selling agent')
    const nobody = defaultSplits(null, null)
    assertEq(nobody.length, 1, 'no agent leaves it all with the agency')
    assertEq(nobody[0].sharePercent, 100, 'at 100%')
    for (const fee of [0.01, 1000, 6125, 6125.01, 9999.99, 12345.67]) {
      const parts = resolveAmounts(fee, defaultSplits(null, 'agent-1'))
      const total = Math.round(parts.reduce((s, p) => s + p.amount, 0) * 100) / 100
      assertEq(total, fee, `shares of ${fee} add back to exactly ${fee}`)
    }

    section('csv: quoting')
    assertEq(csvCell('plain'), 'plain', 'plain text is untouched')
    assertEq(csvCell('a,b'), '"a,b"', 'a comma is quoted')
    assertEq(csvCell('say "hi"'), '"say ""hi"""', 'quotes are doubled')
    assertEq(csvCell('line\nbreak'), '"line\nbreak"', 'a line break is quoted')
    assertEq(csvCell(null), '', 'null is empty')
    assertEq(csvCell(1234.5), '1234.5', 'numbers are written as numbers')
    assertEq(csvCell(new Date('2026-10-10T09:00:00Z')), '2026-10-10T09:00:00.000Z', 'dates are ISO')

    section('csv: Excel and formula safety')
    const out = toCsv([['name', 'amount'], ['José', 5]])
    assert(out.startsWith('﻿'), 'a byte-order mark so Excel reads UTF-8')
    assert(out.includes('José'), 'accents survive')
    assert(out.includes('\r\n'), 'rows end with CRLF')
    for (const evil of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\t=1+1']) {
      assert(csvCell(evil).replace(/^"/, '').startsWith("'"), `${JSON.stringify(evil)} is neutralised`)
    }
    assertEq(csvCell(-5), '-5', 'a real negative number is not mangled')
    assertEq(csvCell('-'), "'-", 'a lone dash string is guarded too')

    section('portal code: stored as a hash, bound to its unit')
    process.env.NEXTAUTH_SECRET = 'verify-secret-not-used-anywhere-else'
    const { hashOtp, otpMatches } = await import('../../src/lib/services/developer/buyer-portal')
    const hash = hashOtp('lot-1', '123456')
    assert(!hash.includes('123456') && /^[0-9a-f]{64}$/.test(hash), 'the stored value is a 64-char digest, not the code')
    assert(otpMatches(hash, 'lot-1', '123456'), 'the right code matches')
    assert(otpMatches(hash, 'lot-1', ' 123456 '), 'surrounding spaces from a paste do not matter')
    assert(!otpMatches(hash, 'lot-1', '123457'), 'a wrong code does not')
    assert(!otpMatches(hash, 'lot-2', '123456'), 'the same digits do not work on another unit')
    assert(hashOtp('lot-1', '123456') === hash, 'hashing is deterministic')
  })
}

if (require.main === module) {
  scenario()
}
