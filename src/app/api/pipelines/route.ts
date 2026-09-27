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

        // Fetch all pipelines for the workspace
        const pipelines = await prisma.pipeline.findMany({
            where: { workspaceId },
            include: {
                _count: {
                    select: { leads: true }
                }
            },
            orderBy: { order: 'asc' },
        });

        // Parse stages JSON
        const pipelinesWithParsedStages = pipelines.map(pipeline => ({
            ...pipeline,
            stages: JSON.parse(pipeline.stages)
        }));

        return NextResponse.json(pipelinesWithParsedStages);
    } catch (error) {
        console.error('Error fetching pipelines:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pipelines' },
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
        const { name, description, color, workspaceId, stages } = body;

        if (!name || !workspaceId) {
            return NextResponse.json(
                { error: 'Name and workspace ID are required' },
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

        // Get the highest order for this workspace
        const highestOrder = await prisma.pipeline.findFirst({
            where: { workspaceId },
            orderBy: { order: 'desc' },
            select: { order: true },
        });

        const newOrder = (highestOrder?.order ?? 0) + 1;

        // Default stages if not provided
        const defaultStages = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

        // Create new pipeline
        const pipeline = await prisma.pipeline.create({
            data: {
                name,
                description,
                color,
                workspaceId,
                stages: stages ? JSON.stringify(stages) : JSON.stringify(defaultStages),
                order: newOrder,
            },
        });

        // Parse stages for response
        const pipelineWithParsedStages = {
            ...pipeline,
            stages: JSON.parse(pipeline.stages)
        };

        return NextResponse.json(pipelineWithParsedStages, { status: 201 });
    } catch (error) {
        console.error('Error creating pipeline:', error);
        return NextResponse.json(
            { error: 'Failed to create pipeline' },
            { status: 500 }
        );
    }
}
