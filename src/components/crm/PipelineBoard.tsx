'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Paperclip } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useI18n } from '@/i18n/I18nProvider';
import { pipelineLabel, stageLabel, statusLabel } from '@/components/crm/labels';
import { effectiveLeadStatus } from '@/lib/crm/lead-status';
import { useWorkspaceCurrency } from '@/components/developer/useWorkspaceCurrency';
import { FollowUpChip, OwnerAvatar, ScoreBadge } from '@/components/developer/lead-meta';
import { useWorkspaceAgents } from '@/components/developer/useWorkspaceAgents';
import { matchesOwnerFilter, type OwnerFilterValue } from '@/components/developer/OwnerFilter';
import { relativeTime } from '@/lib/relative-time';
import type { MessageKey } from '@/i18n/I18nProvider';
import { SUBJECT_ENDPOINTS } from '@/lib/crm/subjects';

/** The three kinds of card a board can hold. */
export type BoardSubjectType = 'Lead' | 'Interest' | 'Property';


interface Lead {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    company?: string;
    position?: string;
    status: string;
    stage: string;
    value?: number;
    source?: string;
    notes?: string;
    tags?: string[];
    pipelineId: string;
    order: number;
    leadLists?: any[];
    /** Number of attached files (from the leads list) */
    fileCount?: number;
    /** Most recent history entry */
    lastActivityAt?: string;
    // Developer CRM
    ownerId?: string | null;
    score?: number;
    nextFollowUpAt?: string | null;
}

/**
 * A card on any board. Every card shares `id`, `stage` and `order` -- where it
 * sits -- and the rest depends on the subject: a lead's name and contact details,
 * an interest's buyer and property, a property's price and vendor. Typed as a
 * lead with an open index so the original lead rendering stays checked, while the
 * other subjects are drawn by `renderCard`.
 */
type BoardCard = Lead & { [key: string]: any };

interface LeadList {
    id: string;
    name: string;
    description?: string;
    color?: string;
    workspaceId: string;
    order: number;
    leads?: Lead[];
    _count?: {
        leads: number;
    };
}

interface Pipeline {
    id: string;
    name: string;
    description?: string;
    color?: string;
    stages: string[];
    workspaceId: string;
    order: number;
    leads?: Lead[];
    _count?: {
        leads: number;
    };
}

interface PipelineBoardProps {
    pipeline: Pipeline;
    leadLists: LeadList[];
    refreshKey?: number;
    /**
     * What a card on this board is. A lead board is the original CRM; an interest
     * board holds one buyer's journey on one property per card; a property board
     * is the owner-acquisition funnel. The drag, the optimistic reorder and the
     * rollback are the same for all three -- only where the cards come from and
     * how one is drawn differ.
     */
    subjectType?: BoardSubjectType;
    /** Needed to load interest and property cards. */
    workspaceId?: string;
    /** Draws a card for a non-lead board. */
    renderCard?: (card: any) => ReactNode;
    onOpenCard?: (card: any) => void;
    /** Reports a failed move on a non-lead board so the page can show it. */
    onMoveError?: (message: string) => void;
    onLeadUpdate?: (leadId: string, updates: Partial<Lead>) => Promise<boolean>;
    onLeadDelete: (leadId: string) => Promise<boolean>;
    onPipelineUpdate: (pipelineId: string, updates: Partial<Pipeline>) => void;
    onPipelineDelete: (pipelineId: string) => void;
    onOpenLeadModal: (lead?: Lead) => void;
    onOpenPipelineModal: (pipeline?: Pipeline) => void;
    /** A developer's "my leads" / owner filter; leaves other boards alone. */
    ownerFilter?: OwnerFilterValue;
}

