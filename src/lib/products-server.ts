/**
 * Server-only product helpers. Kept separate from `@/lib/products` because these
 * pull in Prisma, and separate from the route files because Next.js only allows
 * route handlers to be exported from `route.ts`.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ProductSortKey } from '@/lib/products';
import type { ProductCustomFieldType } from '@/types';

/**
 * Whitelisted ORDER BY fragments. The client's `sort` value is narrowed to a known
 * key first, so nothing user-supplied ever reaches the raw query.
 */
export const PRODUCT_SORT_CLAUSES: Record<ProductSortKey, Prisma.Sql> = {
  updated: Prisma.sql`"updatedAt" DESC, "name" ASC`,
  name: Prisma.sql`"name" ASC`,
  price: Prisma.sql`"price" DESC, "name" ASC`,
  stock: Prisma.sql`"stockQuantity" DESC NULLS LAST, "name" ASC`,
};

/**
 * A unique-violation on the (workspaceId, sku) index.
 *
 * The product routes write with $queryRaw/$executeRaw, and Prisma reports a failed
 * raw query as P2010 with the Postgres code (23505) in `meta.code`, not as P2002.
 * Checking only P2002 missed every duplicate, so they surfaced as a 500.
 */
export function isDuplicateSkuError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return true;
    if (error.code === 'P2010') {
      const meta = error.meta as { code?: string } | undefined;
      return meta?.code === '23505' || /\b23505\b/.test(error.message);
    }
    return false;
  }
  const code = (error as { code?: string } | null)?.code;
  return code === '23505';
}

export const DUPLICATE_SKU_MESSAGE = 'A product with this SKU already exists in this workspace';

/** The workspace's custom product field definitions, in display order. */
export async function loadCustomFieldDefs(workspaceId: string) {
  const rows = await prisma.productCustomField.findMany({
    where: { workspaceId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, workspaceId: true, key: true, label: true, type: true, position: true },
  });
  return rows.map((row) => ({ ...row, type: row.type as ProductCustomFieldType }));
}
