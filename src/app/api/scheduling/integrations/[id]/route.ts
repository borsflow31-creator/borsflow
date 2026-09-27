import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspacePermission } from '@/lib/api/workspace';
import { disconnectCalcomWebhook } from '@/lib/email/webhook-setup';

/** Authorizes a change against the workspace that owns the integration. */
async function authorize(id: string) {
  const integration = await prisma.calendarIntegration.findUnique({
    where: { id },
    select: { workspaceId: true },
  });
  if (!integration) return { error: 'Integration not found', status: 404 as const };
  return requireWorkspacePermission(integration.workspaceId, 'content:create');
}

// DELETE /api/scheduling/integrations/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const access = await authorize(params.id);
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

  // Take BorsFlow's booking webhook off the client's Cal.com account first, so
  // it stops sending events for a connection that is gone.
  const integration = await prisma.calendarIntegration.findUnique({ where: { id: params.id } });
  if (integration) await disconnectCalcomWebhook(integration);

  // Soft-delete: mark as inactive instead of removing data
  await prisma.calendarIntegration.update({
    where: { id: params.id },
    data: {
      isActive: false,
      syncEnabled: false,
      webhookId: null,
      webhookSecret: null,
      webhookStatus: null,
      webhookError: null,
      updatedBy: access.session.user.id,
    }
  });

  return NextResponse.json({ success: true });
}

// PATCH /api/scheduling/integrations/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const access = await authorize(params.id);
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();

  const updated = await prisma.calendarIntegration.update({
    where: { id: params.id },
    data: {
      ...(body.syncEnabled    !== undefined && { syncEnabled: body.syncEnabled }),
      ...(body.syncFrequency  !== undefined && { syncFrequency: body.syncFrequency }),
      ...(body.syncDirection  !== undefined && { syncDirection: body.syncDirection }),
      updatedBy: access.session.user.id,
    },
    select: {
      id: true, type: true, name: true, providerEmail: true,
      lastSyncAt: true, syncStatus: true, syncFrequency: true, syncEnabled: true,
      webhookStatus: true, webhookError: true
    }
  });

  return NextResponse.json({ integration: updated });
}
