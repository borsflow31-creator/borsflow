import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const pipeline = await prisma.pipeline.findUnique({
            where: { id: params.id },
            include: {
                _count: {
                    select: { leads: true }
                }
            },
        });

        if (!pipeline) {
            return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
        }

        // Verify user has access to the workspace
        const workspace = await prisma.workspace.findFirst({
            where: {
                id: pipeline.workspaceId,
                OR: [
                    { ownerId: session.user.id },
                    { members: { some: { userId: session.user.id } } },
                ],
            },
        });

        if (!workspace) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Parse stages JSON
        const pipelineWithParsedStages = {
            ...pipeline,
            stages: JSON.parse(pipeline.stages)
        };

        return NextResponse.json(pipelineWithParsedStages);
    } catch (error) {
        console.error('Error fetching pipeline:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pipeline' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, description, color, stages, stageRenames } = body;

        // Verify user has access to the pipeline's workspace
        const pipeline = await prisma.pipeline.findUnique({
            where: { id: params.id },
        });

        if (!pipeline) {
            return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
        }

        const workspace = await prisma.workspace.findFirst({
            where: {
                id: pipeline.workspaceId,
                OR: [
                    { ownerId: session.user.id },
                    { members: { some: { userId: session.user.id } } },
                ],
            },
        });

        if (!workspace) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Membership is not enough to change content: viewers are read-only.
        if (!(await canEditContent(workspace.id, session.user.id))) {
            return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
        }

        if (stages !== undefined) {
            const valid = Array.isArray(stages)
                && stages.length > 0
                && stages.every((s: unknown) => typeof s === 'string' && s.trim().length > 0)
                && new Set(stages).size === stages.length;
            if (!valid) {
                return NextResponse.json(
                    { error: 'Stages must be a non-empty list of unique, non-empty names' },
                    { status: 400 }
                );
            }
        }

        // A rename arrives as an explicit { from, to } pair. Without it a rename is
        // indistinguishable from removing one stage and adding another, which would
        // dump every lead in that column into stages[0].
        const renames: Array<{ from: string; to: string }> = Array.isArray(stageRenames)
            ? stageRenames.filter(
                (r: any) =>
                    r && typeof r.from === 'string' && typeof r.to === 'string'
                    && r.from.trim().length > 0 && r.to.trim().length > 0
                    && r.from !== r.to
            )
            : [];

        // Update pipeline; leads sitting in a removed stage are moved to the first
        // remaining stage so they don't disappear from the board.
        const updatedPipeline = await prisma.$transaction(async (tx) => {
            if (stages !== undefined) {
                let previousStages: string[] = [];
                try {
                    const parsed = JSON.parse(pipeline.stages);
                    if (Array.isArray(parsed)) previousStages = parsed;
                } catch {
                    previousStages = [];
                }

                // Apply renames first: leads and automation triggers follow the stage
                // to its new name, so it no longer looks "removed" below.
                for (const { from, to } of renames) {
                    if (!previousStages.includes(from) || !stages.includes(to)) continue;

                    await tx.lead.updateMany({
                        where: { pipelineId: params.id, stage: from },
                        data: { stage: to },
                    });

                    const triggers = await tx.automationTrigger.findMany({
                        where: {
                            type: 'stage_changed',
                            automation: { workspaceId: pipeline.workspaceId },
                        },
                        select: { id: true, conditions: true },
                    });

                    for (const trigger of triggers) {
                        let conditions: any;
                        try {
                            conditions = JSON.parse(trigger.conditions);
                        } catch {
                            continue;
                        }
                        if (!conditions || typeof conditions !== 'object') continue;
                        // Only retarget triggers bound to this pipeline (or to no
                        // pipeline in particular, which matches every pipeline).
                        if (conditions.pipelineId && conditions.pipelineId !== params.id) continue;

                        let changed = false;
                        if (conditions.toStage === from) { conditions.toStage = to; changed = true; }
                        if (conditions.fromStage === from) { conditions.fromStage = to; changed = true; }
                        if (!changed) continue;

                        await tx.automationTrigger.update({
                            where: { id: trigger.id },
                            data: { conditions: JSON.stringify(conditions) },
                        });
                    }

                    previousStages = previousStages.map(s => (s === from ? to : s));
                }

                const removed = previousStages.filter(s => !stages.includes(s));
                if (removed.length > 0) {
                    // Note: this is an admin edit, not a sales event — deliberately no
                    // automation dispatch. Triggers fire only from PUT /api/leads/[id].
                    const moved = await tx.lead.updateMany({
                        where: { pipelineId: params.id, stage: { in: removed } },
                        data: { stage: stages[0] },
                    });

                    if (moved.count > 0) {
                        const column = await tx.lead.findMany({
                            where: { pipelineId: params.id, stage: stages[0] },
                            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
                            select: { id: true },
                        });
                        // Sequential: see note in /api/leads/[id]
                        for (const [position, l] of column.entries()) {
                            await tx.lead.update({ where: { id: l.id }, data: { order: position } });
                        }
                    }
                }
            }

            return tx.pipeline.update({
                where: { id: params.id },
                data: {
                    ...(name !== undefined && { name }),
                    ...(description !== undefined && { description }),
                    ...(color !== undefined && { color }),
                    ...(stages !== undefined && { stages: JSON.stringify(stages) }),
                },
            });
        });

        // Parse stages for response
        const pipelineWithParsedStages = {
            ...updatedPipeline,
            stages: JSON.parse(updatedPipeline.stages)
        };

        return NextResponse.json(pipelineWithParsedStages);
    } catch (error) {
        console.error('Error updating pipeline:', error);
        return NextResponse.json(
            { error: 'Failed to update pipeline' },
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

        // Verify user has access to the pipeline's workspace
        const pipeline = await prisma.pipeline.findUnique({
            where: { id: params.id },
        });

        if (!pipeline) {
            return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
        }

        const workspace = await prisma.workspace.findFirst({
            where: {
                id: pipeline.workspaceId,
                OR: [
                    { ownerId: session.user.id },
                    { members: { some: { userId: session.user.id } } },
                ],
            },
        });

        if (!workspace) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Membership is not enough to change content: viewers are read-only.
        if (!(await canEditContent(workspace.id, session.user.id))) {
            return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
        }

        // Delete pipeline (leads and their lead-list links cascade at the DB level)
        await prisma.pipeline.delete({
            where: { id: params.id },
        });

        return NextResponse.json({ message: 'Pipeline deleted successfully' });
    } catch (error) {
        console.error('Error deleting pipeline:', error);
        return NextResponse.json(
            { error: 'Failed to delete pipeline' },
            { status: 500 }
        );
    }
}
