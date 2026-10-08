import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureOwnWorkspace } from '@/lib/onboarding'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const findWorkspaces = () => prisma.workspace.findMany({
            where: {
                OR: [
                    { ownerId: session.user.id },
                    {
                        members: {
                            some: {
                                userId: session.user.id,
                            },
                        },
                    },
                ],
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        pages: true,
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        })

        let workspaces = await findWorkspaces()
        // Every account has a workspace of its own; give one back to an account without.
        if (workspaces.length === 0 && await ensureOwnWorkspace(session.user.id, session.user.businessType)) {
            workspaces = await findWorkspaces()
        }

        return NextResponse.json({ workspaces })
    } catch (error) {
        console.error('Error fetching workspaces:', error)
        return NextResponse.json(
            { error: 'Something went wrong' },
            { status: 500 }
        )
    }
}

/**
 * Workspaces are no longer created by hand: each account gets one at sign-up
 * (src/lib/onboarding.ts) and joins others only by invitation.
 */
export async function POST() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
        { error: 'Each account has a single workspace. Invite people to it instead of creating another.' },
        { status: 403 }
    )
}
