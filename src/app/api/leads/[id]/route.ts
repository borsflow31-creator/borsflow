import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace';
import { automationEngine } from '@/lib/automation-engine';
import { CrmLogger } from '@/lib/crm/logger';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const lead = await prisma.lead.findUnique({
            where: { id: params.id },
            include: {
                pipeline: true,
                leadLists: {
                    include: {
                        leadList: true
                    }
                }
            },
        });

        if (!lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Verify user has access to the pipeline's workspace
        const access = await requireWorkspaceAccess(lead.pipeline.workspaceId);
        if ('error' in access) {
            return NextResponse.json({ error: access.error }, { status: access.status });
        }

        // Parse tags JSON and format lead lists
        const leadWithParsedData = {
            ...lead,
            tags: lead.tags ? JSON.parse(lead.tags) : [],
            leadLists: lead.leadLists.map(l => l.leadList)
        };

        return NextResponse.json(leadWithParsedData);
    } catch (error) {
        console.error('Error fetching lead:', error);
        return NextResponse.json(
            { error: 'Failed to fetch lead' },
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
        const {
            firstName,
            lastName,
            email,
            phone,
            company,
            position,
            status,
            stage,
            value,
            source,
            notes,
            tags,
            order,
            leadListIds
        } = body;

        // Verify user has access to the lead's pipeline
        const lead = await prisma.lead.findUnique({
            where: { id: params.id },
            include: { pipeline: true }
        });

        if (!lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        const access = await requireWorkspacePermission(lead.pipeline.workspaceId, 'content:create');
        if ('error' in access) {
            return NextResponse.json({ error: access.error }, { status: access.status });
        }

        // Lead lists must belong to the same workspace as the lead
        if (Array.isArray(leadListIds) && leadListIds.length > 0) {
            const uniqueListIds: string[] = Array.from(new Set(leadListIds as string[]));
            const validLists = await prisma.leadList.count({
                where: { id: { in: uniqueListIds }, workspaceId: lead.pipeline.workspaceId },
            });
            if (validLists !== uniqueListIds.length) {
                return NextResponse.json({ error: 'Invalid lead list' }, { status: 400 });
            }
        }

        // undefined = leave unchanged, null/empty = clear
        const parsedValue = value === undefined
            ? undefined
            : value === null || value === ''
                ? null
                : parseFloat(String(value));

        if (typeof parsedValue === 'number' && isNaN(parsedValue)) {
            return NextResponse.json({ error: 'Invalid value' }, { status: 400 });
        }

        const data = {
            ...(firstName !== undefined && { firstName }),
            ...(lastName !== undefined && { lastName }),
            ...(email !== undefined && { email }),
            ...(phone !== undefined && { phone }),
            ...(company !== undefined && { company }),
            ...(position !== undefined && { position }),
            ...(status !== undefined && { status }),
            ...(stage !== undefined && { stage }),
            ...(parsedValue !== undefined && { value: parsedValue }),
            ...(source !== undefined && { source }),
            ...(notes !== undefined && { notes }),
            ...(tags !== undefined && {
                tags: Array.isArray(tags) && tags.length > 0 ? JSON.stringify(tags) : null,
            }),
        };

        if (order !== undefined && typeof order === 'number') {
            // Drag & drop: place the lead at index `order` in its destination stage and
            // renumber that whole column so positions stay dense and unique.
            const targetStage: string = stage ?? lead.stage;
            await prisma.$transaction(async (tx) => {
                await tx.lead.update({ where: { id: params.id }, data });

                const siblings = await tx.lead.findMany({
                    where: {
                        pipelineId: lead.pipelineId,
                        stage: targetStage,
                        id: { not: params.id },
                    },
                    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
                    select: { id: true },
                });

                const index = Math.max(0, Math.min(Math.floor(order), siblings.length));
                const ids = siblings.map(l => l.id);
                ids.splice(index, 0, params.id);

                // Sequential: an interactive transaction runs on one connection and
                // cannot service concurrent queries.
                for (const [position, id] of ids.entries()) {
                    await tx.lead.update({ where: { id }, data: { order: position } });
                }
            });
        } else {
            await prisma.lead.update({ where: { id: params.id }, data });
        }

        // Update lead lists if provided
        // null or a non-array used to reach leadListIds.length and throw (500).
        if (Array.isArray(leadListIds)) {
            // Delete existing lead list associations
            await prisma.leadListLead.deleteMany({
                where: { leadId: params.id }
            });

            // Create new associations
            if (leadListIds.length > 0) {
                await prisma.leadListLead.createMany({
                    data: leadListIds.map((leadListId: string) => ({
                        leadId: params.id,
                        leadListId
                    }))
                });
            }
        }

        // A real stage change is the CRM signal email automations run on. Covers both
        // entry points: drag & drop sends { stage, order }, LeadModal sends { stage }.
        if (stage !== undefined && stage !== lead.stage) {
            const stageChange = {
                workspaceId: lead.pipeline.workspaceId,
                userId: session.user.id,
                leadId: params.id,
                pipelineId: lead.pipelineId,
                from: lead.stage,
                to: stage as string,
            };

            // Awaited rather than floated: on serverless the function may be frozen
            // once the response is returned, so a detached promise would be dropped.
            // allSettled keeps it non-fatal — a broken automation must never fail the
            // update and make the board roll the card back to its old column.
            await Promise.allSettled([
                CrmLogger.logStageChange({
                    ...stageChange,
                    leadName: `${lead.firstName} ${lead.lastName}`.trim(),
                }),
                // Exit before dispatch, so moving Proposal -> Negotiation ends the
                // Proposal sequence before the Negotiation one starts.
                automationEngine
                    .exitEnrollments(params.id, 'stage_changed')
                    .then(() =>
                        automationEngine.dispatchStageChanged({
                            leadId: params.id,
                            pipelineId: lead.pipelineId,
                            workspaceId: lead.pipeline.workspaceId,
                            fromStage: lead.stage,
                            toStage: stage as string,
                        })
                    ),
            ]).then(results => {
                for (const result of results) {
                    if (result.status === 'rejected') {
                        console.error('Stage-change hook failed:', result.reason);
                    }
                }
            });
        }

        // Fetch the updated lead with lead lists
        const leadWithLists = await prisma.lead.findUnique({
            where: { id: params.id },
            include: {
                pipeline: true,
                leadLists: {
                    include: {
                        leadList: true
                    }
                }
            }
        });

        // Parse tags JSON and format lead lists
        const leadWithParsedData = {
            ...leadWithLists,
            tags: leadWithLists?.tags ? JSON.parse(leadWithLists.tags) : [],
            leadLists: leadWithLists?.leadLists.map(l => l.leadList) || []
        };

        return NextResponse.json(leadWithParsedData);
    } catch (error) {
        console.error('Error updating lead:', error);
        return NextResponse.json(
            { error: 'Failed to update lead' },
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

        // Verify user has access to the lead's pipeline
        const lead = await prisma.lead.findUnique({
            where: { id: params.id },
            include: { pipeline: true }
        });

        if (!lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        const access = await requireWorkspacePermission(lead.pipeline.workspaceId, 'content:create');
        if ('error' in access) {
            return NextResponse.json({ error: access.error }, { status: access.status });
        }

        // Delete lead (lead-list links cascade at the DB level)
        await prisma.lead.delete({
            where: { id: params.id },
        });

        return NextResponse.json({ message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Error deleting lead:', error);
        return NextResponse.json(
            { error: 'Failed to delete lead' },
            { status: 500 }
        );
    }
}
