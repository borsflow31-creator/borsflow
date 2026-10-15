import { fromCents, toCents } from '@/lib/documents/payment-rules'

/**
 * What a call for funds means in money, in one place. Paid, called and overdue
 * used to be worked out separately on the dashboard, the reports, the programme
 * page, the customer tab, the inventory and the buyer portal, each counting a
 * call as either fully paid or not at all. Partial payments made that wrong.
 *
 * The amount received is the call's invoice `amountPaid`, which is derived from
 * confirmed payments only, so pending cheques and reversed payments never count.
 * A legacy call with no invoice falls back to its status.
 *
 * Pure: no database, so it is checked by a verify script without one.
 */

const DAY_MS = 86_400_000

export interface CallMoneyInput {
  amount: number
  status: string
  dueAt: Date | string | null
  invoice?: { amountPaid: number } | null
}

export interface CallAmounts {
  /** The amount asked of the buyer; zero for a draft that was never sent. */
  called: number
  /** Confirmed money received against it, never more than the call. */
  collected: number
  /** Called minus collected. */
  outstanding: number
  /** The outstanding part, when the call is past due. */
  overdue: number
}

/**
 * A call is overdue when money is still owed past its due date, whether or not
 * the hourly job has flipped its stored status yet.
 */
export function effectiveCallStatus(call: Pick<CallMoneyInput, 'status' | 'dueAt'>, now = Date.now()): string {
  if (call.status === 'paid' || call.status === 'draft' || call.status === 'overdue') return call.status
  if (call.dueAt && new Date(call.dueAt).getTime() < now) return 'overdue'
  return call.status
}

export function callAmounts(call: CallMoneyInput, now = Date.now()): CallAmounts {
  if (call.status === 'draft') return { called: 0, collected: 0, outstanding: 0, overdue: 0 }
  const calledCents = toCents(call.amount)
  const paidCents = call.invoice
    ? toCents(call.invoice.amountPaid)
    : call.status === 'paid' ? calledCents : 0
  const collectedCents = Math.min(calledCents, Math.max(0, paidCents))
  const outstandingCents = calledCents - collectedCents
  const overdueCents = outstandingCents > 0 && effectiveCallStatus(call, now) === 'overdue' ? outstandingCents : 0
  return {
    called: fromCents(calledCents),
    collected: fromCents(collectedCents),
    outstanding: fromCents(outstandingCents),
    overdue: fromCents(overdueCents),
  }
}

/** The totals of several calls, summed in cents. */
export function sumCallAmounts(calls: CallMoneyInput[], now = Date.now()): CallAmounts {
  const cents = { called: 0, collected: 0, outstanding: 0, overdue: 0 }
  for (const call of calls) {
    const a = callAmounts(call, now)
    cents.called += toCents(a.called)
    cents.collected += toCents(a.collected)
    cents.outstanding += toCents(a.outstanding)
    cents.overdue += toCents(a.overdue)
  }
  return {
    called: fromCents(cents.called),
    collected: fromCents(cents.collected),
    outstanding: fromCents(cents.outstanding),
    overdue: fromCents(cents.overdue),
  }
}

/** Whole days a call is late; zero when it is not overdue. */
export function daysLate(call: Pick<CallMoneyInput, 'status' | 'dueAt'>, now = Date.now()): number {
  if (effectiveCallStatus(call, now) !== 'overdue' || !call.dueAt) return 0
  return Math.max(0, Math.floor((now - new Date(call.dueAt).getTime()) / DAY_MS))
}

/** The invoice fields `callAmounts` needs, for a Prisma `select`. */
export const CALL_INVOICE_MONEY_SELECT = { select: { amountPaid: true } } as const
