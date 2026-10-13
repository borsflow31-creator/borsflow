import { prisma } from '@/lib/prisma'
import type { DeveloperContext } from './programs'

/**
 * What the lead form needs to show and pick a unit, and nothing more: no buyer,
 * no option holder, no payments, which listInventory carries for the inventory
 * page and which a salesperson filling in a new lead has no reason to receive.
 */
export const PICKER_LOT_SELECT = {
  id: true,
  lotNumber: true,
  type: true,
  typology: true,
  floor: true,
  bedrooms: true,
  surfaceArea: true,
  totalPrice: true,
  status: true,
  building: { select: { name: true } },
  program: { select: { id: true, name: true, city: true } },
} as const

/** The most a search returns; past that, the user narrows it by typing. */
const PICKER_LIMIT = 50

/**
 * Units a new buyer can be offered: available ones only, since an optioned or
 * reserved unit is already promised to someone. Searched by unit number,
 * typology or building, on the server, so a large programme is never sent whole.
 */
export async function listSelectableLots(
  ctx: DeveloperContext,
  filters: { programId?: string; q?: string } = {}
) {
  const q = filters.q?.trim().slice(0, 60)
  return prisma.developmentLot.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      status: 'available',
      ...(filters.programId && { programId: filters.programId }),
      ...(q && {
        OR: [
          { lotNumber: { contains: q, mode: 'insensitive' as const } },
          { typology: { contains: q, mode: 'insensitive' as const } },
          { building: { name: { contains: q, mode: 'insensitive' as const } } },
        ],
      }),
    },
    select: PICKER_LOT_SELECT,
    orderBy: [{ program: { name: 'asc' } }, { floor: 'asc' }, { lotNumber: 'asc' }],
    take: PICKER_LIMIT,
  })
}
