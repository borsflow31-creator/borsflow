import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getWorkspaceMembership } from '@/lib/workspace'

/**
 * POST /api/workspaces/[id]/leave
 * Leave a workspace
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

    // Get user's membership
    const membership = await getWorkspaceMembership(
      workspaceId,
      session.user.id
    )

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this workspace' },
        { status: 404 }
      )
    }

    // Owner cannot leave workspace
    if (membership.role === 'owner') {
      return NextResponse.json(
        { error: 'Workspace owner cannot leave. Transfer ownership first.' },
        { status: 400 }
      )
    }

    // Remove membership
    await prisma.workspaceMember.delete({
      where: { id: membership.id },
    })

    return NextResponse.json(
      { message: 'You have left the workspace successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error leaving workspace:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
