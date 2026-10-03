import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getWorkspaceRole,
  requireWorkspaceAccess,
  requireWorkspacePermission,
} from '@/lib/api/workspace';
import {
  clampInt,
  escapeLikePattern,
  parseNumericField,
  resolveProductSort,
  toOptionalString,
  type ProductRow,
} from '@/lib/products';
import {
  DUPLICATE_SKU_MESSAGE,
  isDuplicateSkuError,
  loadCustomFieldDefs,
  PRODUCT_SORT_CLAUSES,
} from '@/lib/products-server';
import { sanitizeCustomFields } from '@/lib/product-custom-fields';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const search = searchParams.get('search')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';
    const isActive = searchParams.get('isActive');
    const sort = resolveProductSort(searchParams.get('sort'));
    const page = clampInt(searchParams.get('page'), 1, 1, 100000);
    const limit = clampInt(searchParams.get('limit'), 20, 1, 100);

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    const access = await requireWorkspaceAccess(workspaceId);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const conditions: Prisma.Sql[] = [Prisma.sql`"workspaceId" = ${workspaceId}`];

    if (search) {
      // Backslash is Postgres' default LIKE escape character, so escaping the
      // wildcards is enough: a user typing "%" searches for a literal percent sign.
      const pattern = `%${escapeLikePattern(search)}%`;
      conditions.push(
        Prisma.sql`(
          "name" ILIKE ${pattern}
          OR COALESCE("description", '') ILIKE ${pattern}
          OR COALESCE("sku", '') ILIKE ${pattern}
          OR COALESCE("category", '') ILIKE ${pattern}
          OR "customFields"::text ILIKE ${pattern}
        )`
      );
    }

    if (category && category !== 'all') {
      conditions.push(Prisma.sql`"category" = ${category}`);
    }

    if (isActive === 'true') conditions.push(Prisma.sql`"isActive" = true`);
    if (isActive === 'false') conditions.push(Prisma.sql`"isActive" = false`);

    const whereSql = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    const [products, totalRows, categories, role] = await Promise.all([
      prisma.$queryRaw<ProductRow[]>(Prisma.sql`
        SELECT *
        FROM "Product"
        ${whereSql}
        ORDER BY ${PRODUCT_SORT_CLAUSES[sort]}
        OFFSET ${(page - 1) * limit}
        LIMIT ${limit}
      `),
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "Product"
        ${whereSql}
      `),
      prisma.$queryRaw<Array<{ category: string | null }>>(Prisma.sql`
        SELECT DISTINCT "category"
        FROM "Product"
        WHERE "workspaceId" = ${workspaceId} AND "category" IS NOT NULL
        ORDER BY "category" ASC
      `),
      // Ships with the list so the client knows which write affordances to render
      // without paying for a second round trip.
      getWorkspaceRole(workspaceId, access.session.user.id),
    ]);

    const total = Number(totalRows[0]?.total || 0);

    return NextResponse.json({
      products,
      role,
      categories: categories
        .map((item) => item.category)
        .filter((value): value is string => Boolean(value)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const workspaceId = body.workspaceId as string | undefined;
    const name = String(body.name || '').trim();

    if (!workspaceId || !name) {
      return NextResponse.json(
        { error: 'Workspace ID and product name are required' },
        { status: 400 }
      );
    }

    const access = await requireWorkspacePermission(workspaceId, 'content:create');
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const price = parseNumericField(body.price, 'Price', { required: true, min: 0 });
    if (!price.ok) return NextResponse.json({ error: price.message }, { status: 400 });

    const taxRate = parseNumericField(body.taxRate, 'Tax rate', { min: 0 });
    if (!taxRate.ok) return NextResponse.json({ error: taxRate.message }, { status: 400 });

    const stockQuantity = parseNumericField(body.stockQuantity, 'Stock quantity', {
      min: 0,
      integer: true,
    });
    if (!stockQuantity.ok) {
      return NextResponse.json({ error: stockQuantity.message }, { status: 400 });
    }

    const custom = sanitizeCustomFields(await loadCustomFieldDefs(workspaceId), body.customFields);
    if (!custom.ok) return NextResponse.json({ error: custom.message }, { status: 400 });

    const productId = randomUUID();

    const [product] = await prisma.$queryRaw<ProductRow[]>(Prisma.sql`
      INSERT INTO "Product" (
        "id",
        "workspaceId",
        "name",
        "description",
        "sku",
        "price",
        "unit",
        "category",
        "taxRate",
        "stockQuantity",
        "customFields",
        "isActive",
        "createdById",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${productId},
        ${workspaceId},
        ${name},
        ${toOptionalString(body.description)},
        ${toOptionalString(body.sku)},
        ${price.value ?? 0},
        ${toOptionalString(body.unit)},
        ${toOptionalString(body.category)},
        ${taxRate.value ?? 0},
        ${stockQuantity.value},
        ${JSON.stringify(custom.values)}::jsonb,
        ${body.isActive !== false},
        ${access.session.user.id},
        NOW(),
        NOW()
      )
      RETURNING *
    `);

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (isDuplicateSkuError(error)) {
      return NextResponse.json(
        { error: DUPLICATE_SKU_MESSAGE },
        { status: 409 }
      );
    }

    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
