import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspacePermission } from '@/lib/api/workspace';
import { connectCalcomWebhook } from '@/lib/email/webhook-setup';

/**
 * POST /api/scheduling/integrations/[id]/webhook
 * (Re)creates the booking webhook on the client's Cal.com account. Backs the
 * "Retry" link shown when live updates could not be turned on automatically.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const existing = await prisma.calendarIntegration.findUnique({
    where: { id: params.id },
    select: { workspaceId: true, type: true, isActive: true },
  });
  if (!existing || !existing.isActive) return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
  if (existing.type !== 'calcom') {
    return NextResponse.json({ error: 'Live updates are only set up for Cal.com' }, { status: 400 });
  }

  const access = await requireWorkspacePermission(existing.workspaceId, 'content:create');
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

  const integration = await connectCalcomWebhook(params.id);
  return NextResponse.json({
    webhookStatus: integration?.webhookStatus ?? null,
    webhookError: integration?.webhookError ?? null,
  });
}
