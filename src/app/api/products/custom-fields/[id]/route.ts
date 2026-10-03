import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspacePermission } from '@/lib/api/workspace';
import { MAX_CUSTOM_LABEL, coerceCustomValue, isCustomFieldType } from '@/lib/product-custom-fields';
import type { ProductCustomFieldType } from '@/types';

type Params = { params: { id: string } };

/** The field plus a write-permission check on its workspace. */
async function authorize(id: string) {
  const field = await prisma.productCustomField.findUnique({ where: { id } });
  if (!field) return { error: NextResponse.json({ error: 'Field not found' }, { status: 404 }) };
  const access = await requireWorkspacePermission(field.workspaceId, 'content:create');
  if ('error' in access) return { error: NextResponse.json({ error: access.error }, { status: access.status }) };
  return { field };
}

// PATCH /api/products/custom-fields/[id]  { label?, type?, position? }
// The key never changes, so stored values stay attached when a field is renamed.
// Changing the type is refused if existing values don't fit the new type.
export async function PATCH(request: NextRequest, { params }: Params) {
  const result = await authorize(params.id);
  if ('error' in result) return result.error;
  const { field } = result;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const data: { label?: string; type?: string; position?: number } = {};

  if (body.label !== undefined) {
    const label = typeof body.label === 'string' ? body.label.trim().slice(0, MAX_CUSTOM_LABEL) : '';
    if (!label) return NextResponse.json({ error: 'Field name is required' }, { status: 400 });
    data.label = label;
  }

  if (body.position !== undefined) {
    if (typeof body.position !== 'number' || !Number.isInteger(body.position)) {
      return NextResponse.json({ error: 'Position must be a whole number' }, { status: 400 });
    }
    data.position = body.position;
  }

  if (body.type !== undefined && body.type !== field.type) {
    if (!isCustomFieldType(body.type)) return NextResponse.json({ error: 'Unknown field type' }, { status: 400 });
    const nextType = body.type as ProductCustomFieldType;
    // Convert existing values to the new type; refuse if any can't be converted.
    const rows = await prisma.$queryRaw<Array<{ id: string; value: unknown }>>(Prisma.sql`
      SELECT "id", "customFields" -> ${field.key} AS value
      FROM "Product"
      WHERE "workspaceId" = ${field.workspaceId} AND "customFields" ? ${field.key}
    `);
    const converted: Array<{ id: string; value: unknown }> = [];
    for (const row of rows) {
      const coerced = coerceCustomValue({ label: data.label ?? field.label, type: nextType }, row.value);
      if (!coerced.ok) {
        return NextResponse.json(
          { error: `Some products have values that aren't a valid ${nextType} (e.g. "${String(row.value)}"). Fix or clear them first.` },
          { status: 409 }
        );
      }
      converted.push({ id: row.id, value: coerced.value });
    }
    await prisma.$transaction(
      converted.map((row) =>
        row.value === null
          ? prisma.$executeRaw(Prisma.sql`UPDATE "Product" SET "customFields" = "customFields" - ${field.key} WHERE "id" = ${row.id}`)
          : prisma.$executeRaw(Prisma.sql`
              UPDATE "Product"
              SET "customFields" = jsonb_set("customFields", ARRAY[${field.key}]::text[], ${JSON.stringify(row.value)}::jsonb)
              WHERE "id" = ${row.id}
            `)
      )
    );
    data.type = nextType;
  }

  const updated = await prisma.productCustomField.update({
    where: { id: field.id },
    data,
    select: { id: true, workspaceId: true, key: true, label: true, type: true, position: true },
  });
  return NextResponse.json({ field: updated });
}

// DELETE /api/products/custom-fields/[id]
// Removes the definition and the stored value from every product in the workspace.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const result = await authorize(params.id);
  if ('error' in result) return result.error;
  const { field } = result;

  await prisma.$transaction([
    prisma.$executeRaw(Prisma.sql`
      UPDATE "Product"
      SET "customFields" = "customFields" - ${field.key}
      WHERE "workspaceId" = ${field.workspaceId} AND "customFields" ? ${field.key}
    `),
    prisma.productCustomField.delete({ where: { id: field.id } }),
  ]);

  return NextResponse.json({ success: true });
}
