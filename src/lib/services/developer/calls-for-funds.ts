import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fromCents, isValidPaymentMethod, toCents } from '@/lib/documents/payments'
import { recordCallPayment } from './collections'
import { ServiceError } from '../errors'
import { DeveloperContext } from './programs'
import { DEFAULT_CURRENCY } from '@/lib/currencies'

/** The app's client or an interactive-transaction client. */
type Db = Prisma.TransactionClient | typeof prisma

/** The legal window a buyer has to pay a call for funds. */
const PAYMENT_WINDOW_MS = 30 * 24 * 3600 * 1000

export interface GenerateCallsResult {
  generatedCount: number
  totalAmount: number
  calls: any[]
}

/**
 * Idempotently generates legally compliant Calls for Funds (Appels de Fonds)
 * and linked Invoices for all active buyers upon milestone certification.
 *
 * Every read and write goes through `db`, so the caller can run it in one
 * transaction with the certification: either the milestone is certified and
 * every buyer has a call and an invoice, or nothing changed at all. A call that
 * already exists for the lot and milestone is skipped; one created concurrently
 * trips the (lotId, milestoneId) unique key and rolls the whole batch back.
 */
export async function generateCallsForFundsForMilestone(
  ctx: DeveloperContext,
  milestoneId: string,
  db: Db = prisma
): Promise<GenerateCallsResult> {
  const milestone = await db.constructionMilestone.findUnique({
    where: { id: milestoneId },
    include: {
      program: true,
      building: true,
    },
  })

  if (!milestone) {
    throw new ServiceError('Construction milestone not found', 404)
  }

  // Find all previous certified milestones for this program/building to compute net tranche percentage
  const previousMilestones = await db.constructionMilestone.findMany({
    where: {
      programId: milestone.programId,
      order: { lt: milestone.order },
      buildingId: milestone.buildingId,
    },
    orderBy: { order: 'desc' },
  })

  const previousTotalPercent = previousMilestones.length > 0 ? previousMilestones[0].targetPercentage : 0
  const tranchePercentage = Math.max(0, milestone.targetPercentage - previousTotalPercent)

  if (tranchePercentage <= 0) {
    throw new ServiceError(`Tranche percentage must be positive (milestone is ${milestone.targetPercentage}%, previous was ${previousTotalPercent}%)`, 400)
  }

  // Query eligible lots: Lots in this program (and building if milestone is building-specific)
  // that have an assigned buyer and are at least reserved
  const lotWhere: any = {
    programId: milestone.programId,
    status: { in: ['reserved', 'contract_signed', 'deed_signed', 'delivered'] },
    buyerLeadId: { not: null },
  }
  if (milestone.buildingId) {
    lotWhere.buildingId = milestone.buildingId
  }

  const eligibleLots = await db.developmentLot.findMany({
    where: lotWhere,
    include: {
      buyerLead: true,
      callsForFunds: {
        where: { milestoneId },
      },
    },
  })

  let generatedCount = 0
  let totalAmount = 0
  const createdCalls: any[] = []

  // One due date for the whole batch: every buyer called by this milestone is
  // called on the same day, and the invoice and the call must agree on it.
  const dueAt = new Date(Date.now() + PAYMENT_WINDOW_MS)

  // Calls are billed in the developer's own currency (DZD, MAD, EUR...), the same
  // one every other money figure on the workspace uses.
  const workspace = await db.workspace.findUnique({
    where: { id: ctx.workspaceId },
    select: { currency: true },
  })
  const currency = workspace?.currency || DEFAULT_CURRENCY

  for (const lot of eligibleLots) {
    // Idempotency: skip if already generated for this lot and milestone
    if (lot.callsForFunds.length > 0) {
      continue
    }

    const buyer = lot.buyerLead
    if (!buyer) continue

    const callAmount = Number(((lot.totalPrice * tranchePercentage) / 100).toFixed(2))
    const callNumber = `AF-${milestone.program.reference}-${lot.lotNumber}-M${milestone.order}`

    // Create an Invoice within BorsFlow for unified accounting, public tokens, and PDF generation
    const invoiceNumber = `INV-${callNumber}`
    const invoice = await db.invoice.create({
      data: {
        workspaceId: ctx.workspaceId,
        invoiceNumber,
        leadId: buyer.id,
        clientName: `${buyer.firstName || ''} ${buyer.lastName || ''}`.trim() || 'Acquéreur',
        clientEmail: buyer.email || null,
        clientPhone: buyer.phone || null,
        status: 'sent',
        // Without a due date the invoice can never become overdue, so neither the
        // overdue sweep nor any total built on it would ever see a late payment.
        dueDate: dueAt,
        currency,
        subtotal: callAmount,
        total: callAmount,
        amountDue: callAmount,
        notes: `Appel de fonds pour le lot ${lot.lotNumber} (${milestone.program.name}) - Jalon : ${milestone.title} (${tranchePercentage}% appelés sur un cumul de ${milestone.targetPercentage}%).`,
        items: {
          create: [
            {
              description: `${milestone.title} (${tranchePercentage}%) - Lot ${lot.lotNumber}`,
              quantity: 1,
              unitPrice: callAmount,
              total: callAmount,
            },
          ],
        },
      },
    })

    const call = await db.callForFunds.create({
      data: {
        workspaceId: ctx.workspaceId,
        lotId: lot.id,
        milestoneId: milestone.id,
        invoiceId: invoice.id,
        callNumber,
        percentage: tranchePercentage,
        amount: callAmount,
        status: 'issued',
        issuedAt: new Date(),
        dueAt,
      },
      include: {
        lot: true,
        milestone: true,
        invoice: true,
      },
    })

    generatedCount++
    totalAmount += callAmount
    createdCalls.push(call)
  }

  return {
    generatedCount,
    totalAmount,
    calls: createdCalls,
  }
}

