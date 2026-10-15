import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  METHOD_RULES,
  fromCents,
  isValidPaymentMethod,
  recalculateInvoicePayment,
  signedAmount,
  toCents,
  type PaymentMethod,
} from '@/lib/documents/payments'
import { CrmLogger, type CrmActivityType } from '@/lib/crm/logger'
import { ServiceError } from '../errors'
import type { DeveloperContext } from './programs'
import { DEFAULT_CURRENCY } from '@/lib/currencies'
import { callAmounts, daysLate, effectiveCallStatus } from './call-balance'

/**
 * Encaissement: money received against calls for funds.
 *
 * A call for funds is the obligation, its invoice is the account, and Payment
 * rows on that invoice are the ledger. Every write here:
 *  - locks the invoice row first, so two people paying the same call at once are
 *    serialised and the second sees the first's money;
 *  - checks the amount against what is still owed, counting pending cheques, so a
 *    call can never be paid more than once over;
 *  - takes an idempotency key from the form, so a retried submission returns the
 *    row it already made instead of booking the money again;
 *  - never deletes: a payment is confirmed, failed, reversed or refunded, and the
 *    row keeps who did it, when and why.
 *
 * All arithmetic is in whole cents. The columns are Float, so the values are
 * converted once on the way in and once on the way out.
 */

export interface CollectionsContext extends DeveloperContext {
  /** Owner or admin. Required to reverse or refund a payment. */
  canModerate?: boolean
}

type Tx = Prisma.TransactionClient

const MAX_REFERENCE = 100
const MAX_NOTES = 500
const MAX_REASON = 500
/** A payment cannot have arrived tomorrow. A day of slack covers time zones. */
const FUTURE_SLACK_MS = 24 * 3600 * 1000

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface RecordPaymentInput {
  amount?: unknown
  paidAt?: unknown
  method?: unknown
  reference?: unknown
  notes?: unknown
  clientRequestId?: unknown
}

function readAmountCents(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ServiceError('Enter the amount received')
  const cents = toCents(value)
  if (cents <= 0) throw new ServiceError('The amount must be greater than zero')
  return cents
}

function readDate(value: unknown): Date {
  const date = typeof value === 'string' && value ? new Date(value) : value instanceof Date ? value : new Date()
  if (Number.isNaN(date.getTime())) throw new ServiceError('The payment date is not valid')
  if (date.getTime() > Date.now() + FUTURE_SLACK_MS) throw new ServiceError('The payment date cannot be in the future')
  return date
}

function readText(value: unknown, max: number): string | null {
  return typeof value === 'string' ? value.trim().slice(0, max) || null : null
}

function readMethod(value: unknown): PaymentMethod {
  const method = value ?? 'bank_transfer'
  if (!isValidPaymentMethod(method)) throw new ServiceError('Unknown payment method')
  return method
}

function readRequestKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(value)) {
    throw new ServiceError('A request key is required')
  }
  return value
}

function readReason(value: unknown): string {
  const reason = readText(value, MAX_REASON)
  if (!reason) throw new ServiceError('Give a reason')
  return reason
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002'
}

// ---------------------------------------------------------------------------
// Shared steps
// ---------------------------------------------------------------------------

/** Hold the invoice row until the transaction ends. Every payment write on it queues here. */
async function lockInvoice(tx: Tx, invoiceId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`
}

/**
 * REC-YYYY-NNNN from a per-workspace counter, in the caller's transaction. A
 * single upsert is atomic, so two receipts issued at once get two numbers, and
 * there is no unique-violation retry, which an interactive transaction cannot do.
 */
async function nextReceiptNumber(tx: Tx, workspaceId: string, at = new Date()): Promise<string> {
  const year = at.getFullYear()
  const rows = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "DocumentCounter" ("workspaceId", "kind", "year", "last")
    VALUES (${workspaceId}, 'receipt', ${year}, 1)
    ON CONFLICT ("workspaceId", "kind", "year") DO UPDATE SET "last" = "DocumentCounter"."last" + 1
    RETURNING "last"`
  return `REC-${year}-${String(rows[0].last).padStart(4, '0')}`
}

/** Cents already received or promised (pending cheques) on an invoice, refunds taken off. */
async function committedCents(tx: Tx, invoiceId: string): Promise<number> {
  const rows = await tx.payment.findMany({
    where: { invoiceId, status: { in: ['confirmed', 'pending'] } },
    select: { amount: true, kind: true },
  })
  return rows.reduce((sum, row) => sum + toCents(signedAmount(row)), 0)
}

function formatPlain(cents: number): string {
  return fromCents(cents).toFixed(2)
}

