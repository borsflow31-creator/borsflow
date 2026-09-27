import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace';
import { parseNumericField, toOptionalString, type ProductRow } from '@/lib/products';
import { DUPLICATE_SKU_MESSAGE, isDuplicateSkuError } from '@/lib/products-server';

type AuthorizedProductResult =
  | { error: string; status: number }
  | {
      product: ProductRow;
      access: Exclude<Awaited<ReturnType<typeof requireWorkspaceAccess>>, { error: string; status: number }>;
    };

async function getAuthorizedProduct(productId: string): Promise<AuthorizedProductResult> {
  const [product] = await prisma.$queryRaw<ProductRow[]>(Prisma.sql`
    SELECT *
    FROM "Product"
    WHERE "id" = ${productId}
    LIMIT 1
  `);

  if (!product) {
    return { error: 'Product not found', status: 404 };
  }

  const access = await requireWorkspaceAccess(product.workspaceId);
  if ('error' in access) {
    return { error: access.error ?? 'Access denied', status: access.status ?? 403 };
  }

  return {
    product,
    access,
  };
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getAuthorizedProduct(params.id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ product: result.product });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getAuthorizedProduct(params.id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const permission = await requireWorkspacePermission(
      result.product.workspaceId,
      'content:create'
    );
    if ('error' in permission) {
      return NextResponse.json({ error: permission.error }, { status: permission.status });
    }

    const body = await request.json();
    const name = String(body.name || '').trim();

    if (!name) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
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

    const [product] = await prisma.$queryRaw<ProductRow[]>(Prisma.sql`
      UPDATE "Product"
      SET
        "name" = ${name},
        "description" = ${toOptionalString(body.description)},
        "sku" = ${toOptionalString(body.sku)},
        "price" = ${price.value ?? 0},
        "unit" = ${toOptionalString(body.unit)},
        "category" = ${toOptionalString(body.category)},
        "taxRate" = ${taxRate.value ?? 0},
        "stockQuantity" = ${stockQuantity.value},
        "isActive" = ${body.isActive !== false},
        "updatedAt" = NOW()
      WHERE "id" = ${params.id}
      RETURNING *
    `);

    return NextResponse.json({ product });
  } catch (error) {
    if (isDuplicateSkuError(error)) {
      return NextResponse.json({ error: DUPLICATE_SKU_MESSAGE }, { status: 409 });
    }

    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getAuthorizedProduct(params.id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const permission = await requireWorkspacePermission(
      result.product.workspaceId,
      'content:create'
    );
    if ('error' in permission) {
      return NextResponse.json({ error: permission.error }, { status: permission.status });
    }

    await prisma.$executeRaw(Prisma.sql`
      DELETE FROM "Product"
      WHERE "id" = ${params.id}
    `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