export async function listCallsForFunds(
  ctx: DeveloperContext,
  options: { programId?: string; lotId?: string; status?: string } = {}
) {
  const where: any = { workspaceId: ctx.workspaceId }
  if (options.status) where.status = options.status
  if (options.lotId) where.lotId = options.lotId
  if (options.programId) {
    where.lot = { programId: options.programId }
  }

  return prisma.callForFunds.findMany({
    where,
    include: {
      lot: {
        select: {
          id: true,
          lotNumber: true,
          totalPrice: true,
          buyerLead: { select: { id: true, firstName: true, lastName: true, email: true } },
          program: { select: { id: true, name: true, reference: true } },
        },
      },
      milestone: {
        select: { id: true, stageKey: true, title: true, targetPercentage: true },
      },
      reminders: { select: { step: true, sentAt: true }, orderBy: { sentAt: 'asc' as const } },
      invoice: {
        select: { id: true, invoiceNumber: true, status: true, amountPaid: true, total: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export interface PaymentInput {
  paidAt?: string | Date | null
  method?: string | null
  reference?: string | null
}

/**
 * Record that a call for funds has been paid in full: the rest of what it is owed,
 * through the same ledger as every other payment (see collections.ts), so it is
 * locked, capped at what is due and numbered like any other.
 *
 * Idempotent: a call already paid is returned as it is, and the request key is
 * derived from what had been received, so a double click or a retried request
 * cannot book the same money twice.
 */
export async function markCallForFundsPaid(ctx: DeveloperContext, callId: string, input: PaymentInput = {}) {
  const call = await prisma.callForFunds.findFirst({
    where: { id: callId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true, invoiceId: true, invoice: { select: { total: true, amountPaid: true } } },
  })
  if (!call) throw new ServiceError('Call for funds not found', 404)
  if (call.status === 'paid') return prisma.callForFunds.findUniqueOrThrow({ where: { id: callId } })

  // A call from before invoices were generated has nowhere to hold a payment row.
  if (!call.invoiceId || !call.invoice) {
    if (input.method != null && !isValidPaymentMethod(input.method)) throw new ServiceError('Unknown payment method')
    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date()
    if (Number.isNaN(paidAt.getTime())) throw new ServiceError('The payment date is not valid')
    return prisma.callForFunds.update({ where: { id: callId }, data: { status: 'paid', paidAt } })
  }

  const pending = await prisma.payment.aggregate({
    where: { invoiceId: call.invoiceId, status: 'pending' },
    _sum: { amount: true },
  })
  const remaining = toCents(call.invoice.total) - toCents(call.invoice.amountPaid) - toCents(pending._sum.amount ?? 0)
  if (remaining > 0) {
    await recordCallPayment(ctx, callId, {
      amount: fromCents(remaining),
      paidAt: input.paidAt,
      method: input.method,
      reference: input.reference,
      clientRequestId: `mark-paid-${callId}-${toCents(call.invoice.amountPaid)}`,
    })
  }
  return prisma.callForFunds.findUniqueOrThrow({ where: { id: callId } })
}
