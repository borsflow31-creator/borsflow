import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspacePermission } from '@/lib/api/workspace';
import {
  MAX_IMPORT_PRODUCTS,
  isPresent,
  toOptionalNumber,
  toOptionalString,
} from '@/lib/products';
import { DUPLICATE_SKU_MESSAGE, isDuplicateSkuError } from '@/lib/products-server';

interface ImportRow {
  name?: string;
  description?: string;
  sku?: string;
  price?: string | number;
  unit?: string;
  category?: string;
  taxRate?: string | number;
  stockQuantity?: string | number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const workspaceId = body.workspaceId as string | undefined;
    const products = (body.products || []) as ImportRow[];

    if (!workspaceId || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'Workspace ID and products array are required' },
        { status: 400 }
      );
    }

    if (products.length > MAX_IMPORT_PRODUCTS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMPORT_PRODUCTS} products per import` },
        { status: 400 }
      );
    }

    const access = await requireWorkspacePermission(workspaceId, 'content:create');
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const result = {
      created: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; message: string }>,
    };

    for (const [index, row] of products.entries()) {
      const rowNumber = index + 2;
      const name = String(row.name || '').trim();

      if (!name) {
        result.skipped += 1;
        result.errors.push({ row: rowNumber, message: 'Name is required' });
        continue;
      }

      const price = toOptionalNumber(row.price);
      const taxRate = toOptionalNumber(row.taxRate);
      const stockQuantity = toOptionalNumber(row.stockQuantity);

      if (price === null) {
        result.skipped += 1;
        result.errors.push({ row: rowNumber, message: 'Price must be a valid number' });
        continue;
      }

      if (taxRate === null && isPresent(row.taxRate)) {
        result.skipped += 1;
        result.errors.push({ row: rowNumber, message: 'Tax rate must be a valid number' });
        continue;
      }

      if (stockQuantity === null && isPresent(row.stockQuantity)) {
        result.skipped += 1;
        result.errors.push({ row: rowNumber, message: 'Stock quantity must be a valid number' });
        continue;
      }

      try {
        const existing = row.sku
          ? await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
              SELECT "id"
              FROM "Product"
              WHERE "workspaceId" = ${workspaceId}
                AND "sku" = ${String(row.sku).trim()}
              LIMIT 1
            `)
          : [];

        if (existing.length > 0) {
          result.skipped += 1;
          result.errors.push({ row: rowNumber, message: 'SKU already exists in this workspace' });
          continue;
        }

        await prisma.$executeRaw(Prisma.sql`
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
            "isActive",
            "createdById",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${randomUUID()},
            ${workspaceId},
            ${name},
            ${toOptionalString(row.description)},
            ${toOptionalString(row.sku)},
            ${price},
            ${toOptionalString(row.unit)},
            ${toOptionalString(row.category)},
            ${taxRate ?? 0},
            ${stockQuantity === null ? null : Math.round(stockQuantity)},
            true,
            ${access.session.user.id},
            NOW(),
            NOW()
          )
        `);

        result.created += 1;
      } catch (error) {
        result.skipped += 1;
        // Raw driver messages can leak schema internals, so only the duplicate-SKU
        // case (which the unique index raises) gets a specific message.
        if (isDuplicateSkuError(error)) {
          result.errors.push({ row: rowNumber, message: DUPLICATE_SKU_MESSAGE });
        } else {
          console.error(`Error importing product row ${rowNumber}:`, error);
          result.errors.push({ row: rowNumber, message: 'Could not be saved' });
        }
      }
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error importing products:', error);
    return NextResponse.json({ error: 'Failed to import products' }, { status: 500 });
  }
}
