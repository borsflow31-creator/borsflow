import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  checkWorkspacePermission,
  generateSecureToken,
  getInvitationExpiration,
  isValidInvitationRole,
} from '@/lib/workspace'
import { isValidEmail } from '@/lib/email'
import {
  consumeRateLimits,
  invitationLimitTargets,
  rateLimitedResponse,
} from '@/lib/api/rate-limit'
import { isSendableTransactional } from '@/lib/email/suppression'
import { deliverInvitationEmail } from '@/lib/invitation-delivery'

/**
 * POST /api/workspaces/[id]/invitations
 * Send an invitation to a user to join a workspace
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

    const workspaceId = params.id
    const body = await request.json()
    const { email: rawEmail, role } = body
    const email =
      typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail

    // Validate email
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      )
    }

    // Validate role
    if (!role || !isValidInvitationRole(role)) {
      return NextResponse.json(
        { error: 'Valid role is required (admin, member, or viewer)' },
        { status: 400 }
      )
    }

    // Check if user has permission to send invitations
    const hasPermission = await checkWorkspacePermission(
      workspaceId,
      session.user.id,
      'workspace:invite'
    )

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to send invitations" },
        { status: 403 }
      )
    }

    // Get workspace details
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: true,
      },
    })

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    // The owner has no WorkspaceMember row, so check them separately.
    if ((workspace.owner.email ?? '').toLowerCase() === email) {
      return NextResponse.json(
        { error: 'This user already owns this workspace' },
        { status: 400 }
      )
    }

    if ((session.user.email ?? '').toLowerCase() === email) {
      return NextResponse.json(
        { error: 'You are already a member of this workspace' },
        { status: 400 }
      )
    }

    // Check if user is already a member
    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        user: { email: { equals: email, mode: 'insensitive' } },
      },
    })

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this workspace' },
        { status: 400 }
      )
    }

    // Only a *live* pending invitation blocks a new one. An expired row is
    // still `pending` until the cron job sweeps it, so check the date too.
    const existingInvitation = await prisma.invitation.findUnique({
      where: { workspaceId_email: { workspaceId, email } },
    })

    if (
      existingInvitation &&
      existingInvitation.status === 'pending' &&
      existingInvitation.expiresAt > new Date()
    ) {
      return NextResponse.json(
        { error: 'Invitation already sent to this email' },
        { status: 400 }
      )
    }

    // Charge this against the sender's and the workspace's invitation budgets.
    // It runs after every validation above, so a rejected attempt costs nothing,
    // and before anything is written or sent.
    const limit = await consumeRateLimits(
      invitationLimitTargets(session.user.id, workspaceId),
      1
    )
    if (!limit.allowed) {
      return rateLimitedResponse(limit, 1)
    }

    // Generate token and expiration
    const token = generateSecureToken()
    const expiresAt = getInvitationExpiration(7)

    // [workspaceId, email] is unique, so a declined/expired invitation has to be
    // revived rather than re-created - otherwise re-inviting someone who said no
    // (or let the link lapse) fails on the constraint and surfaces as a 500.
    const invitation = await prisma.invitation.upsert({
      where: { workspaceId_email: { workspaceId, email } },
      create: {
        email,
        role,
        workspaceId,
        senderId: session.user.id,
        token,
        expiresAt,
      },
      update: {
        role,
        senderId: session.user.id,
        token,
        expiresAt,
        status: 'pending',
        respondedAt: null,
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

    // Send invitation email. The invitation is kept even when delivery fails or
    // the address is suppressed, so the admin can still hand over the link.
    const delivery = await deliverInvitationEmail(
      invitation,
      await isSendableTransactional(invitation.email, workspaceId)
    )

    // The token is the invitee's bearer credential; it belongs in the email only.
    const { token: _token, ...safeInvitation } = invitation

    return NextResponse.json(
      {
        invitation: safeInvitation,
        emailSent: delivery.emailSent,
        emailError: delivery.emailSent ? undefined : delivery.emailError,
        emailFailureReason: delivery.emailSent ? undefined : delivery.reason,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating invitation:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/workspaces/[id]/invitations
 * Get all invitations for a workspace
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = params.id
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Check if user has permission to view invitations
    const hasPermission = await checkWorkspacePermission(
      workspaceId,
      session.user.id,
      'workspace:invite'
    )

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to view invitations" },
        { status: 403 }
      )
    }

    // Build where clause
    const where: any = { workspaceId }
    if (status) {
      where.status = status
    }

    // Get invitations
    const invitations = await prisma.invitation.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Never send invitation tokens to the browser: each is a bearer credential.
    return NextResponse.json({ invitations: invitations.map(({ token: _token, ...rest }) => rest) })
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
