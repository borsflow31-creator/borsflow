import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isInvitationExpired } from '@/lib/workspace'

/**
 * POST /api/invitations/[id]/decline
 * Decline a workspace invitation
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
    // The token is optional: the emailed link carries one, but an in-app decline
    // from the pending list does not. Without it, the session + email-match
    // check below is what authorizes.
    const body = await request.json().catch(() => ({}))
    const { token } = body as { token?: string }

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
    // not normalised, so compare case-insensitively.
    if ((user.email ?? '').toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: "You don't have permission to decline this invitation" },
        { status: 403 }
      )
    }

    // Update invitation status
    const updatedInvitation = await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: 'declined',
        respondedAt: new Date(),
      },
    })

    return NextResponse.json(
      {
        message: 'Invitation declined successfully',
        invitation: {
          id: updatedInvitation.id,
          status: updatedInvitation.status,
          respondedAt: updatedInvitation.respondedAt,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error declining invitation:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