/** A payment of this workspace, with what the actions on it need. */
async function findPayment(ctx: DeveloperContext, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, invoice: { workspaceId: ctx.workspaceId } },
    select: {
      id: true,
      invoiceId: true,
      amount: true,
      kind: true,
      status: true,
      receiptNumber: true,
      paymentMethod: true,
      invoice: {
        select: {
          invoiceNumber: true,
          callForFunds: { select: { id: true, callNumber: true, lot: { select: { id: true, buyerLeadId: true } } } },
          depositForLot: { select: { id: true, buyerLeadId: true } },
          leadId: true,
        },
      },
    },
  })
  if (!payment) throw new ServiceError('Payment not found', 404)
  const call = payment.invoice.callForFunds
  // What the payment is for, for the history: a call, or a unit's deposit.
  const subject = {
    number: call?.callNumber ?? payment.invoice.invoiceNumber,
    lotId: call?.lot.id ?? payment.invoice.depositForLot?.id ?? null,
    leadId: call?.lot.buyerLeadId ?? payment.invoice.leadId ?? payment.invoice.depositForLot?.buyerLeadId ?? null,
  }
  return { ...payment, subject }
}

function log(
  ctx: DeveloperContext,
  type: CrmActivityType,
  payment: { id: string },
  description: string,
  leadId: string | null | undefined,
  metadata: Record<string, unknown>
) {
  if (!leadId) return Promise.resolve()
  return CrmLogger.logEntity({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    type,
    entityType: 'lead',
    entityId: leadId,
    leadId,
    description,
    metadata: { paymentId: payment.id, ...metadata },
  })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Record money received against a call for funds: in full or in part. A cheque is
 * kept pending, with no receipt, until someone marks it cleared.
 *
 * Returns `replayed: true` when the request key was seen before; the payment is
 * the one made the first time.
 */
export async function recordCallPayment(ctx: DeveloperContext, callId: string, input: RecordPaymentInput) {
  const parsed = parsePaymentInput(input)
  const replay = await findReplay(ctx, parsed.clientRequestId)
  if (replay) return { payment: replay, replayed: true }

  const call = await prisma.callForFunds.findFirst({
    where: { id: callId, workspaceId: ctx.workspaceId },
    select: {
      id: true,
      callNumber: true,
      status: true,
      invoiceId: true,
      lot: { select: { id: true, status: true, buyerLeadId: true } },
    },
  })
  if (!call) throw new ServiceError('Call for funds not found', 404)
  if (call.status === 'draft') throw new ServiceError('This call has not been issued yet', 409)
  if (!call.invoiceId) throw new ServiceError('This call has no invoice to record the payment on', 409)
  if (!call.lot.buyerLeadId) throw new ServiceError('This unit has no buyer', 409)
  return recordObligationPayment(ctx, {
    invoiceId: call.invoiceId,
    number: call.callNumber,
    leadId: call.lot.buyerLeadId,
    meta: { callId: call.id },
  }, parsed)
}

/**
 * Record money received against a unit's reservation deposit, through the same
 * ledger as the calls for funds: capped at what is still asked, cheques pending.
 */
export async function recordDepositPayment(ctx: DeveloperContext, lotId: string, input: RecordPaymentInput) {
  const parsed = parsePaymentInput(input)
  const replay = await findReplay(ctx, parsed.clientRequestId)
  if (replay) return { payment: replay, replayed: true }

  const lot = await prisma.developmentLot.findFirst({
    where: { id: lotId, workspaceId: ctx.workspaceId },
    select: { id: true, lotNumber: true, buyerLeadId: true, depositInvoiceId: true, depositInvoice: { select: { invoiceNumber: true } } },
  })
  if (!lot) throw new ServiceError('Unit not found', 404)
  if (!lot.buyerLeadId) throw new ServiceError('This unit has no buyer', 409)
  if (!lot.depositInvoiceId || !lot.depositInvoice) throw new ServiceError('No deposit is asked for this unit', 409)

  return recordObligationPayment(ctx, {
    invoiceId: lot.depositInvoiceId,
    number: lot.depositInvoice.invoiceNumber,
    leadId: lot.buyerLeadId,
    meta: { lotId: lot.id, deposit: true },
  }, parsed)
}

export interface ParsedPayment {
  amountCents: number
  paidAt: Date
  method: PaymentMethod
  reference: string | null
  notes: string | null
  clientRequestId: string
}

/** Check a payment's fields without recording it: used to refuse a bad deposit before a reservation is saved. */
export function parsePaymentInput(input: RecordPaymentInput): ParsedPayment {
  const amountCents = readAmountCents(input.amount)
  const paidAt = readDate(input.paidAt)
  const method = readMethod(input.method)
  const reference = readText(input.reference, MAX_REFERENCE)
  const notes = readText(input.notes, MAX_NOTES)
  const clientRequestId = readRequestKey(input.clientRequestId)
  if (METHOD_RULES[method].reference === 'required' && !reference) throw new ServiceError('Enter the cheque number')
  return { amountCents, paidAt, method, reference, notes, clientRequestId }
}

/**
 * The one write path for money received against an obligation (a call or a
 * deposit), both of which are an invoice: lock it, check the amount against what
 * is still owed (pending cheques included), write the row, reconcile.
 */
async function recordObligationPayment(
  ctx: DeveloperContext,
  obligation: { invoiceId: string; number: string; leadId: string | null; meta: Record<string, unknown> },
  { amountCents, paidAt, method, reference, notes, clientRequestId }: ParsedPayment
) {
  const { invoiceId } = obligation
  const pending = METHOD_RULES[method].startsPending

  try {
    const payment = await prisma.$transaction(async (tx) => {
      await lockInvoice(tx, invoiceId)
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { total: true, workspaceId: true } })
      if (!invoice || invoice.workspaceId !== ctx.workspaceId) throw new ServiceError('Not found', 404)

      const remaining = toCents(invoice.total) - (await committedCents(tx, invoiceId))
      if (remaining <= 0) throw new ServiceError('This is already settled', 409)
      if (amountCents > remaining) {
        throw new ServiceError(`The amount is more than what is still due (${formatPlain(remaining)})`, 409)
      }

      const now = new Date()
      const created = await tx.payment.create({
        data: {
          invoiceId,
          workspaceId: ctx.workspaceId,
          amount: fromCents(amountCents),
          paymentDate: paidAt,
          paymentMethod: method,
          referenceNumber: reference,
          notes,
          status: pending ? 'pending' : 'confirmed',
          confirmedAt: pending ? null : now,
          confirmedById: pending ? null : ctx.userId,
          receiptNumber: pending ? null : await nextReceiptNumber(tx, ctx.workspaceId, now),
          clientRequestId,
          createdById: ctx.userId,
        },
      })
      await recalculateInvoicePayment(tx, invoiceId)
      return created
    })

    await log(ctx, 'payment_recorded', payment, `${obligation.number}: ${formatPlain(amountCents)} (${method}${pending ? ', pending' : ''})`, obligation.leadId, {
      ...obligation.meta,
      amount: payment.amount,
      method,
      status: payment.status,
      receiptNumber: payment.receiptNumber,
    })
    return { payment, replayed: false }
  } catch (error) {
    // The same key won a race with this request: answer with its payment.
    if (isUniqueViolation(error)) {
      const winner = await findReplay(ctx, clientRequestId)
      if (winner) return { payment: winner, replayed: true }
    }
    throw error
  }
}

