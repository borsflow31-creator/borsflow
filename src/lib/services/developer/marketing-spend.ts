import { prisma } from '@/lib/prisma'
import { ServiceError } from '../errors'
import { readNumber, readString } from '../parse'
import type { DeveloperContext } from './programs'

/**
 * What was spent on a marketing channel in a month, entered by hand.
 *
 * Nothing in the product knows what an advertising channel cost: ad accounts are
 * not connected. Without a number there is no cost per lead and no return, only
 * counts, so this is the smallest thing that makes the marketing report an answer
 * to "is it worth it" -- one row per source, campaign and month.
 *
 * The source is stored lowercased and trimmed, the same way the report groups
 * leads, so "Facebook" typed here and "facebook" on a lead land in one row.
 */

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/

export async function listSpend(ctx: DeveloperContext, filters: { from?: Date; to?: Date } = {}) {
  return prisma.marketingSpend.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(filters.from || filters.to
        ? { month: { ...(filters.from && { gte: filters.from }), ...(filters.to && { lt: filters.to }) } }
        : {}),
    },
    orderBy: [{ month: 'desc' }, { source: 'asc' }],
    take: 500,
  })
}

/** Create the month's row for a source and campaign, or replace its amount. */
export async function saveSpend(ctx: DeveloperContext, input: Record<string, unknown>) {
  const source = readString(input, 'source', 'Source', { required: true, max: 60 })!.toLowerCase()
  const campaign = (readString(input, 'campaign', 'Campaign', { max: 120 }) ?? '').trim()
  const amount = readNumber(input, 'amount', 'Amount', { min: 0, required: true })!

  const rawMonth = readString(input, 'month', 'Month', { required: true })!
  const match = MONTH.exec(rawMonth)
  if (!match) throw new ServiceError('Month must look like 2026-10')
  const month = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1))

  return prisma.marketingSpend.upsert({
    where: { workspaceId_source_campaign_month: { workspaceId: ctx.workspaceId, source, campaign, month } },
    update: { amount },
    create: { workspaceId: ctx.workspaceId, source, campaign, month, amount },
  })
}

export async function deleteSpend(ctx: DeveloperContext, id: string) {
  const result = await prisma.marketingSpend.deleteMany({ where: { id, workspaceId: ctx.workspaceId } })
  if (result.count === 0) throw new ServiceError('Spend entry not found', 404)
  return { success: true }
}
