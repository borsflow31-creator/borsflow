import { NextRequest, NextResponse } from 'next/server';
import { leadStatusForStage } from '@/lib/crm/lead-status';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace';
import { CrmLogger } from '@/lib/crm/logger';
import { reorderInColumn } from '@/lib/crm/reorder';
import { onSubjectStageChanged } from '@/lib/crm/subject-events';
import { parseStages } from '@/lib/crm/lifecycle';
import { scoreLead } from '@/lib/crm/lead-score';
import { readDeveloperLeadFields, readLotInterests } from '@/lib/services/leads';
import { PICKER_LOT_SELECT } from '@/lib/services/developer/lot-picker';
import { ServiceError } from '@/lib/services/errors';
import { getSupabaseAdmin, CRM_BUCKET } from '@/lib/supabase-admin';

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
                },
                lotInterests: { select: { lot: { select: PICKER_LOT_SELECT } }, orderBy: { createdAt: 'asc' } },
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
        const { lotInterests, ...rest } = lead;
        const leadWithParsedData = {
            ...rest,
            tags: lead.tags ? JSON.parse(lead.tags) : [],
            leadLists: lead.leadLists.map(l => l.leadList),
            interestedLots: lotInterests.map(i => i.lot),
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

        // Developer-only fields: owner, brief, project of interest. Absent leaves
        // them alone, so the agency form (which never sends them) is unaffected.
        const developer = await readDeveloperLeadFields(lead.pipeline.workspaceId, body, lead);

        // Units of interest, sent as the full set. Ones already on the lead stay
        // allowed after they sell, so an old lead can still be saved.
        const currentLotIds = body.interestedLotIds === undefined
            ? []
            : (await prisma.leadLotInterest.findMany({ where: { leadId: params.id }, select: { lotId: true } }))
                .map(i => i.lotId);
        const lots = await readLotInterests(
            lead.pipeline.workspaceId,
            body,
            developer.interestedProgramId !== undefined ? developer.interestedProgramId : lead.interestedProgramId,
            currentLotIds
        );
        if (lots.lotIds?.length && lots.programId !== lead.interestedProgramId) {
            developer.interestedProgramId = lots.programId;
        }

        // The score follows whatever the lead will look like after this save.
        const { score } = scoreLead({
            email: email !== undefined ? email : lead.email,
            phone: phone !== undefined ? phone : lead.phone,
            budgetMin: developer.budgetMin !== undefined ? developer.budgetMin : lead.budgetMin,
            budgetMax: developer.budgetMax !== undefined ? developer.budgetMax : lead.budgetMax,
            interestedProgramId:
                developer.interestedProgramId !== undefined ? developer.interestedProgramId : lead.interestedProgramId,
            interestedTypology:
                developer.interestedTypology !== undefined ? developer.interestedTypology : lead.interestedTypology,
            source: source !== undefined ? source : lead.source,
            stage: stage !== undefined ? stage : lead.stage,
            stages: parseStages(lead.pipeline.stages),
            lastContactedAt: lead.lastContactedAt,
        });

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
            // A built-in stage sets the status; a custom one keeps the status sent (or stored).
            ...(status !== undefined && { status }),
            ...(stage !== undefined && { stage }),
            ...(leadStatusForStage(stage) && { status: leadStatusForStage(stage)! }),
            ...(parsedValue !== undefined && { value: parsedValue }),
            ...(source !== undefined && { source }),
            ...(notes !== undefined && { notes }),
            ...developer,
            score,
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
                await reorderInColumn(tx, 'Lead', {
                    id: params.id,
                    pipelineId: lead.pipelineId,
                    stage: targetStage,
                    order,
                });
            });
        } else {
            await prisma.lead.update({ where: { id: params.id }, data });
        }

        if (lots.lotIds) {
            const lotIds = lots.lotIds;
            await prisma.$transaction([
                prisma.leadLotInterest.deleteMany({ where: { leadId: params.id, lotId: { notIn: lotIds } } }),
                prisma.leadLotInterest.createMany({
                    data: lotIds.map(lotId => ({
                        workspaceId: lead.pipeline.workspaceId,
                        leadId: params.id,
                        lotId,
                        createdById: session.user.id,
                    })),
                    skipDuplicates: true,
                }),
            ]);
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

        await CrmLogger.logUpdated({
            workspaceId: lead.pipeline.workspaceId,
            userId: session.user.id,
            leadId: params.id,
            leadName: `${lead.firstName} ${lead.lastName}`.trim(),
            before: { ...lead, tags: lead.tags ? JSON.parse(lead.tags) : [] },
            after: {
                ...data,
                ...(data.tags !== undefined && { tags: data.tags ? JSON.parse(data.tags) : [] }),
            },
        });

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
                onSubjectStageChanged({
                    subjectType: 'Lead',
                    subjectId: params.id,
                    pipelineId: lead.pipelineId,
                    workspaceId: lead.pipeline.workspaceId,
                    fromStage: lead.stage,
                    toStage: stage as string,
                }),
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
        // A bad owner, project or budget is the caller's mistake, not a crash.
        if (error instanceof ServiceError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
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

        // Stored files go too; their database rows cascade with the lead
        const files = await prisma.leadFile.findMany({ where: { leadId: params.id }, select: { filePath: true } });

        // Delete lead (lead-list links cascade at the DB level)
        await prisma.lead.delete({
            where: { id: params.id },
        });

        if (files.length > 0) {
            const { error } = (await getSupabaseAdmin()?.storage.from(CRM_BUCKET).remove(files.map(f => f.filePath))) ?? { error: null };
            if (error) console.error('Failed to remove deleted lead files from storage:', error.message);
        }

        return NextResponse.json({ message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Error deleting lead:', error);
        return NextResponse.json(
            { error: 'Failed to delete lead' },
            { status: 500 }
        );
    }
}
