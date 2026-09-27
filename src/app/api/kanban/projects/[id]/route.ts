import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, description, color } = body;

        // Verify project belongs to user's workspace
        const project = await prisma.kanbanProject.findFirst({
            where: {
                id: params.id,
                workspace: {
                    OR: [
                        { ownerId: session.user.id },
                        { members: { some: { userId: session.user.id } } },
                    ],
                },
            },
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
        }

        // Membership is not enough to change content: viewers are read-only.
        if (!(await canEditContent(project.workspaceId, session.user.id))) {
            return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
        }

        const updated = await prisma.kanbanProject.update({
            where: { id: params.id },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(color !== undefined && { color }),
            },
            include: {
                _count: { select: { cards: true } },
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating kanban project:', error);
        return NextResponse.json({ error: 'Failed to update kanban project' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify project belongs to user's workspace
        const project = await prisma.kanbanProject.findFirst({
            where: {
                id: params.id,
                workspace: {
                    OR: [
                        { ownerId: session.user.id },
                        { members: { some: { userId: session.user.id } } },
                    ],
                },
            },
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
        }

        // Membership is not enough to change content: viewers are read-only.
        if (!(await canEditContent(project.workspaceId, session.user.id))) {
            return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
        }

        // Delete all cards belonging to this project, then the project
        await prisma.kanbanCard.deleteMany({ where: { projectId: params.id } });
        await prisma.kanbanProject.delete({ where: { id: params.id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting kanban project:', error);
        return NextResponse.json({ error: 'Failed to delete kanban project' }, { status: 500 });
    }
}
