import { prisma } from '@/lib/prisma'
import { isValidPaymentMethod, recalculateInvoicePayment } from '@/lib/documents/payments'
import { ServiceError } from '../errors'
import { DeveloperContext } from './programs'

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
 */
export async function generateCallsForFundsForMilestone(
  ctx: DeveloperContext,
  milestoneId: string
): Promise<GenerateCallsResult> {
  const milestone = await prisma.constructionMilestone.findUnique({
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
  const previousMilestones = await prisma.constructionMilestone.findMany({
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

  const eligibleLots = await prisma.developmentLot.findMany({
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
    const invoice = await prisma.invoice.create({
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
        currency: 'EUR',
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

    const call = await prisma.callForFunds.create({
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
 * Record that a call for funds has been paid.
 *
 * The payment is written as a Payment row on the call's invoice and the invoice
 * is reconciled from its rows, like every other payment in the product. It used to
 * set the invoice's fields directly, which left no record of how or when the money
 * arrived, and made the invoice's figures a second, hand-kept copy of the truth.
 *
 * Idempotent: a call already paid is returned as it is, so a double click or a
 * retried request cannot book the same money twice.
 */
export async function markCallForFundsPaid(ctx: DeveloperContext, callId: string, input: PaymentInput = {}) {
  const call = await prisma.callForFunds.findFirst({
    where: { id: callId, workspaceId: ctx.workspaceId },
    select: { id: true, callNumber: true, amount: true, status: true, invoiceId: true },
  })
  if (!call) throw new ServiceError('Call for funds not found', 404)
  if (call.status === 'paid') return prisma.callForFunds.findUniqueOrThrow({ where: { id: callId } })

  const method = input.method ?? 'bank_transfer'
  if (!isValidPaymentMethod(method)) throw new ServiceError('Unknown payment method')

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date()
  if (Number.isNaN(paidAt.getTime())) throw new ServiceError('The payment date is not valid')
  // A payment cannot have arrived tomorrow. A day of slack covers time zones.
  if (paidAt.getTime() > Date.now() + 24 * 3600 * 1000) throw new ServiceError('The payment date cannot be in the future')

  const reference = typeof input.reference === 'string' ? input.reference.trim().slice(0, 100) || null : null

  return prisma.$transaction(async (tx) => {
    const updated = await tx.callForFunds.update({
      where: { id: callId },
      data: { status: 'paid', paidAt },
    })

    if (call.invoiceId) {
      await tx.payment.create({
        data: {
          invoiceId: call.invoiceId,
          amount: call.amount,
          paymentDate: paidAt,
          paymentMethod: method,
          referenceNumber: reference,
          notes: `Call for funds ${call.callNumber}`,
          createdById: ctx.userId,
        },
      })
      await recalculateInvoicePayment(tx, call.invoiceId)
    }
    return updated
  })
}
