import type { Prisma } from '@prisma/client'

export type BoardSubject = 'Lead' | 'Interest' | 'Property'

/**
 * The calls a board needs, which every board table (lead, interest, property)
 * supports identically: they all carry pipelineId, stage, order and createdAt.
 */
export interface BoardDelegate {
  findMany(args: {
    where: { pipelineId: string; stage: string | { in: string[] }; id?: { not: string } }
    orderBy: { order?: 'asc'; createdAt?: 'asc' }[]
    select: { id: true }
  }): Promise<{ id: string }[]>
  update(args: { where: { id: string }; data: { order?: number; stage?: string } }): Promise<unknown>
  updateMany(args: {
    where: { pipelineId: string; stage: string | { in: string[] } }
    data: { stage: string }
  }): Promise<{ count: number }>
}

/**
 * Pick the table. An explicit switch rather than `tx[model]`, so Prisma's types
 * stay real for everything except these two uniform calls.
 */
export function boardTable(tx: Prisma.TransactionClient, subject: BoardSubject): BoardDelegate {
  switch (subject) {
    case 'Lead':
      return tx.lead as unknown as BoardDelegate
    case 'Interest':
      return tx.interest as unknown as BoardDelegate
    case 'Property':
      return tx.property as unknown as BoardDelegate
  }
}

/**
 * Place a card at index `order` in its destination column and renumber the whole
 * column, so positions stay dense and unique after a drag and drop.
 *
 * Call inside a transaction, after the card's own update (which may have changed
 * its stage). Extracted from the lead route so the buyer and owner boards move
 * cards by exactly the same rule rather than three drifting copies.
 */
export async function reorderInColumn(
  tx: Prisma.TransactionClient,
  subject: BoardSubject,
  args: { id: string; pipelineId: string; stage: string; order: number }
): Promise<void> {
  const delegate = boardTable(tx, subject)

  const siblings = await delegate.findMany({
    where: { pipelineId: args.pipelineId, stage: args.stage, id: { not: args.id } },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  })

  const index = Math.max(0, Math.min(Math.floor(args.order), siblings.length))
  const ids = siblings.map(s => s.id)
  ids.splice(index, 0, args.id)

  // Sequential: an interactive transaction runs on one connection and cannot
  // service concurrent queries.
  for (const [position, id] of ids.entries()) {
    await delegate.update({ where: { id }, data: { order: position } })
  }
}
