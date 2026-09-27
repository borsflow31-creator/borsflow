import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const workspaceId = searchParams.get('workspaceId');
        const projectId = searchParams.get('projectId'); // optional filter

        if (!workspaceId) {
            return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
        }

        // Verify user has access to workspace
        const workspace = await prisma.workspace.findFirst({
            where: {
                id: workspaceId,
                OR: [
                    { ownerId: session.user.id },
                    { members: { some: { userId: session.user.id } } },
                ],
            },
        });

        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 });
        }

        // Fetch kanban cards — optionally scoped to a project
        const cards = await prisma.kanbanCard.findMany({
            where: {
                workspaceId,
                ...(projectId ? { projectId } : {}),
            },
            orderBy: { order: 'asc' },
            include: {
                project: {
                    select: {
                        id: true,
                        name: true,
                        color: true,
                    },
                },
            },
        });

        return NextResponse.json(cards);
    } catch (error) {
        console.error('Error fetching kanban cards:', error);
        return NextResponse.json(
            { error: 'Failed to fetch kanban cards' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { title, description, status, priority, tags, workspaceId, projectId, dueDate, assignees } = body;

        if (!title || !workspaceId) {
            return NextResponse.json(
                { error: 'Title and workspace ID are required' },
                { status: 400 }
            );
        }

        // Verify user has access to workspace
        const workspace = await prisma.workspace.findFirst({
            where: {
                id: workspaceId,
                OR: [
                    { ownerId: session.user.id },
                    { members: { some: { userId: session.user.id } } },
                ],
            },
        });

        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 });
        }

        // Membership is not enough to change content: viewers are read-only.
        if (!(await canEditContent(workspace.id, session.user.id))) {
            return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
        }

        const cardStatus = status || 'todo';
        if (!['todo', 'inprogress', 'done'].includes(cardStatus)) {
            return NextResponse.json({ error: 'Status must be one of: todo, inprogress, done' }, { status: 400 });
        }

        // The project must belong to this workspace. Otherwise a card could be
        // attached to another workspace's project and inflate its card count.
        if (projectId) {
            const project = await prisma.kanbanProject.findFirst({
                where: { id: projectId, workspaceId },
                select: { id: true },
            });
            if (!project) {
                return NextResponse.json({ error: 'Project not found in this workspace' }, { status: 400 });
            }
        }

        // Get the highest order within this workspace/status/project column
        const highestOrder = await prisma.kanbanCard.findFirst({
            where: { workspaceId, status: cardStatus, ...(projectId ? { projectId } : {}) },
            orderBy: { order: 'desc' },
            select: { order: true },
        });

        const newOrder = (highestOrder?.order ?? -1) + 1;

        // Create new kanban card
        const card = await prisma.kanbanCard.create({
            data: {
                title,
                description,
                status: cardStatus,
                priority: priority || 'medium',
                tags: tags ? JSON.stringify(tags) : null,
                workspaceId,
                projectId: projectId || null,
                dueDate: dueDate ? new Date(dueDate) : null,
                assignees: assignees ? JSON.stringify(assignees) : null,
                order: newOrder,
            },
            include: {
                project: {
                    select: { id: true, name: true, color: true },
                },
            },
        });

        return NextResponse.json(card, { status: 201 });
    } catch (error) {
        console.error('Error creating kanban card:', error);
        return NextResponse.json(
            { error: 'Failed to create kanban card' },
            { status: 500 }
        );
    }
}
