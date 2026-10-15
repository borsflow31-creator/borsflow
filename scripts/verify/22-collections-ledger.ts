/**
 * Scenario 22 — encaissement: payments on calls for funds.
 *
 *  a. Cents arithmetic and the call balance rules, with no database.
 *  b. A full payment settles the call and its invoice and gets a receipt number;
 *     a part payment leaves the call part paid with the exact remainder, and a
 *     second payment settles it.
 *  c. Nothing can be paid twice over: an amount above what is due is refused and
 *     writes nothing, two concurrent payments cannot both pass, and a retried
 *     request with the same key returns the payment it already made.
 *  d. A cheque waits: it needs a number, counts for nothing and has no receipt
 *     until cleared, reserves its amount meanwhile, and releases it if it bounces.
 *  e. Corrections leave a trail: only an owner or admin can reverse or refund, a
 *     reversal keeps the row and its receipt number, a refund never exceeds what
 *     the payment brought in, and the balance follows.
 *  f. A payment taken on the invoice itself moves the call too (it used not to).
 *  g. The receipt is rendered from the stored row: asking twice records nothing.
 *  h. The dashboard, the financial report and the customer tab agree with the
 *     ledger: part payments count, pending, failed and reversed ones do not.
 *  i. Scoping: a call of another workspace cannot be paid from this one.
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
import { callAmounts, effectiveCallStatus, sumCallAmounts } from '../../src/lib/services/developer/call-balance'
import { METHOD_RULES, fromCents, signedAmount, toCents } from '../../src/lib/documents/payment-rules'
import { hasPermission } from '../../src/lib/workspace'

const DAY = 86_400_000

async function rejects(fn: () => Promise<unknown>, status: number | null, message: string): Promise<void> {
  try {
    await fn()
  } catch (error: any) {
    if (status !== null) assertEq(error?.status, status, `${message}: status`)
    return
  }
  throw new Error(`${message}: expected a rejection`)
}

function pureChecks() {
  section('cents: rounding the way a person would, sums without drift')
  assertEq(toCents(1.005), 101, '1.005 rounds up to 1.01')
  assertEq(toCents(0.1) + toCents(0.2), toCents(0.3), '0.1 + 0.2 is 0.3 in cents')
  assertEq(fromCents(toCents(1234567.89)), 1234567.89, 'large amounts round-trip')
  assertEq(signedAmount({ amount: 50, kind: 'refund' }), -50, 'a refund counts negatively')

  section('call balance: part payments count for what was received')
  const now = Date.parse('2026-10-14T12:00:00Z')
  const partial = callAmounts({ amount: 1000, status: 'partially_paid', dueAt: '2026-11-01', invoice: { amountPaid: 300.1 } }, now)
  assertEq(partial.collected, 300.1, 'collected is the confirmed amount')
  assertEq(partial.outstanding, 699.9, 'outstanding is the exact remainder')
  assertEq(partial.overdue, 0, 'not overdue before its due date')
  const late = callAmounts({ amount: 1000, status: 'partially_paid', dueAt: '2026-10-01', invoice: { amountPaid: 400 } }, now)
  assertEq(late.overdue, 600, 'past due, only what is still owed is overdue')
  assertEq(effectiveCallStatus({ status: 'issued', dueAt: '2026-10-01' }, now), 'overdue', 'unpaid past due reads overdue')
  assertEq(callAmounts({ amount: 500, status: 'draft', dueAt: null }, now).called, 0, 'a draft is not called')
  assertEq(callAmounts({ amount: 500, status: 'paid', dueAt: null }, now).collected, 500, 'a legacy call with no invoice falls back to its status')
  const total = sumCallAmounts([
    { amount: 0.1, status: 'issued', dueAt: null, invoice: { amountPaid: 0.1 } },
    { amount: 0.2, status: 'issued', dueAt: null, invoice: { amountPaid: 0.2 } },
  ], now)
  assertEq(total.collected, 0.3, 'totals are summed in cents')

  section('methods and roles')
  assertEq(METHOD_RULES.check.startsPending, true, 'a cheque starts pending')
  assertEq(METHOD_RULES.check.reference, 'required', 'and needs its number')
  assertEq(METHOD_RULES.bank_transfer.startsPending, false, 'a transfer counts at once')
  assertEq(hasPermission('viewer', 'content:create'), false, 'a viewer cannot record a payment (the routes ask for content:create)')
  assertEq(hasPermission('member', 'content:create'), true, 'a member can')
}

export default function scenario() {
  return runScenario('22 collections ledger', async () => {
    pureChecks()

    useVerifyDatabase()
    const prisma = verifyClient()
    const collections = await import('../../src/lib/services/developer/collections')
    const { markCallForFundsPaid } = await import('../../src/lib/services/developer/calls-for-funds')
    const { recalculateInvoicePayment } = await import('../../src/lib/documents/payments')
    const { getReport } = await import('../../src/lib/services/developer/reports')
    const { getDeveloperDashboard } = await import('../../src/lib/services/developer/dashboard')
    const { getCustomerOverview } = await import('../../src/lib/services/developer/customer')

    const fixtures: Fixture[] = []
    try {
      const fx = await makeWorkspace(prisma, 'ledger')
      fixtures.push(fx)
      const other = await makeWorkspace(prisma, 'ledger-other')
      fixtures.push(other)
      const owner = { workspaceId: fx.workspaceId, userId: fx.userId, canModerate: true }
      const member = { workspaceId: fx.workspaceId, userId: fx.userId, canModerate: false }

      /** A sold unit with a buyer and one issued call of `amount`, billed on its own invoice. */
      async function seedCall(f: Fixture, amount: number, opts: { dueInDays?: number; price?: number } = {}) {
        const tag = uid()
        const program = await prisma.program.create({
          data: { workspaceId: f.workspaceId, reference: `P${tag}`, name: `Résidence ${tag}`, city: 'Alger' },
        })
        const buyer = await prisma.lead.create({
          data: { firstName: 'Amina', lastName: `Buyer ${tag}`, email: `${tag}@verify.invalid`, pipelineId: f.pipelines.Lead },
        })
        const lot = await prisma.developmentLot.create({
          data: {
            workspaceId: f.workspaceId,
            programId: program.id,
            lotNumber: `A-${tag}`,
            status: 'contract_signed',
            totalPrice: opts.price ?? amount * 4,
            buyerLeadId: buyer.id,
          },
        })
        const milestone = await prisma.constructionMilestone.create({
          data: { programId: program.id, stageKey: 'FOUNDATIONS', title: 'Fondations', targetPercentage: 25, order: 1, isCertified: true },
        })
        const dueAt = new Date(Date.now() + (opts.dueInDays ?? 30) * DAY)
        const invoice = await prisma.invoice.create({
          data: {
            workspaceId: f.workspaceId,
            invoiceNumber: `INV-${tag}`,
            clientName: 'Amina',
            status: 'sent',
            total: amount,
            subtotal: amount,
            amountDue: amount,
            dueDate: dueAt,
            leadId: buyer.id,
          },
        })
        const call = await prisma.callForFunds.create({
          data: {
            workspaceId: f.workspaceId,
            lotId: lot.id,
            milestoneId: milestone.id,
            invoiceId: invoice.id,
            callNumber: `AF-${tag}`,
            percentage: 25,
            amount,
            status: 'issued',
            issuedAt: new Date(),
            dueAt,
          },
        })
        return { call, invoice, lot, buyer }
      }

      const state = async (callId: string) => {
        const call = await prisma.callForFunds.findUniqueOrThrow({ where: { id: callId }, include: { invoice: true } })
        return { status: call.status, paidAt: call.paidAt, invoiceStatus: call.invoice!.status, amountPaid: call.invoice!.amountPaid, amountDue: call.invoice!.amountDue }
      }
      const key = () => uid('req-')

      // ── b. full and part payments ────────────────────────────────────────────
      section('a full payment settles the call and its invoice, with a receipt')
      const full = await seedCall(fx, 25000)
      const paidFull = await collections.recordCallPayment(member, full.call.id, {
        amount: 25000, method: 'bank_transfer', reference: 'VIR-1', clientRequestId: key(),
      })
      const year = new Date().getFullYear()
      assertEq(paidFull.payment.status, 'confirmed', 'a transfer is confirmed at once')
      assert(/^REC-\d{4}-\d{4}$/.test(paidFull.payment.receiptNumber ?? ''), 'it gets a REC-YYYY-NNNN receipt number')
      assertEq(paidFull.payment.receiptNumber, `REC-${year}-0001`, 'numbering starts at 0001 for the workspace and year')
      let s = await state(full.call.id)
      assertEq(s.status, 'paid', 'call paid')
      assertEq(s.invoiceStatus, 'paid', 'invoice paid')
      assert(s.paidAt !== null, 'call paidAt set')

      section('a part payment leaves the exact remainder, a second one settles it')
      const part = await seedCall(fx, 1000.3)
      await collections.recordCallPayment(member, part.call.id, { amount: 300.1, method: 'cash', clientRequestId: key() })
      s = await state(part.call.id)
      assertEq(s.status, 'partially_paid', 'call part paid')
      assertEq(s.invoiceStatus, 'partially_paid', 'invoice part paid')
      assertEq(s.amountDue, 700.2, 'remainder correct to the cent')
      let ledger = await collections.getLotLedger(member, part.lot.id)
      assertEq(ledger.calls[0].payable, 700.2, 'the ledger offers exactly the remainder')
      assertEq(ledger.totals.collected, 300.1, 'and counts what was received')
      const second = await collections.recordCallPayment(member, part.call.id, { amount: 700.2, method: 'cash', clientRequestId: key() })
      assertEq(second.payment.receiptNumber, `REC-${year}-0003`, 'each confirmed payment takes the next number')
      s = await state(part.call.id)
      assertEq(s.status, 'paid', 'second payment settles the call')
      assertEq(s.amountDue, 0, 'nothing left due')

      // ── c. no double payment ────────────────────────────────────────────────
      section('more than is due is refused and writes nothing')
      const over = await seedCall(fx, 500)
      await rejects(() => collections.recordCallPayment(member, over.call.id, { amount: 500.01, method: 'cash', clientRequestId: key() }), 409, 'overpayment')
      assertEq(await prisma.payment.count({ where: { invoiceId: over.invoice.id } }), 0, 'no row was written')
      await rejects(() => collections.recordCallPayment(member, over.call.id, { amount: 0, method: 'cash', clientRequestId: key() }), 400, 'zero amount')
      await rejects(() => collections.recordCallPayment(member, over.call.id, { amount: 10, method: 'cash', paidAt: new Date(Date.now() + 3 * DAY).toISOString(), clientRequestId: key() }), 400, 'a date in the future')
      await rejects(() => collections.recordCallPayment(member, over.call.id, { amount: 10, method: 'cash' }), 400, 'no request key')
      await rejects(() => collections.recordCallPayment(member, over.call.id, { amount: 10, method: 'bitcoin', clientRequestId: key() }), 400, 'an unknown method')

      section('the same request key twice is one payment')
      const sameKey = key()
      const first = await collections.recordCallPayment(member, over.call.id, { amount: 100, method: 'cash', clientRequestId: sameKey })
      const again = await collections.recordCallPayment(member, over.call.id, { amount: 100, method: 'cash', clientRequestId: sameKey })
      assertEq(again.replayed, true, 'the retry is recognised')
      assertEq(again.payment.id, first.payment.id, 'and answers with the first payment')
      assertEq(await prisma.payment.count({ where: { invoiceId: over.invoice.id } }), 1, 'one row')
      const [raceA, raceB] = await Promise.allSettled([
        collections.recordCallPayment(member, over.call.id, { amount: 50, method: 'cash', clientRequestId: `${sameKey}-r` }),
        collections.recordCallPayment(member, over.call.id, { amount: 50, method: 'cash', clientRequestId: `${sameKey}-r` }),
      ])
      assert(raceA.status === 'fulfilled' && raceB.status === 'fulfilled', 'two simultaneous sends of one key both answer')
      assertEq(await prisma.payment.count({ where: { invoiceId: over.invoice.id } }), 2, 'and make one row between them')

      section('two concurrent payments cannot together exceed the call')
      const race = await seedCall(fx, 1000)
      const results = await Promise.allSettled([
        collections.recordCallPayment(member, race.call.id, { amount: 700, method: 'cash', clientRequestId: key() }),
        collections.recordCallPayment(member, race.call.id, { amount: 700, method: 'cash', clientRequestId: key() }),
      ])
      assertEq(results.filter((r) => r.status === 'fulfilled').length, 1, 'exactly one succeeds')
      const loser = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
      assertEq(loser.reason?.status, 409, 'the other is refused as more than is due')
      assertEq((await state(race.call.id)).amountPaid, 700, 'and the call holds 700')

      section('marking paid in full twice books the money once')
      const mark = await seedCall(fx, 800)
      await markCallForFundsPaid(member, mark.call.id, { method: 'bank_transfer' })
      await markCallForFundsPaid(member, mark.call.id, { method: 'bank_transfer' })
      assertEq(await prisma.payment.count({ where: { invoiceId: mark.invoice.id } }), 1, 'one payment')
      assertEq((await state(mark.call.id)).status, 'paid', 'call paid')

      // ── d. cheques ──────────────────────────────────────────────────────────
      section('a cheque needs its number, waits to clear, and reserves its amount')
      const cheque = await seedCall(fx, 2000)
      await rejects(() => collections.recordCallPayment(member, cheque.call.id, { amount: 2000, method: 'check', clientRequestId: key() }), 400, 'cheque without a number')
      const pendingCheque = await collections.recordCallPayment(member, cheque.call.id, { amount: 1500, method: 'check', reference: 'CHQ-0042', clientRequestId: key() })
      assertEq(pendingCheque.payment.status, 'pending', 'saved as pending')
      assertEq(pendingCheque.payment.receiptNumber, null, 'no receipt yet')
      s = await state(cheque.call.id)
      assertEq(s.amountPaid, 0, 'counts for nothing')
      assertEq(s.status, 'issued', 'the call is unchanged')
      await rejects(() => collections.getReceiptData(member, pendingCheque.payment.id), 409, 'receipt of a pending cheque')
      await rejects(() => collections.recordCallPayment(member, cheque.call.id, { amount: 600, method: 'cash', clientRequestId: key() }), 409, 'the pending amount is reserved')
      ledger = await collections.getLotLedger(member, cheque.lot.id)
      assertEq(ledger.totals.pending, 1500, 'the ledger shows it pending')
      assertEq(ledger.calls[0].payable, 500, 'and offers only the rest')

      section('a bounced cheque releases its amount; a cleared one counts')
      await rejects(() => collections.failPayment(member, pendingCheque.payment.id, {}), 400, 'failing needs a reason')
      await collections.failPayment(member, pendingCheque.payment.id, { reason: 'Provision insuffisante' })
      const failedRow = await prisma.payment.findUniqueOrThrow({ where: { id: pendingCheque.payment.id } })
      assertEq(failedRow.status, 'failed', 'kept, marked failed')
      assertEq(failedRow.reversalReason, 'Provision insuffisante', 'with the reason')
      const cheque2 = await collections.recordCallPayment(member, cheque.call.id, { amount: 2000, method: 'check', reference: 'CHQ-0043', clientRequestId: key() })
      const cleared = await collections.confirmPayment(member, cheque2.payment.id)
      assertEq(cleared.status, 'confirmed', 'cleared')
      assert(cleared.receiptNumber !== null, 'and now has a receipt number')
      assertEq((await state(cheque.call.id)).status, 'paid', 'the call is paid')
      await rejects(() => collections.confirmPayment(member, cheque2.payment.id), 409, 'confirming twice')

      // ── e. reversals and refunds ────────────────────────────────────────────
      section('only an owner or admin reverses or refunds')
      await rejects(() => collections.reversePayment(member, paidFull.payment.id, { reason: 'x' }), 403, 'member reverse')
      await rejects(() => collections.refundPayment(member, paidFull.payment.id, { amount: 1, reason: 'x', method: 'bank_transfer', clientRequestId: key() }), 403, 'member refund')

      section('a reversal keeps the row and its number, and reopens the call')
      await rejects(() => collections.reversePayment(owner, paidFull.payment.id, {}), 400, 'reversal needs a reason')
      await collections.reversePayment(owner, paidFull.payment.id, { reason: 'Saisi sur le mauvais lot' })
      const reversedRow = await prisma.payment.findUniqueOrThrow({ where: { id: paidFull.payment.id } })
      assertEq(reversedRow.status, 'reversed', 'marked reversed, not deleted')
      assertEq(reversedRow.receiptNumber, paidFull.payment.receiptNumber, 'receipt number kept')
      assertEq(reversedRow.reversedById, fx.userId, 'who reversed it is recorded')
      s = await state(full.call.id)
      assertEq(s.amountPaid, 0, 'it no longer counts')
      assertEq(s.status, 'issued', 'the call is open again')
      assertEq(s.paidAt, null, 'and no longer has a paid date')
      await rejects(() => collections.reversePayment(owner, paidFull.payment.id, { reason: 'again' }), 409, 'reversing twice')

      section('a refund is its own row, capped at what came in')
      const refundable = await seedCall(fx, 3000)
      const toRefund = await collections.recordCallPayment(member, refundable.call.id, { amount: 3000, method: 'bank_transfer', clientRequestId: key() })
      await rejects(() => collections.refundPayment(owner, toRefund.payment.id, { amount: 3000.01, reason: 'Annulation', method: 'bank_transfer', clientRequestId: key() }), 409, 'refund above the payment')
      const refund = await collections.refundPayment(owner, toRefund.payment.id, { amount: 1000, reason: 'Annulation partielle', method: 'bank_transfer', clientRequestId: key() })
      assertEq(refund.payment.kind, 'refund', 'kind refund')
      assertEq(refund.payment.refundOfId, toRefund.payment.id, 'linked to the payment it returns')
      s = await state(refundable.call.id)
      assertEq(s.amountPaid, 2000, 'the invoice nets the refund')
      assertEq(s.status, 'partially_paid', 'and the call is part paid again')
      await rejects(() => collections.refundPayment(owner, toRefund.payment.id, { amount: 2000.01, reason: 'Encore', method: 'bank_transfer', clientRequestId: key() }), 409, 'refunds together cannot exceed the payment')
      await rejects(() => collections.reversePayment(owner, toRefund.payment.id, { reason: 'x' }), 409, 'a refunded payment cannot be reversed while its refund stands')

      // ── f. the invoice path ─────────────────────────────────────────────────
      section('a payment taken on the invoice itself moves the call too')
      const viaInvoice = await seedCall(fx, 900)
      await prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: { invoiceId: viaInvoice.invoice.id, workspaceId: fx.workspaceId, amount: 900, paymentMethod: 'cash', status: 'confirmed' },
        })
        await recalculateInvoicePayment(tx, viaInvoice.invoice.id)
      })
      assertEq((await state(viaInvoice.call.id)).status, 'paid', 'the call follows its invoice')
      await rejects(() => collections.recordCallPayment(member, viaInvoice.call.id, { amount: 1, method: 'cash', clientRequestId: key() }), 409, 'and cannot then be paid again')

      section('a part payment past due reads overdue, for what is left')
      const late = await seedCall(fx, 1000, { dueInDays: -10 })
      await collections.recordCallPayment(member, late.call.id, { amount: 250, method: 'cash', clientRequestId: key() })
      assertEq((await state(late.call.id)).status, 'overdue', 'still overdue')
      ledger = await collections.getLotLedger(member, late.lot.id)
      assertEq(ledger.totals.overdue, 750, 'overdue is the remainder, not the whole call')
      assert(ledger.calls[0].daysLate >= 9, 'days late are counted')

      // ── g. receipts ─────────────────────────────────────────────────────────
      section('a receipt can be produced again without recording anything')
      const before = await prisma.payment.count({ where: { workspaceId: fx.workspaceId } })
      const r1 = await collections.getReceiptData(member, second.payment.id)
      const r2 = await collections.getReceiptData(member, second.payment.id)
      assertEq(r1.payment.receiptNumber, r2.payment.receiptNumber, 'same number both times')
      assertEq(await prisma.payment.count({ where: { workspaceId: fx.workspaceId } }), before, 'no payment was added')
      assertEq(r1.remainingOnCall, 0, 'it states what is left on the call')
      const { renderReceiptPdf } = await import('../../src/lib/documents/receipt-pdf')
      const { serverTranslator } = await import('../../src/i18n/server')
      const pdf = await renderReceiptPdf({
        receiptNumber: r1.payment.receiptNumber!, status: r1.payment.status, workspaceName: r1.workspace.name,
        currency: 'DZD', locale: 'fr', buyer: { name: 'Amina' }, programName: r1.call.lot.program.name,
        lotNumber: r1.call.lot.lotNumber, callNumber: r1.call.callNumber, milestoneTitle: r1.call.milestone.title,
        paymentDate: r1.payment.paymentDate, amount: r1.payment.amount, method: r1.payment.paymentMethod,
        remainingOnCall: r1.remainingOnCall, remainingOnContract: r1.remainingOnContract,
      }, await serverTranslator('fr'))
      assertEq(pdf.subarray(0, 4).toString(), '%PDF', 'the receipt renders as a PDF')
      const reversedReceipt = await collections.getReceiptData(member, paidFull.payment.id)
      assertEq(reversedReceipt.payment.status, 'reversed', 'a cancelled payment still has its receipt, marked cancelled')

      // ── h. reports agree with the ledger ────────────────────────────────────
      section('the dashboard, the report and the customer tab agree with the ledger')
      const rows = await prisma.payment.findMany({
        where: { workspaceId: fx.workspaceId, status: 'confirmed' },
        select: { amount: true, kind: true },
      })
      const confirmedNet = fromCents(rows.reduce((t, r) => t + toCents(signedAmount(r)), 0))
      const dashboard = await getDeveloperDashboard(member)
      assertEq(dashboard.kpis.collected, confirmedNet, 'dashboard collected = confirmed money, net of refunds')
      const report = await getReport(member, 'financial', { from: new Date(Date.now() - 30 * DAY), to: new Date(Date.now() + DAY) })
      const collected = report.summary.find((x) => x.key === 'collected')!.value
      assertEq(collected, confirmedNet, 'financial report collected = confirmed money in the window')
      const customer = await getCustomerOverview(member, part.buyer.id)
      assertEq(customer.totals.paid, 1000.3, 'customer paid counts both part payments')
      assertEq(customer.totals.due, 0, 'and nothing due')

      // ── i. scoping ──────────────────────────────────────────────────────────
      section('a call of another workspace cannot be reached')
      const foreign = await seedCall(other, 400)
      await rejects(() => collections.recordCallPayment(member, foreign.call.id, { amount: 400, method: 'cash', clientRequestId: key() }), 404, 'foreign call')
      await rejects(() => collections.getLotLedger(member, foreign.lot.id), 404, 'foreign ledger')
      const foreignPayment = await collections.recordCallPayment(
        { workspaceId: other.workspaceId, userId: other.userId }, foreign.call.id, { amount: 400, method: 'cash', clientRequestId: key() }
      )
      await rejects(() => collections.reversePayment(owner, foreignPayment.payment.id, { reason: 'x' }), 404, 'foreign payment')
      const otherReceipt = (await prisma.payment.findFirstOrThrow({ where: { workspaceId: other.workspaceId } })).receiptNumber
      assertEq(otherReceipt, `REC-${year}-0001`, 'each workspace numbers its own receipts')

      // ── j. the deposit is a payment ─────────────────────────────────────────
      const lots = await import('../../src/lib/services/developer/lots')
      const { certifyMilestone } = await import('../../src/lib/services/developer/milestones')

      /** An available unit and a buyer who can reserve it. */
      async function seedAvailable(price: number) {
        const tag = uid()
        const program = await prisma.program.create({
          data: { workspaceId: fx.workspaceId, reference: `D${tag}`, name: `Résidence ${tag}`, city: 'Oran' },
        })
        const buyer = await prisma.lead.create({
          data: { firstName: 'Karim', lastName: `Buyer ${tag}`, pipelineId: fx.pipelines.Lead },
        })
        const lot = await prisma.developmentLot.create({
          data: { workspaceId: fx.workspaceId, programId: program.id, lotNumber: `B-${tag}`, status: 'available', totalPrice: price, basePrice: price },
        })
        return { program, buyer, lot }
      }

      section('a deposit received at the reservation is a payment, with its receipt')
      const d1 = await seedAvailable(1_000_000)
      await lots.reserveLot(member, d1.lot.id, {
        buyerLeadId: d1.buyer.id,
        reservationFee: 100_000,
        depositPayment: { method: 'bank_transfer', reference: 'VIR-DEP', clientRequestId: key() },
      })
      // Re-read with different includes along the way, so typed loosely.
      let unit: any = await prisma.developmentLot.findUniqueOrThrow({
        where: { id: d1.lot.id },
        include: { depositInvoice: { include: { payments: true } } },
      })
      assert(unit.depositInvoice !== null, 'the unit has a deposit invoice')
      assertEq(unit.depositInvoice!.depositForLotId, d1.lot.id, 'which remembers its unit')
      assertEq(unit.depositInvoice!.payments.length, 1, 'one payment on it')
      assertEq(unit.depositInvoice!.payments[0].status, 'confirmed', 'a transfer counts at once')
      assert(unit.depositInvoice!.payments[0].receiptNumber !== null, 'and has a receipt number')
      assert(unit.reservationFeePaidAt !== null, 'the unit shows the deposit received')
      assertEq(unit.reservationFee, 100_000, 'and the amount asked')
      ledger = await collections.getLotLedger(member, d1.lot.id)
      assertEq(ledger.calls[0].type, 'deposit', 'the deposit is the first line of the schedule')
      assertEq(ledger.totals.deposit, 100_000, 'received in full')
      assertEq(ledger.totals.remainingOnContract, 900_000, 'and taken off what is left on the price')
      const depositPaymentId = unit.depositInvoice!.payments[0].id
      const depositReceipt = await collections.getReceiptData(member, depositPaymentId)
      assertEq(depositReceipt.call.isDeposit, true, 'its receipt says it is the deposit')
      let journalNow = await collections.listCallPayments(member, { programId: d1.program.id })
      assertEq(journalNow.payments.length, 1, 'the journal lists it')
      assertEq(journalNow.payments[0].call?.type, 'deposit', 'as a deposit')

      section('a deposit by cheque waits, and the date can no longer be typed by hand')
      const d2 = await seedAvailable(500_000)
      await lots.reserveLot(member, d2.lot.id, {
        buyerLeadId: d2.buyer.id,
        reservationFee: 50_000,
        depositPayment: { method: 'check', reference: 'CHQ-9', clientRequestId: key() },
      })
      unit = await prisma.developmentLot.findUniqueOrThrow({ where: { id: d2.lot.id }, include: { depositInvoice: { include: { payments: true } } } })
      assertEq(unit.depositInvoice!.payments[0].status, 'pending', 'the cheque is pending')
      assertEq(unit.reservationFeePaidAt, null, 'so the deposit is not received yet')
      await rejects(() => lots.updateLot(member, d2.lot.id, { reservationFeePaidAt: new Date().toISOString() }), 400, 'a typed received date')
      await rejects(() => lots.updateLot(member, d2.lot.id, { reservationFee: 40_000 }), 409, 'a deposit below what is waiting to clear')
      await lots.updateLot(member, d2.lot.id, { reservationFee: 60_000 })
      ledger = await collections.getLotLedger(member, d2.lot.id)
      assertEq(ledger.calls[0].payable, 10_000, 'raising the deposit leaves the difference to collect')
      await collections.confirmPayment(member, unit.depositInvoice!.payments[0].id)
      await collections.recordDepositPayment(member, d2.lot.id, { amount: 10_000, method: 'cash', clientRequestId: key() })
      assert((await prisma.developmentLot.findUniqueOrThrow({ where: { id: d2.lot.id } })).reservationFeePaidAt !== null, 'paid in full, the deposit is received')
      await rejects(() => collections.recordDepositPayment(member, d2.lot.id, { amount: 1, method: 'cash', clientRequestId: key() }), 409, 'and cannot be paid again')

      section('a bad deposit payment refuses the whole reservation')
      const d3 = await seedAvailable(300_000)
      await rejects(() => lots.reserveLot(member, d3.lot.id, {
        buyerLeadId: d3.buyer.id,
        reservationFee: 30_000,
        depositPayment: { method: 'check', clientRequestId: key() },
      }), 400, 'a cheque deposit without its number')
      assertEq((await prisma.developmentLot.findUniqueOrThrow({ where: { id: d3.lot.id } })).status, 'available', 'the unit was not reserved')

      section('a cancellation refunds the deposit, capped, by an owner or admin, and frees the unit')
      await rejects(() => lots.cancelLotSale(member, d1.lot.id, { refundAmount: 10 }), 403, 'a member refunding')
      await rejects(() => lots.cancelLotSale(owner, d1.lot.id, { refundAmount: 100_000.01 }), 409, 'a refund above the deposit')
      await lots.cancelLotSale(owner, d1.lot.id, { reason: 'Crédit refusé', refundAmount: 100_000 })
      unit = await prisma.developmentLot.findUniqueOrThrow({ where: { id: d1.lot.id }, include: { depositInvoice: { include: { payments: true } } } })
      assertEq(unit.status, 'available', 'the unit is back on sale')
      assertEq(unit.depositInvoiceId, null, 'without the old deposit')
      const oldDeposit = await prisma.invoice.findFirstOrThrow({ where: { depositForLotId: d1.lot.id }, include: { payments: true } })
      assertEq(oldDeposit.amountPaid, 0, 'the old deposit nets to zero after the refund')
      assertEq(oldDeposit.payments.filter((p: { kind: string }) => p.kind === 'refund').length, 1, 'with one refund row')
      journalNow = await collections.listCallPayments(member, { programId: d1.program.id })
      assertEq(journalNow.payments.length, 2, 'the payment and its refund stay in the journal')
      await lots.reserveLot(member, d1.lot.id, { buyerLeadId: d1.buyer.id, reservationFee: 80_000 })
      unit = await prisma.developmentLot.findUniqueOrThrow({ where: { id: d1.lot.id }, include: { depositInvoice: true } })
      assert(unit.depositInvoice!.invoiceNumber.endsWith('-2'), 'the next sale gets a deposit of its own, numbered -2')

      // ── k. certification and billing are one step ───────────────────────────
      section('a failed generation leaves the milestone uncertified and nothing billed')
      const sold = await seedCall(fx, 1000)
      const m1 = await prisma.constructionMilestone.create({
        data: { programId: sold.lot.programId, stageKey: 'GROUND_FLOOR_SLAB', title: 'Dalle', targetPercentage: 25, order: 2 },
      })
      const invoicesBefore = await prisma.invoice.count({ where: { workspaceId: fx.workspaceId } })
      // Same cumulative percentage as the milestone before it: a tranche of zero, which is refused.
      await rejects(() => certifyMilestone(owner, m1.id), 400, 'a zero tranche')
      assertEq((await prisma.constructionMilestone.findUniqueOrThrow({ where: { id: m1.id } })).isCertified, false, 'the milestone is not certified')
      assertEq(await prisma.invoice.count({ where: { workspaceId: fx.workspaceId } }), invoicesBefore, 'and no invoice was left behind')

      section('two simultaneous certifications bill once')
      const m2 = await prisma.constructionMilestone.create({
        data: { programId: sold.lot.programId, stageKey: 'ROOF_WATERTIGHT', title: 'Hors d’eau', targetPercentage: 60, order: 3 },
      })
      const both = await Promise.allSettled([certifyMilestone(owner, m2.id), certifyMilestone(owner, m2.id)])
      assertEq(both.filter((r) => r.status === 'fulfilled').length, 1, 'exactly one certification succeeds')
      assertEq(await prisma.callForFunds.count({ where: { milestoneId: m2.id } }), 1, 'and one call is billed')
      await rejects(
        () => prisma.callForFunds.create({
          data: { workspaceId: fx.workspaceId, lotId: sold.lot.id, milestoneId: m2.id, callNumber: `dup-${uid()}`, percentage: 1, amount: 1 },
        }),
        null,
        'the database refuses a second call for the same unit and milestone'
      )
    } finally {
      for (const f of fixtures) await cleanup(prisma, f)
      await prisma.documentCounter.deleteMany({ where: { workspaceId: { in: fixtures.map((f) => f.workspaceId) } } })
      await prisma.$disconnect()
    }
  })
}
