import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkWorkspacePermission, getWorkspaceMembership } from '@/lib/workspace'

/**
 * PATCH /api/workspaces/[id]/members/[memberId]
 * Update a member's role
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = params.id
    const memberId = params.memberId
    const body = await request.json()
    const { role } = body

    // Validate role
    const validRoles = ['owner', 'admin', 'member', 'viewer']
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Valid role is required (${validRoles.join(', ')})` },
        { status: 400 }
      )
    }

    // Check if user has permission to manage members
    const hasPermission = await checkWorkspacePermission(
      workspaceId,
      session.user.id,
      'workspace:manage_members'
    )

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to update member roles" },
        { status: 403 }
      )
    }

    // Find the member to update
    const member = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
      include: {
        user: true,
      },
    })

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    // Verify member belongs to this workspace
    if (member.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: 'Member does not belong to this workspace' },
        { status: 400 }
      )
    }

    // Cannot change owner role
    if (member.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot change owner role' },
        { status: 400 }
      )
    }

    // Cannot assign owner role
    if (role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot assign owner role. Transfer ownership instead.' },
        { status: 400 }
      )
    }

    // Get current user's membership
    const currentUserMembership = await getWorkspaceMembership(
      workspaceId,
      session.user.id
    )

    // Admins cannot change other admins' roles
    if (
      currentUserMembership?.role === 'admin' &&
      member.role === 'admin'
    ) {
      return NextResponse.json(
        { error: "Admins cannot change other admins' roles" },
        { status: 403 }
      )
    }

    // Update member role
    const updatedMember = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        message: 'Member role updated successfully',
        member: updatedMember,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error updating member role:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workspaces/[id]/members/[memberId]
 * Remove a member from the workspace
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = params.id
    const memberId = params.memberId

    // Find the member to remove
    const member = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
    })

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    // Verify member belongs to this workspace
    if (member.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: 'Member does not belong to this workspace' },
        { status: 400 }
      )
    }

    // Cannot remove owner
    if (member.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove workspace owner' },
        { status: 400 }
      )
    }

    // Check if user has permission to remove members
    const hasPermission = await checkWorkspacePermission(
      workspaceId,
      session.user.id,
      'workspace:manage_members'
    )

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to remove this member" },
        { status: 403 }
      )
    }

    // Get current user's membership
    const currentUserMembership = await getWorkspaceMembership(
      workspaceId,
      session.user.id
    )

    // Admins cannot remove other admins
    if (
      currentUserMembership?.role === 'admin' &&
      member.role === 'admin'
    ) {
      return NextResponse.json(
        { error: 'Admins cannot remove other admins' },
        { status: 403 }
      )
    }

    // Remove member
    await prisma.workspaceMember.delete({
      where: { id: memberId },
    })

    return NextResponse.json(
      { message: 'Member removed successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
