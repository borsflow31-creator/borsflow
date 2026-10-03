import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace';
import { loadCustomFieldDefs } from '@/lib/products-server';
import {
  MAX_CUSTOM_FIELDS,
  MAX_CUSTOM_LABEL,
  isCustomFieldType,
  isValidFieldKey,
  toFieldKey,
} from '@/lib/product-custom-fields';

// GET /api/products/custom-fields?workspaceId=…
// The workspace's custom product fields, in display order.
export async function GET(request: NextRequest) {
  const workspaceId = new URL(request.url).searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });

  const access = await requireWorkspaceAccess(workspaceId);
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

  const fields = await loadCustomFieldDefs(workspaceId);

  // How many products hold a value for each field, so deleting one can say what it removes.
  const counts = fields.length
    ? await prisma.$queryRaw<Array<{ key: string; count: bigint }>>(Prisma.sql`
        SELECT k AS key, COUNT(*)::bigint AS count
        FROM "Product", jsonb_object_keys("customFields") AS k
        WHERE "workspaceId" = ${workspaceId}
        GROUP BY k
      `)
    : [];
  const usage = new Map(counts.map((row) => [row.key, Number(row.count)]));

  return NextResponse.json({
    fields: fields.map((field) => ({ ...field, usageCount: usage.get(field.key) ?? 0 })),
  });
}

// POST /api/products/custom-fields  { workspaceId, label, key?, type? }
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : '';
  const label = typeof body.label === 'string' ? body.label.trim().slice(0, MAX_CUSTOM_LABEL) : '';
  const type = body.type === undefined ? 'text' : body.type;
  const key = typeof body.key === 'string' && body.key.trim() ? body.key.trim() : toFieldKey(label);

  if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
  if (!label) return NextResponse.json({ error: 'Field name is required' }, { status: 400 });
  if (!isCustomFieldType(type)) return NextResponse.json({ error: 'Unknown field type' }, { status: 400 });
  if (!isValidFieldKey(key)) {
    return NextResponse.json(
      { error: 'Field key must start with a letter, use only letters and numbers, and not be a built-in field' },
      { status: 400 }
    );
  }

  const access = await requireWorkspacePermission(workspaceId, 'content:create');
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

  const existing = await prisma.productCustomField.findMany({
    where: { workspaceId },
    select: { key: true, position: true },
  });
  if (existing.length >= MAX_CUSTOM_FIELDS) {
    return NextResponse.json({ error: `A workspace can have at most ${MAX_CUSTOM_FIELDS} custom fields` }, { status: 400 });
  }
  if (existing.some((field) => field.key.toLowerCase() === key.toLowerCase())) {
    return NextResponse.json({ error: `A field with the key "${key}" already exists` }, { status: 409 });
  }

  try {
    const field = await prisma.productCustomField.create({
      data: {
        workspaceId,
        key,
        label,
        type,
        position: existing.reduce((max, field) => Math.max(max, field.position), -1) + 1,
      },
      select: { id: true, workspaceId: true, key: true, label: true, type: true, position: true },
    });
    return NextResponse.json({ field: { ...field, usageCount: 0 } }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: `A field with the key "${key}" already exists` }, { status: 409 });
    }
    throw error;
  }
}
