import type { Prisma } from '@prisma/client'

/**
 * Keep an active mandate's asking price and price history in step with the
 * property's price.
 *
 * Days-on-market and price drops are the two numbers every seller asks about, and
 * the vendor report reads them from MandatePriceChange. The price can change from
 * two places -- the property form and the mandate's own price-change action -- so
 * both go through here, inside the caller's transaction, and the history is the
 * same whichever one the agent used.
 *
 * Returns the mandate that was updated, or null when the property has no active
 * mandate (a prospect being priced for a valuation has no history to keep).
 */
export async function syncMandatePrice(
  tx: Prisma.TransactionClient,
  args: {
    propertyId: string
    workspaceId: string
    from: number
    to: number
    userId: string
    reason?: string | null
  }
): Promise<{ id: string } | null> {
  const mandate = await tx.mandate.findFirst({
    where: { propertyId: args.propertyId, workspaceId: args.workspaceId, status: 'active' },
    select: { id: true },
  })
  if (!mandate) return null

  await tx.mandate.update({ where: { id: mandate.id }, data: { askingPrice: args.to } })
  await tx.mandatePriceChange.create({
    data: {
      mandateId: mandate.id,
      fromPrice: args.from,
      toPrice: args.to,
      reason: args.reason ?? null,
      changedById: args.userId,
    },
  })

  return mandate
}