export default function PipelineBoard({
    pipeline,
    leadLists,
    refreshKey = 0,
    subjectType = 'Lead',
    workspaceId,
    renderCard,
    onOpenCard,
    onMoveError,
    onLeadUpdate,
    onLeadDelete,
    onPipelineUpdate,
    onPipelineDelete,
    onOpenLeadModal,
    onOpenPipelineModal,
    ownerFilter = '',
}: PipelineBoardProps) {
    const { t, formatCurrency, locale } = useI18n();
    const workspaceCurrency = useWorkspaceCurrency(pipeline.workspaceId);
    const { data: session } = useSession();
    const isDeveloper = session?.user?.businessType === 'DEVELOPER';
    const agents = useWorkspaceAgents(workspaceId ?? pipeline.workspaceId);
    const [leads, setLeads] = useState<BoardCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

    const fetchLeads = useCallback(async () => {
        try {
            setLoading(true);
            // Leads answer with a bare array; the newer endpoints with a named envelope.
            const url = subjectType === 'Lead'
                ? `/api/leads?pipelineId=${pipeline.id}`
                : `${SUBJECT_ENDPOINTS[subjectType]}?workspaceId=${workspaceId ?? pipeline.workspaceId}&pipelineId=${pipeline.id}`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setLeads(
                    subjectType === 'Lead' ? data
                    : subjectType === 'Interest' ? data.interests ?? []
                    : data.properties ?? []
                );
            }
        } catch (error) {
            console.error('Error fetching leads:', error);
        } finally {
            setLoading(false);
        }
    }, [pipeline.id, pipeline.workspaceId, subjectType, workspaceId]);

    // Reload when the board changes or the parent asks for fresh data.
    useEffect(() => {
        fetchLeads();
    }, [fetchLeads, refreshKey]);

    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;

        const { draggableId, source, destination } = result;

        if (destination.droppableId === source.droppableId &&
            destination.index === source.index) {
            return;
        }

        // Snapshot for rollback if the server rejects the move
        const previousLeads = leads;
        const originalLead = leads.find(lead => lead.id === draggableId);
        if (!originalLead) return;

        // Set updating state for visual feedback
        setUpdatingLeadId(draggableId);

        // Optimistically reorder the destination column so the card lands where it was dropped
        const moved: BoardCard = {
            ...originalLead,
            stage: destination.droppableId,
            order: destination.index,
        };
        const remaining = leads.filter(lead => lead.id !== draggableId);
        const destinationLeads = remaining
            .filter(lead => lead.stage === destination.droppableId)
            .sort((a, b) => a.order - b.order);
        destinationLeads.splice(destination.index, 0, moved);
        const positions = new Map(destinationLeads.map((lead, index) => [lead.id, index]));

        setLeads([
            ...remaining.filter(lead => lead.stage !== destination.droppableId),
            ...destinationLeads.map(lead => ({ ...lead, order: positions.get(lead.id) ?? lead.order })),
        ]);

        try {
            const ok = await moveCard(draggableId, destination.droppableId, destination.index);
            if (!ok) setLeads(previousLeads);
        } catch (error) {
            console.error('Error updating lead position:', error);
            setLeads(previousLeads);
        } finally {
            // Clear updating state
            setUpdatingLeadId(null);
        }
    };

    /**
     * Persist a move. A lead goes through the page's handler (which also owns its
     * toasts and refresh); the other subjects are a plain PUT of { stage, order },
     * which their routes handle the same way the lead route does.
     */
    const moveCard = async (id: string, stage: string, order: number): Promise<boolean> => {
        if (subjectType === 'Lead') {
            return onLeadUpdate ? onLeadUpdate(id, { stage, order }) : false;
        }
        try {
            const response = await fetch(`${SUBJECT_ENDPOINTS[subjectType]}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stage, order }),
            });
            if (response.ok) return true;
            let message = t('realEstate.pipelines.moveFailed');
            try {
                const data = await response.json();
                if (typeof data?.error === 'string') message = data.error;
            } catch { /* keep the generic message */ }
            onMoveError?.(message);
            return false;
        } catch {
            onMoveError?.(t('realEstate.pipelines.moveFailed'));
            return false;
        }
    };

    const handleLocalDelete = async (lead: Lead) => {
        if (!confirm(t('crm.pipelineBoard.confirmDeleteLead', { firstName: lead.firstName, lastName: lead.lastName }))) return;

        const previousLeads = leads;
        setLeads(prev => prev.filter(l => l.id !== lead.id));

        const ok = await onLeadDelete(lead.id);
        if (!ok) setLeads(previousLeads);
    };

    const getLeadsByStage = (stage: string) => {
        return leads
            .filter(lead => lead.stage === stage)
            .filter(lead => subjectType !== 'Lead' || matchesOwnerFilter(lead, ownerFilter, session?.user?.id))
            .sort((a, b) => a.order - b.order);
    };

    const getStatusColor = (status: string) => {
        const colors: { [key: string]: string } = {
            new: 'bg-blue-100 text-blue-800',
            contacted: 'bg-yellow-100 text-yellow-800',
            qualified: 'bg-green-100 text-green-800',
            proposal: 'bg-purple-100 text-purple-800',
            negotiation: 'bg-orange-100 text-orange-800',
            won: 'bg-emerald-100 text-emerald-800',
            lost: 'bg-red-100 text-red-800',
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const formatValue = (value?: number | null) => {
        if (value == null) return '-';
        return formatCurrency(value, workspaceCurrency);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="skeleton w-64 h-8 rounded mb-4"></div>
                <div className="skeleton w-96 h-32 rounded"></div>
            </div>
        );
    }

    return (
        <div className="h-full">
            {/* Pipeline Header */}
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="headline-lg text-on-surface">{pipelineLabel(pipeline.name, t)}</h2>
                    {pipeline.description && (
                        <p className="body-md text-on-surface-variant">{pipeline.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onOpenPipelineModal(pipeline)}
                        className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded transition-colors"
                        title={t('crm.pipelineModal.editTitle')}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button
                        onClick={() => onPipelineDelete(pipeline.id)}
                        className="p-2 text-error hover:bg-error-container rounded transition-colors"
                        title={t('crm.pipelineBoard.deletePipelineTitle')}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Pipeline Board */}
            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-3 sm:gap-4 overflow-x-auto h-full pb-4">
                    {pipeline.stages.map((stage, stageIndex) => {
                        const stageLeads = getLeadsByStage(stage);
                        return (
                            <div key={stage} className="flex-shrink-0 w-72 sm:w-80">
                                <div className="bg-surface-container rounded-lg p-3 sm:p-4 h-full flex flex-col">
                                    {/* Stage Header */}
                                    <div className="mb-4 flex items-center justify-between">
                                        <h3 className="headline-sm text-on-surface">{stageLabel(stage, t)}</h3>
                                        <span className="body-sm text-on-surface-variant bg-surface-container-highest px-2 py-1 rounded">
                                            {stageLeads.length}
                                        </span>
                                    </div>

                                    {/* Stage Leads */}
                                    <Droppable droppableId={stage}>
                                        {(provided, snapshot) => (
                                            <div
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className={`flex-1 space-y-2 overflow-y-auto rounded-lg transition-all duration-200 ${
                                                    snapshot.isDraggingOver 
                                                        ? 'bg-primary/5 border-2 border-primary/30' 
                                                        : ''
                                                }`}
                                            >
                                                {stageLeads.map((lead, index) => (
                                                    <Draggable
                                                        key={lead.id}
                                                        draggableId={lead.id}
                                                        index={index}
                                                    >
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                className={`bg-surface rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                                                                    snapshot.isDragging 
                                                                        ? 'shadow-2xl scale-105 rotate-2 z-10' 
                                                                        : 'hover:bg-surface-container-high hover:shadow-md'
                                                                } ${
                                                                    updatingLeadId === lead.id 
                                                                        ? 'opacity-50 pointer-events-none' 
                                                                        : ''
                                                                }`}
                                                                onClick={() => (subjectType === 'Lead' ? onOpenLeadModal(lead as unknown as Lead) : onOpenCard?.(lead))}
                                                            >
                                                                {subjectType !== 'Lead' ? (renderCard?.(lead) ?? null) : (<>
                                                                {/* Lead Header */}
                                                                <div className="mb-2 flex items-start justify-between">
                                                                    <div>
                                                                        <h4 className="title-md text-on-surface">
                                                                            {lead.firstName} {lead.lastName}
                                                                        </h4>
                                                                        {lead.company && (
                                                                            <p className="body-sm text-on-surface-variant">
                                                                                {lead.company}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleLocalDelete(lead);
                                                                        }}
                                                                        className="text-on-surface-variant hover:text-error transition-colors"
                                                                        aria-label={t('crm.pipelineBoard.deleteLeadAria', { firstName: lead.firstName, lastName: lead.lastName })}
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                        </svg>
                                                                    </button>
                                                                </div>

                                                                {/* Lead Info */}
                                                                <div className="mb-2 space-y-1">
                                                                    {lead.email && (
                                                                        <div className="flex items-center gap-2 body-sm text-on-surface-variant">
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                                            </svg>
                                                                            {lead.email}
                                                                        </div>
                                                                    )}
                                                                    {lead.phone && (
                                                                        <div className="flex items-center gap-2 body-sm text-on-surface-variant">
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                                            </svg>
                                                                            {lead.phone}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Lead Tags and Status */}
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex flex-wrap gap-1">
                                                                        <span className={`body-xs px-2 py-1 rounded ${getStatusColor(effectiveLeadStatus(lead))}`}>
                                                                            {statusLabel(effectiveLeadStatus(lead), t)}
                                                                        </span>
                                                                        {lead.tags && lead.tags.length > 0 && (
                                                                            lead.tags.slice(0, 2).map((tag, tagIndex) => (
                                                                                <span key={tagIndex} className="body-xs px-2 py-1 bg-surface-container-highest text-on-surface-variant rounded">
                                                                                    {tag}
                                                                                </span>
                                                                            ))
                                                                        )}
                                                                    </div>
                                                                    {lead.value != null && (
                                                                        <span className="body-sm font-medium text-on-surface">
                                                                            {formatValue(lead.value)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {isDeveloper && (
                                                                    <div className="mt-2 flex items-center justify-between gap-2">
                                                                        <span className="flex items-center gap-2">
                                                                            {typeof lead.score === 'number' && <ScoreBadge score={lead.score} />}
                                                                            <FollowUpChip nextFollowUpAt={lead.nextFollowUpAt} />
                                                                        </span>
                                                                        <OwnerAvatar ownerId={lead.ownerId} agents={agents} />
                                                                    </div>
                                                                )}
                                                                {(lead.fileCount || lead.lastActivityAt) ? (
                                                                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-on-surface-variant">
                                                                        {lead.fileCount ? (
                                                                            <span className="flex items-center gap-1" title={t('crm.files.countTitle', { count: lead.fileCount })}>
                                                                                <Paperclip className="h-3 w-3" />
                                                                                {lead.fileCount}
                                                                            </span>
                                                                        ) : <span />}
                                                                        {lead.lastActivityAt ? (
                                                                            <span title={t('crm.timeline.lastActivity')}>{relativeTime(lead.lastActivityAt, locale)}</span>
                                                                        ) : null}
                                                                    </div>
                                                                ) : null}
                                                                </>)}
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                                {stageLeads.length === 0 && !snapshot.isDraggingOver && (
                                                    <p className="body-sm text-on-surface-variant text-center py-6">
                                                        {subjectType === 'Lead' ? t('crm.pipelineBoard.dropLeadsHere') : t('realEstate.pipelines.dropHere')}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </Droppable>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </DragDropContext>
        </div>
    );
}