async function findReplay(ctx: DeveloperContext, clientRequestId: string) {
  const existing = await prisma.payment.findUnique({ where: { clientRequestId } })
  if (!existing) return null
  if (existing.workspaceId !== ctx.workspaceId) throw new ServiceError('This request key was already used', 409)
  return existing
}

/** A pending cheque has cleared: it now counts, and gets its receipt number. */
export async function confirmPayment(ctx: DeveloperContext, paymentId: string) {
  const found = await findPayment(ctx, paymentId)
  const payment = await prisma.$transaction(async (tx) => {
    await lockInvoice(tx, found.invoiceId)
    const current = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { status: true } })
    if (current.status !== 'pending') throw new ServiceError('Only a pending payment can be confirmed', 409)
    const now = new Date()
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'confirmed',
        confirmedAt: now,
        confirmedById: ctx.userId,
        receiptNumber: await nextReceiptNumber(tx, ctx.workspaceId, now),
      },
    })
    await recalculateInvoicePayment(tx, found.invoiceId)
    return updated
  })
  const call = found.subject
  await log(ctx, 'payment_confirmed', payment, `${call.number ?? ''}: ${payment.amount.toFixed(2)} confirmed`, call.leadId, {
    receiptNumber: payment.receiptNumber,
  })
  return payment
}

/** A pending cheque bounced or was withdrawn: it never counted, and now releases its amount. */
export async function failPayment(ctx: DeveloperContext, paymentId: string, input: { reason?: unknown }) {
  const reason = readReason(input.reason)
  const found = await findPayment(ctx, paymentId)
  const payment = await prisma.$transaction(async (tx) => {
    await lockInvoice(tx, found.invoiceId)
    const current = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { status: true } })
    if (current.status !== 'pending') throw new ServiceError('Only a pending payment can be marked failed', 409)
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'failed', reversedAt: new Date(), reversedById: ctx.userId, reversalReason: reason },
    })
    await recalculateInvoicePayment(tx, found.invoiceId)
    return updated
  })
  const call = found.subject
  await log(ctx, 'payment_failed', payment, `${call.number ?? ''}: ${payment.amount.toFixed(2)} failed: ${reason}`, call.leadId, { reason })
  return payment
}

function requireModerator(ctx: CollectionsContext) {
  if (!ctx.canModerate) throw new ServiceError('Only an owner or admin can reverse or refund a payment', 403)
}

/**
 * A confirmed payment was recorded in error. It stops counting and its receipt
 * shows it was cancelled; the row and its receipt number stay.
 */
