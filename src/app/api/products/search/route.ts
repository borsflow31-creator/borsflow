import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceAccess } from '@/lib/api/workspace';
import { clampInt, escapeLikePattern } from '@/lib/products';

export const dynamic = 'force-dynamic';

interface SearchProductRow {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  taxRate: number;
  unit: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const q = searchParams.get('q')?.trim() || '';
    const limit = clampInt(searchParams.get('limit'), 10, 1, 25);

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    const access = await requireWorkspaceAccess(workspaceId);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // An empty query lists the catalog, so the ILIKE block is omitted entirely rather
    // than neutralised with a bound boolean.
    const matchSql = q
      ? (() => {
          const pattern = `%${escapeLikePattern(q)}%`;
          return Prisma.sql`AND (
            "name" ILIKE ${pattern}
            OR COALESCE("sku", '') ILIKE ${pattern}
            OR COALESCE("description", '') ILIKE ${pattern}
          )`;
        })()
      : Prisma.empty;

    const products = await prisma.$queryRaw<SearchProductRow[]>(Prisma.sql`
      SELECT "id", "name", "description", "sku", "price", "taxRate", "unit"
      FROM "Product"
      WHERE "workspaceId" = ${workspaceId}
        AND "isActive" = true
        ${matchSql}
      ORDER BY "name" ASC
      LIMIT ${limit}
    `);

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error searching products:', error);
    return NextResponse.json({ error: 'Failed to search products' }, { status: 500 });
  }
}
