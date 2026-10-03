import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceRole, requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace';
import type { Role } from '@/lib/workspace';

export interface LeadAccess {
  lead: { id: string; firstName: string; lastName: string; email: string | null; pipelineId: string };
  workspaceId: string;
  userId: string;
  role: Role;
  /** Owner and admins can remove other people's files and notes */
  canModerate: boolean;
}

/**
 * Loads a prospect and checks the caller belongs to its workspace. Access is
 * derived from the record (lead -> pipeline -> workspace), never from the client.
 * `write` additionally requires content permission (viewers are read-only).
 */
export async function getLeadAccess(
  leadId: string,
  opts: { write?: boolean } = {}
): Promise<{ access: LeadAccess } | { error: NextResponse }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      pipelineId: true,
      pipeline: { select: { workspaceId: true } },
    },
  });
  if (!lead) return { error: NextResponse.json({ error: 'Prospect not found' }, { status: 404 }) };
  const workspaceId = lead.pipeline.workspaceId;

  const result = opts.write
    ? await requireWorkspacePermission(workspaceId, 'content:create')
    : await requireWorkspaceAccess(workspaceId);
  if ('error' in result) {
    return { error: NextResponse.json({ error: result.error }, { status: result.status }) };
  }

  const userId = result.session.user.id;
  const role: Role = 'role' in result && result.role ? (result.role as Role) : await getWorkspaceRole(workspaceId, userId);
  const { pipeline: _pipeline, ...leadFields } = lead;

  return {
    access: {
      lead: leadFields,
      workspaceId,
      userId,
      role,
      canModerate: role === 'owner' || role === 'admin',
    },
  };
}

export function leadDisplayName(lead: { firstName: string; lastName: string }) {
  return `${lead.firstName} ${lead.lastName}`.trim() || 'Prospect';
}