export async function reversePayment(ctx: CollectionsContext, paymentId: string, input: { reason?: unknown }) {
  requireModerator(ctx)
  const reason = readReason(input.reason)
  const found = await findPayment(ctx, paymentId)
  const payment = await prisma.$transaction(async (tx) => {
    await lockInvoice(tx, found.invoiceId)
    const current = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { status: true } })
    if (current.status !== 'confirmed') throw new ServiceError('Only a confirmed payment can be reversed', 409)
    const refunds = await tx.payment.count({ where: { refundOfId: paymentId, status: 'confirmed' } })
    if (refunds > 0) throw new ServiceError('Reverse the refunds of this payment first', 409)
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'reversed', reversedAt: new Date(), reversedById: ctx.userId, reversalReason: reason },
    })
    await recalculateInvoicePayment(tx, found.invoiceId)
    return updated
  })
  const call = found.subject
  await log(ctx, 'payment_reversed', payment, `${payment.receiptNumber ?? call.number ?? ''}: ${payment.amount.toFixed(2)} reversed: ${reason}`, call.leadId, { reason })
  return payment
}

/**
 * Money given back to the buyer against a confirmed payment. It is its own row,
 * counted negatively, and can never exceed what that payment brought in.
 */
export async function refundPayment(
  ctx: CollectionsContext,
  paymentId: string,
  input: RecordPaymentInput & { reason?: unknown }
) {
  requireModerator(ctx)
  const reason = readReason(input.reason)
  const amountCents = readAmountCents(input.amount)
  const paidAt = readDate(input.paidAt)
  const method = readMethod(input.method)
  const reference = readText(input.reference, MAX_REFERENCE)
  const clientRequestId = readRequestKey(input.clientRequestId)

  const replay = await findReplay(ctx, clientRequestId)
  if (replay) return { payment: replay, replayed: true }

  const found = await findPayment(ctx, paymentId)
  if (found.kind !== 'payment') throw new ServiceError('A refund cannot itself be refunded', 409)

  try {
    const refund = await prisma.$transaction(async (tx) => {
      await lockInvoice(tx, found.invoiceId)
      const original = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { status: true, amount: true } })
      if (original.status !== 'confirmed') throw new ServiceError('Only a confirmed payment can be refunded', 409)
      const earlier = await tx.payment.findMany({
        where: { refundOfId: paymentId, status: 'confirmed' },
        select: { amount: true },
      })
      const refundable = toCents(original.amount) - earlier.reduce((sum, row) => sum + toCents(row.amount), 0)
      if (amountCents > refundable) {
        throw new ServiceError(`The refund is more than what this payment brought in (${formatPlain(refundable)})`, 409)
      }
      const now = new Date()
      const created = await tx.payment.create({
        data: {
          invoiceId: found.invoiceId,
          workspaceId: ctx.workspaceId,
          kind: 'refund',
          refundOfId: paymentId,
          amount: fromCents(amountCents),
          paymentDate: paidAt,
          paymentMethod: method,
          referenceNumber: reference,
          notes: reason,
          reversalReason: reason,
          status: 'confirmed',
          confirmedAt: now,
          confirmedById: ctx.userId,
          clientRequestId,
          createdById: ctx.userId,
        },
      })
      await recalculateInvoicePayment(tx, found.invoiceId)
      return created
    })
    const call = found.subject
    await log(ctx, 'payment_refunded', refund, `${found.receiptNumber ?? call.number ?? ''}: ${formatPlain(amountCents)} refunded: ${reason}`, call.leadId, { reason, refundOf: paymentId })
    return { payment: refund, replayed: false }
  } catch (error) {
    if (isUniqueViolation(error)) {
      const winner = await findReplay(ctx, clientRequestId)
      if (winner) return { payment: winner, replayed: true }
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const PAYMENT_ROW_SELECT = {
  id: true,
  amount: true,
  kind: true,
  status: true,
  paymentDate: true,
  paymentMethod: true,
  referenceNumber: true,
  notes: true,
  receiptNumber: true,
  refundOfId: true,
  reversalReason: true,
  reversedAt: true,
  confirmedAt: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
} as const

/**
 * Everything the encaissement panel shows for one sold unit: who bought it, what
 * it costs, its deposit and every call with what is left on each, every payment,
 * and the totals.
 */
export async function getLotLedger(ctx: DeveloperContext, lotId: string) {
  const lot = await prisma.developmentLot.findFirst({
    where: { id: lotId, workspaceId: ctx.workspaceId },
    select: {
      id: true,
      lotNumber: true,
      status: true,
      totalPrice: true,
      reservationFee: true,
      reservationFeePaidAt: true,
      program: { select: { id: true, name: true, reference: true } },
      building: { select: { name: true } },
      buyerLead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      salesDocuments: {
        where: { kind: 'contract', status: { not: 'void' } },
        select: { number: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      depositInvoice: {
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          amountPaid: true,
          payments: { select: PAYMENT_ROW_SELECT, orderBy: { paymentDate: 'desc' } },
        },
      },
      callsForFunds: {
        select: {
          id: true,
          callNumber: true,
          amount: true,
          percentage: true,
          status: true,
          dueAt: true,
          paidAt: true,
          issuedAt: true,
          invoiceId: true,
          milestone: { select: { title: true, order: true, targetPercentage: true } },
          invoice: {
            select: {
              amountPaid: true,
              payments: { select: PAYMENT_ROW_SELECT, orderBy: { paymentDate: 'desc' } },
            },
          },
        },
        orderBy: [{ milestone: { order: 'asc' } }, { createdAt: 'asc' }],
      },
    },
  })
  if (!lot) throw new ServiceError('Unit not found', 404)

  const now = Date.now()
  const workspace = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { currency: true } })

  const totals = { called: 0, collected: 0, pending: 0, outstanding: 0, overdue: 0 }
  const payments: (Prisma.PaymentGetPayload<{ select: typeof PAYMENT_ROW_SELECT }> & { callId: string; callNumber: string })[] = []
  const pendingOf = (rows: { status: string; amount: number }[]) =>
    rows.filter((p) => p.status === 'pending').reduce((sum, p) => sum + toCents(p.amount), 0)

  const calls: ScheduleRow[] = lot.callsForFunds.map((call) => {
    const amounts = callAmounts(call, now)
    const rows = call.invoice?.payments ?? []
    const pendingCents = pendingOf(rows)
    for (const p of rows) payments.push({ ...p, callId: call.id, callNumber: call.callNumber })

    totals.called += toCents(amounts.called)
    totals.collected += toCents(amounts.collected)
    totals.pending += pendingCents
    totals.outstanding += toCents(amounts.outstanding)
    totals.overdue += toCents(amounts.overdue)

    return {
      type: 'call',
      id: call.id,
      callNumber: call.callNumber,
      title: call.milestone.title,
      percentage: call.percentage,
      amount: call.amount,
      dueAt: call.dueAt,
      paidAt: call.paidAt,
      status: effectiveCallStatus(call, now),
      daysLate: daysLate(call, now),
      collected: amounts.collected,
      pending: fromCents(pendingCents),
      // What a new payment may still be for: outstanding less pending cheques.
      payable: call.status === 'draft' || !call.invoiceId
        ? 0
        : Math.max(0, fromCents(toCents(amounts.outstanding) - pendingCents)),
      hasInvoice: Boolean(call.invoiceId),
    }
  })

  // The deposit is an obligation like a call, with no due date: asked at reservation.
  const dep = lot.depositInvoice
  let depositRow: ScheduleRow | null = null
  let depositAskedCents = 0
  let depositReceivedCents = 0
  if (dep) {
    const pendingCents = pendingOf(dep.payments)
    depositAskedCents = toCents(dep.total)
    depositReceivedCents = Math.min(depositAskedCents, Math.max(0, toCents(dep.amountPaid)))
    const outstanding = depositAskedCents - depositReceivedCents
    for (const p of dep.payments) payments.push({ ...p, callId: dep.id, callNumber: dep.invoiceNumber })
    totals.pending += pendingCents
    depositRow = {
      type: 'deposit',
      id: dep.id,
      callNumber: dep.invoiceNumber,
      title: '',
      percentage: null,
      amount: dep.total,
      dueAt: null,
      paidAt: lot.reservationFeePaidAt,
      status: outstanding <= 0 ? 'paid' : depositReceivedCents > 0 ? 'partially_paid' : 'issued',
      daysLate: 0,
      collected: fromCents(depositReceivedCents),
      pending: fromCents(pendingCents),
      payable: Math.max(0, fromCents(outstanding - pendingCents)),
      hasInvoice: true,
    }
  }
  const schedule = depositRow ? [depositRow, ...calls] : calls

  payments.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime() || b.createdAt.getTime() - a.createdAt.getTime())

  const priceCents = toCents(lot.totalPrice ?? 0)
  // Overdue calls first, then the deposit, then the next call due.
  const next = calls.find((c) => c.payable > 0 && c.status === 'overdue')
    ?? (depositRow && depositRow.payable > 0 ? depositRow : null)
    ?? calls.find((c) => c.payable > 0)
    ?? null

  return {
    currency: workspace?.currency ?? null,
    lot: {
      id: lot.id,
      lotNumber: lot.lotNumber,
      status: lot.status,
      building: lot.building?.name ?? null,
      program: lot.program,
      contractNumber: lot.salesDocuments[0]?.number ?? null,
    },
    buyer: lot.buyerLead,
    deposit: { asked: fromCents(depositAskedCents), received: fromCents(depositReceivedCents), paidAt: lot.reservationFeePaidAt },
    totals: {
      contract: lot.totalPrice ?? 0,
      depositAsked: fromCents(depositAskedCents),
      deposit: fromCents(depositReceivedCents),
      called: fromCents(totals.called),
      collected: fromCents(totals.collected),
      pending: fromCents(totals.pending),
      outstanding: fromCents(totals.outstanding),
      overdue: fromCents(totals.overdue),
      /** Price not yet received at all: neither as deposit nor against a call. */
      remainingOnContract: fromCents(Math.max(0, priceCents - depositReceivedCents - totals.collected)),
    },
    nextCallId: next?.id ?? null,
    calls: schedule,
    payments,
  }
}

