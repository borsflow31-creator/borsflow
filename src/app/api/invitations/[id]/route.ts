export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isInvitationExpired, validateToken } from '@/lib/workspace'

/**
 * GET /api/invitations/[id]?token=...
 * Preview an invitation from the emailed link.
 *
 * Intentionally does not require a session: the recipient often lands here
 * logged out (or with no account yet) and needs to see what they were invited
 * to before signing in. The token acts as the bearer credential, so nothing is
 * returned unless it matches.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token || !validateToken(token)) {
      return NextResponse.json(
        { error: 'This invitation link is not valid' },
        { status: 400 }
      )
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: params.id },
      include: {
        workspace: {
          select: { id: true, name: true, icon: true },
        },
        sender: {
          select: { name: true, email: true },
        },
      },
    })

    if (!invitation || invitation.token !== token) {
      return NextResponse.json(
        { error: 'This invitation link is not valid' },
        { status: 404 }
      )
    }

    // Lazily flip the row to `expired` so the UI and the cron job agree.
    let status = invitation.status
    if (status === 'pending' && isInvitationExpired(invitation.expiresAt)) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' },
      })
      status = 'expired'
    }

    const session = await getServerSession(authOptions)
    const sessionEmail = session?.user?.email?.toLowerCase() ?? null

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        workspace: invitation.workspace,
        sender: invitation.sender,
      },
      viewer: {
        isAuthenticated: Boolean(session?.user?.id),
        email: sessionEmail,
        emailMatches: sessionEmail !== null && sessionEmail === invitation.email,
      },
    })
  } catch (error) {
    console.error('Error loading invitation:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
