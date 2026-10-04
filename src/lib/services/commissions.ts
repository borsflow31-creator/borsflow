import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isWorkspaceMember } from '@/lib/crm/access'
import { ServiceError } from './errors'

/**
 * Commission: what the agency earns on a sale, and who gets what.
 *
 * Accrual, forecast and realization are different moments and are kept apart:
 *
 *   forecast   computed, never stored: live stock with an active mandate, weighted by
 *              how far it has got. It is a number to plan with, not a debt.
 *   accrued    stored when an offer is accepted, with the mandate's terms snapshotted.
 *   realized   when the sale closes, at the price it actually closed at.
 *   paid       when the money has been shared out.
 *
 * Attribution is read off the rows themselves: Mandate.ownerId is the listing side,
 * Interest.ownerId the selling side. Capturing it when the work was done is what
 * makes the default split a fact rather than a guess at payday.
 */

export const SPLIT_ROLES = ['listing_agent', 'selling_agent', 'introducer', 'agency', 'manager'] as const
export type SplitRole = (typeof SPLIT_ROLES)[number]

/**
 * The agency's cut of a default split. Agencies differ widely, so this is only the
 * starting point -- an admin edits it per commission -- but a default has to exist or
 * every accepted offer would need a manual step before anyone could see their share.
 */
export const DEFAULT_AGENCY_SHARE_PERCENT = 50

const cents = (n: number) => Math.round(n * 100) / 100

interface FeeTerms {
  feeType: string
  commissionPercent?: number | null
  feeFixed?: number | null
}

/** The fee on a sale at `basis`, from a mandate's terms. Zero when no terms were agreed. */
export function computeFee(terms: FeeTerms | null | undefined, basis: number): number {
  if (!terms) return 0
  if (terms.feeType === 'fixed') return cents(terms.feeFixed ?? 0)
  return cents((basis * (terms.commissionPercent ?? 0)) / 100)
}

export interface SplitDraft {
  userId: string | null
  role: SplitRole
  sharePercent: number
  note?: string | null
}

/**
 * The default split: the agency's share off the top, the remainder between the listing
 * and selling agents. One person on both sides earns both halves; a missing agent
 * leaves their half with the other, and no agent at all leaves it all with the agency.
 */
export function defaultSplits(listingAgentId: string | null, sellingAgentId: string | null): SplitDraft[] {
  const agency: SplitDraft = { userId: null, role: 'agency', sharePercent: DEFAULT_AGENCY_SHARE_PERCENT }
  const pool = 100 - DEFAULT_AGENCY_SHARE_PERCENT

  if (!listingAgentId && !sellingAgentId) return [{ ...agency, sharePercent: 100 }]
  if (listingAgentId && sellingAgentId && listingAgentId !== sellingAgentId) {
    return [
      agency,
      { userId: listingAgentId, role: 'listing_agent', sharePercent: pool / 2 },
      { userId: sellingAgentId, role: 'selling_agent', sharePercent: pool / 2 },
    ]
  }
  // One person (or only one side known) earns the whole agent pool.
  const only = (listingAgentId ?? sellingAgentId)!
  return [agency, { userId: only, role: listingAgentId ? 'listing_agent' : 'selling_agent', sharePercent: pool }]
}

/** Resolve percentages to money so the amounts add up to the cent. The last split absorbs rounding. */
export function resolveAmounts(gross: number, drafts: SplitDraft[]): (SplitDraft & { amount: number })[] {
  let allocated = 0
  return drafts.map((d, i) => {
    const isLast = i === drafts.length - 1
    const wholePool = drafts.reduce((sum, x) => sum + x.sharePercent, 0)
    // Only the last row absorbs rounding, and only when the shares cover the whole.
    const amount = isLast && Math.abs(wholePool - 100) < 1e-9 ? cents(gross - allocated) : cents((gross * d.sharePercent) / 100)
    allocated += amount
    return { ...d, amount }
  })
}

/**
 * Accrue the commission for an accepted offer. Runs inside acceptOffer's
 * transaction, so a sale and its commission exist together or not at all.
 */
