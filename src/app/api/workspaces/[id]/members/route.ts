import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWorkspaceAccess } from '@/lib/crm/access'
import { failure } from '@/lib/api/respond'
import { listWorkspaceMembers } from '@/lib/services/team/audit-log'

export const dynamic = 'force-dynamic'

/**
 * GET /api/workspaces/[id]/members
 * The team, with each person's role and last sign-in. Any member may read it;
 * `canManage` tells the page whether to offer role changes and removals.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const result = await getWorkspaceAccess(params.id)
    if ('error' in result) return result.error
    const { access } = result

    const [members, workspace] = await Promise.all([
      listWorkspaceMembers(params.id),
      prisma.workspace.findUnique({ where: { id: params.id }, select: { name: true } }),
    ])
    return NextResponse.json({
      workspaceName: workspace?.name ?? '',
      members,
      me: { userId: access.userId, role: access.role },
      canManage: access.canModerate,
    })
  } catch (error) {
    return failure(error, 'Failed to load members', 'Error loading workspace members')
  }
}
