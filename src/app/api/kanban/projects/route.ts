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

        if (!workspaceId) {
            return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
        }

        // Verify access
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

        const projects = await prisma.kanbanProject.findMany({
            where: { workspaceId },
            orderBy: { order: 'asc' },
            include: {
                _count: { select: { cards: true } },
            },
        });

        return NextResponse.json(projects);
    } catch (error) {
        console.error('Error fetching kanban projects:', error);
        return NextResponse.json({ error: 'Failed to fetch kanban projects' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, description, color, workspaceId } = body;

        if (!name || !workspaceId) {
            return NextResponse.json({ error: 'Name and workspace ID are required' }, { status: 400 });
        }

        // Verify access
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

        // Get next order
        const highest = await prisma.kanbanProject.findFirst({
            where: { workspaceId },
            orderBy: { order: 'desc' },
            select: { order: true },
        });

        const project = await prisma.kanbanProject.create({
            data: {
                name,
                description: description || null,
                color: color || null,
                workspaceId,
                order: (highest?.order ?? 0) + 1,
            },
            include: {
                _count: { select: { cards: true } },
            },
        });

        return NextResponse.json(project, { status: 201 });
    } catch (error) {
        console.error('Error creating kanban project:', error);
        return NextResponse.json({ error: 'Failed to create kanban project' }, { status: 500 });
    }
}
