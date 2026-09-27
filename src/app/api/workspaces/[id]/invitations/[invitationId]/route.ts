import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  checkWorkspacePermission,
  generateSecureToken,
  getInvitationExpiration,
} from '@/lib/workspace'
import { isSendableTransactional } from '@/lib/email/suppression'
import { deliverInvitationEmail } from '@/lib/invitation-delivery'
import {
  consumeRateLimits,
  invitationLimitTargets,
  rateLimitedResponse,
} from '@/lib/api/rate-limit'

/**
 * DELETE /api/workspaces/[id]/invitations/[invitationId]
 * Cancel a workspace invitation
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; invitationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = params.id
    const invitationId = params.invitationId

    // Check if user has permission to cancel invitations
    const hasPermission = await checkWorkspacePermission(
      workspaceId,
      session.user.id,
      'workspace:invite'
    )

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to cancel this invitation" },
        { status: 403 }
      )
    }

    // Find invitation
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // Verify invitation belongs to this workspace
    if (invitation.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: 'Invitation does not belong to this workspace' },
        { status: 400 }
      )
    }

    // Delete invitation
    await prisma.invitation.delete({
      where: { id: invitationId },
    })

    return NextResponse.json(
      { message: 'Invitation cancelled successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error cancelling invitation:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workspaces/[id]/invitations/[invitationId]/resend
 * Resend a workspace invitation
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string; invitationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = params.id
    const invitationId = params.invitationId

    // Check if user has permission to resend invitations
    const hasPermission = await checkWorkspacePermission(
      workspaceId,
      session.user.id,
      'workspace:invite'
    )

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to resend this invitation" },
        { status: 403 }
      )
    }

    // Find invitation
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        workspace: {
          include: {
            owner: true,
          },
        },
        sender: true,
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // Verify invitation belongs to this workspace
    if (invitation.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: 'Invitation does not belong to this workspace' },
        { status: 400 }
      )
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Cannot resend invitation that is not pending' },
        { status: 400 }
      )
    }

    // Resend counts against the same budget as a first send. It is the cheapest
    // way to spam an address - one click, one email, and no new row - so leaving
    // it out would make the limit decorative.
    const limit = await consumeRateLimits(
      invitationLimitTargets(session.user.id, workspaceId),
      1
    )
    if (!limit.allowed) {
      return rateLimitedResponse(limit, 1)
    }

    // Generate new token and expiration
    const newToken = generateSecureToken()
    const newExpiresAt = getInvitationExpiration(7)

    // Update invitation
    const updatedInvitation = await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt,
      },
      include: {
        workspace: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Send invitation email. Continue even if it fails - the invitation is still
    // renewed - but report it, so the sender isn't told a mail went out that
    // never did.
    const delivery = await deliverInvitationEmail(
      updatedInvitation,
      await isSendableTransactional(updatedInvitation.email, workspaceId)
    )

    return NextResponse.json(
      {
        message: 'Invitation resent successfully',
        invitation: (({ token: _token, ...rest }) => rest)(updatedInvitation),
        emailSent: delivery.emailSent,
        emailError: delivery.emailSent ? undefined : delivery.emailError,
        emailFailureReason: delivery.emailSent ? undefined : delivery.reason,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error resending invitation:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
