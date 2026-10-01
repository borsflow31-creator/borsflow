import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';
import { notify } from '@/lib/notifications/notify';

/** `assignees` is stored as a JSON-stringified array of user ids. */
function parseAssignees(value: string | null): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
        return [];
    }
}

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
        const { title, description, status, priority, tags, dueDate, assignees, order, projectId } = body;

        // Columns are todo / inprogress / done. Any other status used to be saved and
        // the card then vanished from the board, since no column matched it.
        if (status !== undefined && !['todo', 'inprogress', 'done'].includes(status)) {
            return NextResponse.json({ error: 'Status must be one of: todo, inprogress, done' }, { status: 400 });
        }

        // Verify card exists and user has access
        const card = await prisma.kanbanCard.findFirst({
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

        if (!card) {
            return NextResponse.json({ error: 'Card not found or access denied' }, { status: 404 });
        }

        // Membership is not enough to change content: viewers are read-only.
        if (!(await canEditContent(card.workspaceId, session.user.id))) {
            return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
        }

        // If moving to a project, verify it belongs to the same workspace
        if (projectId) {
            const project = await prisma.kanbanProject.findFirst({
                where: { id: projectId, workspaceId: card.workspaceId },
            });
            if (!project) {
                return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
            }
        }

        // Update card
        const updatedCard = await prisma.kanbanCard.update({
            where: { id: params.id },
            data: {
                ...(title && { title }),
                ...(description !== undefined && { description }),
                ...(status && { status }),
                ...(priority && { priority }),
                ...(tags !== undefined && { tags: tags ? JSON.stringify(tags) : null }),
                ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
                ...(assignees !== undefined && { assignees: assignees ? JSON.stringify(assignees) : null }),
                ...(order !== undefined && { order }),
                ...(projectId !== undefined && { projectId: projectId || null }),
            },
            include: {
                project: {
                    select: { id: true, name: true, color: true },
                },
            },
        });

        // Fire-and-forget: notify only the assignees newly added by this update,
        // not ones who were already on the card.
        if (assignees !== undefined) {
            const before = new Set(parseAssignees(card.assignees));
            const after = parseAssignees(updatedCard.assignees);
            const newlyAssigned = after.filter((id) => !before.has(id));
            if (newlyAssigned.length > 0) {
                void notify({
                    recipients: newlyAssigned,
                    type: 'tasks.card_assigned',
                    workspaceId: card.workspaceId,
                    actorId: session.user.id,
                    title: `You were assigned to "${updatedCard.title}"`,
                    href: `/kanban-board-view?workspace=${card.workspaceId}`,
                });
            }
        }

        return NextResponse.json(updatedCard);
    } catch (error) {
        console.error('Error updating kanban card:', error);
        return NextResponse.json(
            { error: 'Failed to update kanban card' },
            { status: 500 }
        );
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

        // Verify card exists and user has access
        const card = await prisma.kanbanCard.findFirst({
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

        if (!card) {
            return NextResponse.json({ error: 'Card not found or access denied' }, { status: 404 });
        }

        // Membership is not enough to change content: viewers are read-only.
        if (!(await canEditContent(card.workspaceId, session.user.id))) {
            return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
        }

        // Delete card
        await prisma.kanbanCard.delete({
            where: { id: params.id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting kanban card:', error);
        return NextResponse.json(
            { error: 'Failed to delete kanban card' },
            { status: 500 }
        );
    }
}
