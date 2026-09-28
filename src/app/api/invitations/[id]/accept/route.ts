import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isInvitationExpired } from '@/lib/workspace'
import { getMemberUsage, planLimitResponse } from '@/lib/billing/entitlements'

/**
 * POST /api/invitations/[id]/accept
 * Accept a workspace invitation
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invitationId = params.id
    // The token is optional: the emailed link carries one, but an in-app accept
    // from the pending list does not (that endpoint no longer exposes tokens).
    // Without it, the session + email-match check below is what authorizes.
    const body = await request.json().catch(() => ({}))
    const { token } = body as { token?: string }

    // Find invitation
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        workspace: true,
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // Validate token, when one was supplied
    if (token && invitation.token !== token) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 400 }
      )
    }

    // Check status
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Invitation is not pending' },
        { status: 400 }
      )
    }

    // Check expiration
    if (isInvitationExpired(invitation.expiresAt)) {
      // Update invitation status to expired
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { status: 'expired' },
      })
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      )
    }

    // Get user's email
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify email match. Invitations are stored lowercased while user rows are
    // not normalised, so compare case-insensitively or legitimate recipients are
    // locked out of their own invitation.
    if ((user.email ?? '').toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: "You don't have permission to accept this invitation" },
        { status: 403 }
      )
    }

    // The workspace owner has no WorkspaceMember row, so check ownership too.
    if (invitation.workspace.ownerId === session.user.id) {
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { status: 'accepted', respondedAt: new Date() },
      })
      return NextResponse.json(
        {
          message: 'You already own this workspace',
          workspace: {
            id: invitation.workspace.id,
            name: invitation.workspace.name,
            icon: invitation.workspace.icon,
          },
          membership: null,
        },
        { status: 200 }
      )
    }

    // The cap was checked when the invitation was sent, but the plan may have
    // changed since (a downgrade, or packs removed). This invitation is itself
    // pending, so only existing members count against the cap here.
    const alreadyMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId: session.user.id,
        },
      },
      select: { id: true },
    })
    if (!alreadyMember) {
      const usage = await getMemberUsage(invitation.workspaceId)
      if (usage.capacity !== null && usage.members >= usage.capacity) {
        return planLimitResponse({
          kind: 'members',
          limit: usage.capacity,
          used: usage.members,
          message: `${invitation.workspace.name} has reached its plan's limit of ${usage.capacity} members. Ask the workspace owner to make room.`,
        })
      }
    }

    // Create the membership and close out the invitation atomically, so a
    // failure can't leave an accepted invitation with no membership behind it.
    // `upsert` keeps a repeat click (or an already-joined user) from tripping
    // the [workspaceId, userId] unique constraint and returning a 500.
    const [membership] = await prisma.$transaction([
      prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId: session.user.id,
          },
        },
        create: {
          workspaceId: invitation.workspaceId,
          userId: session.user.id,
          role: invitation.role,
        },
        update: {},
      }),
      prisma.invitation.update({
        where: { id: invitationId },
        data: {
          status: 'accepted',
          respondedAt: new Date(),
        },
      }),
    ])

    return NextResponse.json(
      {
        message: 'Invitation accepted successfully',
        workspace: {
          id: invitation.workspace.id,
          name: invitation.workspace.name,
          icon: invitation.workspace.icon,
        },
        membership,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error accepting invitation:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
