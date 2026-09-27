import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspacePermission } from '@/lib/api/workspace';

/** Loads the config and authorizes a change against the workspace that owns it. */
async function authorize(id: string) {
  const config = await prisma.videoConferenceConfig.findUnique({ where: { id } });
  if (!config) return { error: 'Config not found', status: 404 as const };
  const access = await requireWorkspacePermission(config.workspaceId, 'content:create');
  if ('error' in access) return { error: access.error, status: access.status };
  return { config, userId: access.session.user.id };
}

// PATCH /api/scheduling/video-configs/[id] — toggle default, update settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await authorize(params.id);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { config, userId } = result;

  const body = await request.json();

  // If setting as default, unset all others in this workspace first
  if (body.isDefault === true) {
    await prisma.videoConferenceConfig.updateMany({
      where: { workspaceId: config.workspaceId, isDefault: true },
      data:  { isDefault: false }
    });
  }

  const updated = await prisma.videoConferenceConfig.update({
    where: { id: params.id },
    data: {
      ...(body.isDefault  !== undefined && { isDefault: body.isDefault }),
      ...(body.isActive   !== undefined && { isActive: body.isActive }),
      ...(body.name       !== undefined && { name: body.name }),
      updatedBy: userId,
    },
    select: {
      id: true, platform: true, name: true, providerEmail: true, isDefault: true, isActive: true
    }
  });

  return NextResponse.json({ config: updated });
}

// DELETE /api/scheduling/video-configs/[id] — soft-delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await authorize(params.id);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  await prisma.videoConferenceConfig.update({
    where: { id: params.id },
    data:  { isActive: false, updatedBy: result.userId }
  });
  return NextResponse.json({ success: true });
}