/** One line of a unit's schedule: its deposit, or one call for funds. */
interface ScheduleRow {
  type: 'deposit' | 'call'
  id: string
  callNumber: string
  title: string
  percentage: number | null
  amount: number
  dueAt: Date | null
  paidAt: Date | null
  status: string
  daysLate: number
  collected: number
  pending: number
  payable: number
  hasInvoice: boolean
}

export type LotLedger = Awaited<ReturnType<typeof getLotLedger>>

/** At most this many matches; past that, the user narrows it by typing. */
const SEARCH_LIMIT = 20

/**
 * Sold units to collect from, found by the buyer's name, email or phone, the unit
 * number or the programme. Only units with a buyer: there is nothing to collect
 * on the others.
 */
export async function searchCollectionTargets(ctx: DeveloperContext, query: string) {
  const q = query.trim().slice(0, 60)
  const words = q.split(/\s+/).filter(Boolean).slice(0, 4)
  const lots = await prisma.developmentLot.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      buyerLeadId: { not: null },
      ...(words.length > 0 && {
        AND: words.map((word) => ({
          OR: [
            { lotNumber: { contains: word, mode: 'insensitive' as const } },
            { program: { name: { contains: word, mode: 'insensitive' as const } } },
            { program: { reference: { contains: word, mode: 'insensitive' as const } } },
            { buyerLead: { firstName: { contains: word, mode: 'insensitive' as const } } },
            { buyerLead: { lastName: { contains: word, mode: 'insensitive' as const } } },
            { buyerLead: { email: { contains: word, mode: 'insensitive' as const } } },
            { buyerLead: { phone: { contains: word } } },
          ],
        })),
      }),
    },
    select: {
      id: true,
      lotNumber: true,
      status: true,
      program: { select: { id: true, name: true } },
      buyerLead: { select: { id: true, firstName: true, lastName: true } },
      depositInvoice: { select: { total: true, amountPaid: true } },
      callsForFunds: { select: { amount: true, status: true, dueAt: true, invoice: { select: { amountPaid: true } } } },
    },
    orderBy: [{ program: { name: 'asc' } }, { lotNumber: 'asc' }],
    take: SEARCH_LIMIT,
  })
  const now = Date.now()
  return lots.map(({ callsForFunds, depositInvoice, ...lot }) => {
    let outstanding = depositInvoice ? Math.max(0, toCents(depositInvoice.total) - toCents(depositInvoice.amountPaid)) : 0
    let overdue = 0
    for (const call of callsForFunds) {
      const a = callAmounts(call, now)
      outstanding += toCents(a.outstanding)
      overdue += toCents(a.overdue)
    }
    return { ...lot, outstanding: fromCents(outstanding), overdue: fromCents(overdue) }
  })
}

