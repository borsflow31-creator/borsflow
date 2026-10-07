/**
 * Where a sale is in its life, derived from facts that already exist rather than
 * stored as a status of its own.
 *
 *   reserved          the unit is held for a buyer
 *   contract pending  the reservation has been accepted, or a contract is out, but
 *                     the contract is not yet signed
 *   contract signed   under contract; no money has been called yet
 *   payment plan      calls for funds are running
 *   completed         everything has been paid, or the keys are handed over
 *
 * A second status column would be one more thing to drift out of step with the unit
 * status, the documents and the calls it summarises. Computing it from them cannot.
 */

export type SaleStage = 'reserved' | 'contract_pending' | 'contract_signed' | 'plan_active' | 'completed'

export const SALE_STAGES: readonly SaleStage[] = [
  'reserved',
  'contract_pending',
  'contract_signed',
  'plan_active',
  'completed',
]

export interface SaleStageInput {
  /** DevelopmentLot.status */
  status: string
  documents: readonly { kind: string; status: string }[]
  calls: readonly { status: string }[]
}

/** Null when there is no sale: an available or optioned unit has none. */
export function saleStage({ status, documents, calls }: SaleStageInput): SaleStage | null {
  if (status === 'delivered') return 'completed'

  const issued = calls.filter((c) => c.status !== 'draft')

  if (status === 'contract_signed' || status === 'deed_signed') {
    if (issued.length > 0 && issued.every((c) => c.status === 'paid')) return 'completed'
    if (issued.length > 0) return 'plan_active'
    return 'contract_signed'
  }

  if (status === 'reserved') {
    const reservationAccepted = documents.some((d) => d.kind === 'reservation' && d.status === 'accepted')
    const contractOut = documents.some((d) => d.kind === 'contract' && (d.status === 'sent' || d.status === 'draft'))
    return reservationAccepted || contractOut ? 'contract_pending' : 'reserved'
  }

  return null
}