export async function accrueCommission(
  tx: Prisma.TransactionClient,
  args: {
    workspaceId: string
    propertyId: string
    interestId: string
    offerId: string
    amount: number
    currency: string | null
    userId: string | null
  }
) {
  const [mandate, interest] = await Promise.all([
    tx.mandate.findFirst({ where: { propertyId: args.propertyId, status: 'active' }, orderBy: { signedAt: 'desc' } }),
    tx.interest.findUnique({ where: { id: args.interestId }, select: { ownerId: true } }),
  ])

  const gross = computeFee(mandate, args.amount)
  const commission = await tx.commission.create({
    data: {
      workspaceId: args.workspaceId,
      propertyId: args.propertyId,
      mandateId: mandate?.id ?? null,
      interestId: args.interestId,
      offerId: args.offerId,
      status: 'accrued',
      basis: args.amount,
      // A snapshot, not a reference: renegotiating the mandate later must not rewrite this sale.
      feeType: mandate?.feeType ?? 'percent',
      feePercent: mandate?.commissionPercent ?? null,
      feeFixed: mandate?.feeFixed ?? null,
      grossAmount: gross,
      currency: args.currency,
      createdById: args.userId,
    },
  })

  const splits = resolveAmounts(gross, defaultSplits(mandate?.ownerId ?? null, interest?.ownerId ?? null))
  await tx.commissionSplit.createMany({
    data: splits.map(s => ({
      commissionId: commission.id,
      workspaceId: args.workspaceId,
      userId: s.userId,
      role: s.role,
      sharePercent: s.sharePercent,
      amount: s.amount,
      note: s.note ?? null,
    })),
  })
  return commission
}

/** A sale fell through: an accrual that was never realized is cancelled. Realized or paid ones are history. */
export async function cancelAccrual(tx: Prisma.TransactionClient, offerId: string) {
  await tx.commission.updateMany({ where: { offerId, status: 'accrued' }, data: { status: 'cancelled' } })
}

export interface CommissionContext {
  workspaceId: string
  userId: string
  /** Owner or admin: may edit shares and mark them paid. */
  canModerate: boolean
}

export const commissionInclude = {
  property: { select: { id: true, title: true, reference: true, city: true } },
  splits: { orderBy: { createdAt: 'asc' as const }, include: { user: { select: { id: true, name: true, email: true } } } },
} as const

/**
 * Replace a commission's splits. Shares are percentages of the total and may not
 * exceed it; amounts are recomputed from them. A commission with a paid share cannot
 * be re-cut, because that would rewrite money that has already moved.
 */
export async function setSplits(commissionId: string, ctx: CommissionContext, input: unknown) {
  if (!ctx.canModerate) throw new ServiceError('Only an owner or admin can change how a commission is shared', 403)

  const commission = await prisma.commission.findUnique({
    where: { id: commissionId },
    include: { splits: { select: { status: true } } },
  })
  if (!commission || commission.workspaceId !== ctx.workspaceId) throw new ServiceError('Commission not found', 404)
  if (['paid', 'cancelled'].includes(commission.status) || commission.splits.some(s => s.status === 'paid')) {
    throw new ServiceError('A commission that has been paid, or cancelled, cannot be re-cut', 409)
  }

  if (!Array.isArray(input) || input.length === 0 || input.length > 12) {
    throw new ServiceError('Provide between 1 and 12 shares')
  }
  const drafts: SplitDraft[] = input.map((raw: any, i) => {
    if (!(SPLIT_ROLES as readonly string[]).includes(raw?.role)) throw new ServiceError(`Share ${i + 1} has an unknown role`)
    const percent = Number(raw?.sharePercent)
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new ServiceError(`Share ${i + 1} must be between 0 and 100%`)
    const userId = typeof raw?.userId === 'string' && raw.userId ? raw.userId : null
    if (raw.role === 'agency' && userId) throw new ServiceError('The agency share has no member')
    if (raw.role !== 'agency' && raw.role !== 'introducer' && !userId) throw new ServiceError(`Share ${i + 1} needs a member`)
    return { userId, role: raw.role, sharePercent: percent, note: typeof raw?.note === 'string' ? raw.note.trim().slice(0, 300) || null : null }
  })

  const total = drafts.reduce((sum, d) => sum + d.sharePercent, 0)
  if (total > 100 + 1e-9) throw new ServiceError(`The shares add up to ${total}%, which is more than the commission`)

  for (const id of new Set(drafts.map(d => d.userId).filter((id): id is string => !!id))) {
    if (!(await isWorkspaceMember(ctx.workspaceId, id))) throw new ServiceError('Every share must go to a member of this workspace')
  }

  const resolved = resolveAmounts(commission.grossAmount, drafts)
  await prisma.$transaction([
    prisma.commissionSplit.deleteMany({ where: { commissionId } }),
    prisma.commissionSplit.createMany({
      data: resolved.map(s => ({
        commissionId, workspaceId: ctx.workspaceId, userId: s.userId, role: s.role,
        sharePercent: s.sharePercent, amount: s.amount, note: s.note ?? null,
      })),
    }),
  ])

  return prisma.commission.findUniqueOrThrow({ where: { id: commissionId }, include: commissionInclude })
}