export interface JournalFilters {
  from?: string | null
  to?: string | null
  method?: string | null
  status?: string | null
  programId?: string | null
  recordedBy?: string | null
  q?: string | null
}

const JOURNAL_LIMIT = 500

const JOURNAL_LOT_SELECT = {
  id: true,
  lotNumber: true,
  program: { select: { id: true, name: true } },
  buyerLead: { select: { firstName: true, lastName: true } },
} as const

/**
 * Payments on calls for funds and on deposits, newest first, with totals that
 * count confirmed money only: pending cheques are shown apart, failed and
 * reversed rows count for nothing, refunds count negatively.
 */
export async function listCallPayments(ctx: DeveloperContext, filters: JournalFilters = {}) {
  const where: Prisma.PaymentWhereInput = {
    invoice: {
      workspaceId: ctx.workspaceId,
      OR: [{ callForFunds: { isNot: null } }, { depositForLotId: { not: null } }],
    },
  }
  const range: Prisma.DateTimeFilter = {}
  if (filters.from) {
    const from = new Date(filters.from)
    if (!Number.isNaN(from.getTime())) range.gte = from
  }
  if (filters.to) {
    const to = new Date(filters.to)
    if (!Number.isNaN(to.getTime())) {
      // A date-only `to` means the whole of that day.
      if (/^\d{4}-\d{2}-\d{2}$/.test(filters.to)) to.setUTCDate(to.getUTCDate() + 1)
      range.lt = to
    }
  }
  if (range.gte || range.lt) where.paymentDate = range
  if (filters.method && isValidPaymentMethod(filters.method)) where.paymentMethod = filters.method
  if (filters.status === 'refund') where.kind = 'refund'
  else if (filters.status) where.status = filters.status
  if (filters.recordedBy) where.createdById = filters.recordedBy
  if (filters.programId) {
    where.invoice = {
      workspaceId: ctx.workspaceId,
      OR: [
        { callForFunds: { is: { lot: { programId: filters.programId } } } },
        { depositForLot: { is: { programId: filters.programId } } },
      ],
    }
  }
  const q = filters.q?.trim().slice(0, 60)
  if (q) {
    const text = { contains: q, mode: 'insensitive' as const }
    const lotMatches: Prisma.DevelopmentLotWhereInput[] = [
      { lotNumber: text },
      { buyerLead: { lastName: text } },
      { buyerLead: { firstName: text } },
    ]
    where.OR = [
      { receiptNumber: text },
      { referenceNumber: text },
      { invoice: { invoiceNumber: text } },
      { invoice: { callForFunds: { is: { callNumber: text } } } },
      ...lotMatches.map((lot) => ({ invoice: { callForFunds: { is: { lot } } } })),
      ...lotMatches.map((lot) => ({ invoice: { depositForLot: { is: lot } } })),
    ]
  }

  const rows = await prisma.payment.findMany({
    where,
    select: {
      ...PAYMENT_ROW_SELECT,
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          callForFunds: { select: { id: true, callNumber: true, lot: { select: JOURNAL_LOT_SELECT } } },
          depositForLot: { select: JOURNAL_LOT_SELECT },
        },
      },
    },
    orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    take: JOURNAL_LIMIT,
  })

  const byMethod: Record<string, number> = {}
  let confirmed = 0
  let pending = 0
  for (const row of rows) {
    if (row.status === 'pending') pending += toCents(row.amount)
    if (row.status !== 'confirmed') continue
    const cents = toCents(signedAmount(row))
    confirmed += cents
    byMethod[row.paymentMethod] = (byMethod[row.paymentMethod] ?? 0) + cents
  }

  return {
    payments: rows.map(({ invoice, ...row }) => ({
      ...row,
      // What the money was for: a call, or the unit's deposit.
      call: invoice.callForFunds
        ? { ...invoice.callForFunds, type: 'call' as const }
        : invoice.depositForLot
          ? { id: invoice.id, callNumber: invoice.invoiceNumber, lot: invoice.depositForLot, type: 'deposit' as const }
          : null,
    })),
    truncated: rows.length === JOURNAL_LIMIT,
    totals: {
      confirmed: fromCents(confirmed),
      pending: fromCents(pending),
      byMethod: Object.fromEntries(Object.entries(byMethod).map(([k, v]) => [k, fromCents(v)])),
    },
  }
}

