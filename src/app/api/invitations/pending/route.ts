export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/invitations/pending
 * Get all pending invitations for the current user
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get pending, unexpired invitations for this email. Invitations are stored
    // lowercased while user rows are not normalised, so match case-insensitively
    // or the recipient never sees their own invitation.
    const invitations = await prisma.invitation.findMany({
      where: {
        email: (user.email ?? '').toLowerCase(),
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      // Explicit `select`, deliberately: this list is rendered in the browser, so
      // it must never carry `token` (the bearer credential for the emailed link)
      // or the workspace owner's email. Accept/decline authorize by session.
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        workspace: {
          select: { id: true, name: true, icon: true },
        },
        sender: {
          select: { name: true, email: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ invitations })
  } catch (error) {
    console.error('Error fetching pending invitations:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