/**
 * The sale closed. The accrued commission becomes realized at the price it actually
 * closed at (which can differ from the accepted offer), the buyer's interest is won,
 * the mandate is completed, and any other accrual on the property is cancelled.
 */
export async function realizeCommissionForProperty(propertyId: string, closedAt = new Date()) {
  const accrued = await prisma.commission.findFirst({
    where: { propertyId, status: 'accrued' },
    orderBy: { createdAt: 'desc' },
    include: { property: { select: { soldPrice: true, price: true } } },
  })
  if (!accrued) return null

  const basis = accrued.property.soldPrice ?? accrued.basis
  const gross = computeFee(
    { feeType: accrued.feeType, commissionPercent: accrued.feePercent, feeFixed: accrued.feeFixed },
    basis
  )

  return prisma.$transaction(async (tx) => {
    // The price moved between acceptance and closing: re-share the new total by the same percentages.
    if (gross !== accrued.grossAmount) {
      const splits = await tx.commissionSplit.findMany({ where: { commissionId: accrued.id, status: { not: 'paid' } }, orderBy: { createdAt: 'asc' } })
      const resolved = resolveAmounts(gross, splits.map(s => ({ userId: s.userId, role: s.role as SplitRole, sharePercent: s.sharePercent })))
      for (const [i, s] of splits.entries()) {
        await tx.commissionSplit.update({ where: { id: s.id }, data: { amount: resolved[i].amount } })
      }
    }

    const realized = await tx.commission.update({
      where: { id: accrued.id },
      data: { status: 'realized', basis, grossAmount: gross, realizedAt: closedAt },
    })
    await tx.commission.updateMany({ where: { propertyId, status: 'accrued', id: { not: accrued.id } }, data: { status: 'cancelled' } })
    if (accrued.interestId) await tx.interest.update({ where: { id: accrued.interestId }, data: { status: 'won' } })
    if (accrued.mandateId) await tx.mandate.updateMany({ where: { id: accrued.mandateId, status: 'active' }, data: { status: 'completed' } })
    return realized
  })
}

/**
 * Mark a realized commission paid: every share with it. Only a realized commission
 * can be paid -- money is not owed until the sale has closed.
 */
export async function markPaid(commissionId: string, ctx: CommissionContext) {
  if (!ctx.canModerate) throw new ServiceError('Only an owner or admin can mark a commission paid', 403)
  const now = new Date()
  const result = await prisma.commission.updateMany({
    where: { id: commissionId, workspaceId: ctx.workspaceId, status: 'realized' },
    data: { status: 'paid', paidAt: now },
  })
  if (result.count === 0) throw new ServiceError('Only a realized commission can be marked paid', 409)
  await prisma.commissionSplit.updateMany({ where: { commissionId }, data: { status: 'paid', paidAt: now } })
  return prisma.commission.findUniqueOrThrow({ where: { id: commissionId }, include: commissionInclude })
}

/** How likely live stock at each lifecycle stage is to turn into a closed sale. */
export const FORECAST_WEIGHT: Record<string, number> = { live: 0.25, under_offer: 0.8 }

export interface ForecastRow {
  userId: string | null
  /** The fee if every listing sold at its asking price. */
  potential: number
  /** potential weighted by how far each listing has got. */
  weighted: number
  listings: number
}

/**
 * What the pipeline is worth: for each active mandate on a property that is on the
 * market, the fee at the asking price, weighted by stage. Attributed to the listing
 * agent, whose mandate it is. A planning number only: it is computed on request and
 * never stored, because it is not owed to anyone.
 */
export async function forecast(workspaceId: string): Promise<{ rows: ForecastRow[]; potential: number; weighted: number }> {
  const mandates = await prisma.mandate.findMany({
    where: { workspaceId, status: 'active', property: { status: { in: ['live', 'under_offer'] } } },
    select: { ownerId: true, askingPrice: true, feeType: true, commissionPercent: true, feeFixed: true, property: { select: { status: true } } },
  })

  const byUser = new Map<string | null, ForecastRow>()
  for (const m of mandates) {
    const fee = computeFee(m, m.askingPrice)
    const row = byUser.get(m.ownerId) ?? { userId: m.ownerId, potential: 0, weighted: 0, listings: 0 }
    row.potential += fee
    row.weighted += fee * (FORECAST_WEIGHT[m.property.status] ?? 0)
    row.listings++
    byUser.set(m.ownerId, row)
  }

  const rows = Array.from(byUser.values()).map(r => ({ ...r, potential: cents(r.potential), weighted: cents(r.weighted) }))
  return {
    rows,
    potential: cents(rows.reduce((s, r) => s + r.potential, 0)),
    weighted: cents(rows.reduce((s, r) => s + r.weighted, 0)),
  }
}