const RECEIPT_LOT_SELECT = {
  id: true,
  lotNumber: true,
  totalPrice: true,
  program: { select: { name: true, reference: true } },
  buyerLead: { select: { firstName: true, lastName: true, email: true, phone: true } },
  salesDocuments: {
    where: { kind: 'contract', status: { not: 'void' } },
    select: { number: true },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
} as const

/** What a receipt prints. Only confirmed payments have one. */
export async function getReceiptData(ctx: DeveloperContext, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, invoice: { workspaceId: ctx.workspaceId } },
    select: {
      ...PAYMENT_ROW_SELECT,
      invoiceId: true,
      invoice: {
        select: {
          invoiceNumber: true,
          total: true,
          amountPaid: true,
          amountDue: true,
          currency: true,
          callForFunds: {
            select: { callNumber: true, milestone: { select: { title: true } }, lot: { select: RECEIPT_LOT_SELECT } },
          },
          depositForLot: { select: RECEIPT_LOT_SELECT },
        },
      },
    },
  })
  if (!payment) throw new ServiceError('Payment not found', 404)
  if (payment.kind !== 'payment' || !payment.receiptNumber) {
    throw new ServiceError(
      payment.status === 'pending' ? 'No receipt until the payment is confirmed' : 'This payment has no receipt',
      409
    )
  }
  const { callForFunds, depositForLot } = payment.invoice
  // A deposit prints like a call: its invoice number, and "deposit" for the milestone.
  const call = callForFunds
    ? { ...callForFunds, isDeposit: false }
    : depositForLot
      ? { callNumber: payment.invoice.invoiceNumber, milestone: { title: '' }, lot: depositForLot, isDeposit: true }
      : null
  if (!call) throw new ServiceError('This payment is not for a call for funds or a deposit', 409)

  const workspace = await prisma.workspace.findUnique({
    where: { id: ctx.workspaceId },
    select: { name: true, currency: true },
  })
  const ledger = await getLotLedger(ctx, call.lot.id)

  return {
    workspace: { name: workspace?.name ?? '', currency: workspace?.currency ?? payment.invoice.currency },
    payment,
    call,
    remainingOnCall: payment.invoice.amountDue,
    remainingOnContract: ledger.totals.remainingOnContract,
  }
}

// ---------------------------------------------------------------------------
// Deposits
// ---------------------------------------------------------------------------

/**
 * Make the unit's deposit invoice match the deposit asked, in the caller's
 * transaction: create it on the first deposit, change its total on an edit,
 * cancel it when the deposit is removed. The amount can never go below what has
 * already been received or is waiting to clear.
 *
 * Returns the deposit invoice id, or null when no deposit is asked.
 */
export async function ensureDepositInvoice(tx: Tx, ctx: DeveloperContext, lotId: string, fee: number | null): Promise<string | null> {
  const lot = await tx.developmentLot.findFirst({
    where: { id: lotId, workspaceId: ctx.workspaceId },
    select: {
      id: true,
      lotNumber: true,
      depositInvoiceId: true,
      program: { select: { reference: true, name: true } },
      buyerLead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
    },
  })
  if (!lot) throw new ServiceError('Unit not found', 404)
  const feeCents = fee !== null && fee > 0 ? toCents(fee) : 0
  const amount = fromCents(feeCents)

  if (lot.depositInvoiceId) {
    const invoiceId = lot.depositInvoiceId
    await lockInvoice(tx, invoiceId)
    const committed = await committedCents(tx, invoiceId)
    if (feeCents < committed) {
      throw new ServiceError(`The deposit cannot be less than what was already received (${formatPlain(committed)})`, 409)
    }
    if (feeCents === 0) {
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: 'cancelled' } })
      await tx.developmentLot.update({
        where: { id: lot.id },
        data: { depositInvoiceId: null, reservationFee: null, reservationFeePaidAt: null },
      })
      return null
    }
    const current = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { status: true } })
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { subtotal: amount, total: amount, ...(current.status === 'cancelled' && { status: 'sent' }) },
    })
    await tx.invoiceItem.updateMany({ where: { invoiceId }, data: { unitPrice: amount, total: amount } })
    await tx.developmentLot.update({ where: { id: lot.id }, data: { reservationFee: amount } })
    await recalculateInvoicePayment(tx, invoiceId)
    return invoiceId
  }

  if (feeCents === 0) {
    await tx.developmentLot.update({ where: { id: lot.id }, data: { reservationFee: null, reservationFeePaidAt: null } })
    return null
  }
  const buyer = lot.buyerLead
  if (!buyer) throw new ServiceError('Choose the buyer before asking for a deposit', 409)

  // DEP-{programme}-{unit}; a unit sold again after a cancellation gets -2, -3…
  const base = `DEP-${lot.program.reference}-${lot.lotNumber}`
  const taken = await tx.invoice.count({ where: { workspaceId: ctx.workspaceId, invoiceNumber: { startsWith: base } } })
  const invoiceNumber = taken === 0 ? base : `${base}-${taken + 1}`
  const workspace = await tx.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { currency: true } })

  const invoice = await tx.invoice.create({
    data: {
      workspaceId: ctx.workspaceId,
      invoiceNumber,
      leadId: buyer.id,
      depositForLotId: lot.id,
      clientName: `${buyer.firstName || ''} ${buyer.lastName || ''}`.trim() || 'Acquéreur',
      clientEmail: buyer.email || null,
      clientPhone: buyer.phone || null,
      status: 'sent',
      currency: workspace?.currency || DEFAULT_CURRENCY,
      subtotal: amount,
      total: amount,
      amountDue: amount,
      createdById: ctx.userId,
      notes: `Dépôt de garantie pour le lot ${lot.lotNumber} (${lot.program.name}).`,
      items: { create: [{ description: `Dépôt de garantie - Lot ${lot.lotNumber}`, quantity: 1, unitPrice: amount, total: amount }] },
    },
  })
  await tx.developmentLot.update({
    where: { id: lot.id },
    data: { depositInvoiceId: invoice.id, reservationFee: amount, reservationFeePaidAt: null },
  })
  return invoice.id
}

/**
 * Give back part or all of a deposit, in the caller's transaction (a sale being
 * cancelled). It is a refund row against the deposit invoice, capped at what was
 * actually received. Owners and admins only, like every refund.
 */
export async function refundDepositInTx(
  tx: Tx,
  ctx: CollectionsContext,
  depositInvoiceId: string,
  amount: number,
  reason: string | null
) {
  requireModerator(ctx)
  const amountCents = toCents(amount)
  if (amountCents <= 0) return null
  await lockInvoice(tx, depositInvoiceId)
  const rows = await tx.payment.findMany({
    where: { invoiceId: depositInvoiceId, status: 'confirmed' },
    select: { id: true, amount: true, kind: true },
    orderBy: { paymentDate: 'desc' },
  })
  const received = rows.reduce((sum, row) => sum + toCents(signedAmount(row)), 0)
  if (amountCents > received) {
    throw new ServiceError(`The refund is more than the deposit received (${formatPlain(received)})`, 409)
  }
  const now = new Date()
  const refund = await tx.payment.create({
    data: {
      invoiceId: depositInvoiceId,
      workspaceId: ctx.workspaceId,
      kind: 'refund',
      refundOfId: rows.find((row) => row.kind === 'payment')?.id ?? null,
      amount: fromCents(amountCents),
      paymentDate: now,
      paymentMethod: 'bank_transfer',
      notes: reason,
      reversalReason: reason,
      status: 'confirmed',
      confirmedAt: now,
      confirmedById: ctx.userId,
      createdById: ctx.userId,
    },
  })
  await recalculateInvoicePayment(tx, depositInvoiceId)
  return refund
}
