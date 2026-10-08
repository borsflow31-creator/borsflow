'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import { useI18n } from '@/i18n/I18nProvider';
import PipelineBoard from '@/components/crm/PipelineBoard';
import LeadListView from '@/components/crm/LeadListView';
import SubjectListView from '@/components/crm/SubjectListView';
import { StandaloneGuide } from '@/components/ui/PageHeader';
import LeadModal, { type LeadModalTab } from '@/components/crm/LeadModal';
import PipelineModal from '@/components/crm/PipelineModal';
import LeadListModal from '@/components/crm/LeadListModal';
import ViewToggle from '@/components/crm/ViewToggle';
import ImportModal from '@/components/crm/ImportModal';
import { useAppStore } from '@/store/appStore';
import Toast from '@/components/Toast';
import SelectRefined from '@/components/ui/SelectRefined';
import { cachedJson } from '@/lib/client-cache';
import { InterestBoardCard, PropertyBoardCard } from '@/components/realestate/cards';
import InterestModal from '@/components/realestate/InterestModal';
import PropertyFormModal from '@/components/realestate/PropertyFormModal';
import { useWorkspaceInfo } from '@/components/realestate/ui';
import { SUBJECT_ENDPOINTS, type SubjectType } from '@/lib/crm/subjects';
import EnquiryModal from '@/components/realestate/EnquiryModal';
import OwnerFilter, { type OwnerFilterValue } from '@/components/developer/OwnerFilter';

const VIEW_MODE_KEY = 'crm-view-mode-v2';

interface Pipeline {
    id: string;
    name: string;
    description?: string;
    color?: string;
    stages: string[];
    workspaceId: string;
    order: number;
    /** What a card on this board is: a lead, a buyer's interest in a property, or a property. */
    subjectType?: SubjectType;
    leads?: Lead[];
    _count?: {
        leads: number;
        interests?: number;
        properties?: number;
    };
}

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
    leadLists?: LeadList[];
}

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

function CRMPageInner() {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const router = useRouter();
    const workspaceId = searchParams.get('workspace') || '';
    const { currentWorkspaceId } = useAppStore();
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [leadLists, setLeadLists] = useState<LeadList[]>([]);
    const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
    const [loading, setLoading] = useState(true);
    const [boardRefreshKey, setBoardRefreshKey] = useState(0);
    const { data: session } = useSession();
    const isDeveloper = session?.user?.businessType === 'DEVELOPER';
    // A developer's "my leads" / owner filter. Shared by the board and the list.
    const [ownerFilter, setOwnerFilter] = useState<OwnerFilterValue>('');
    const [showLeadModal, setShowLeadModal] = useState(false);
    const [showPipelineModal, setShowPipelineModal] = useState(false);
    const [showLeadListModal, setShowLeadListModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingLead, setEditingLead] = useState<Lead | null>(null);
    const [leadModalTab, setLeadModalTab] = useState<LeadModalTab>('details');
    const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
    const [editingLeadList, setEditingLeadList] = useState<LeadList | null>(null);
    const [stageLeadCounts, setStageLeadCounts] = useState<Record<string, number>>({});
    const [stageCountsLoaded, setStageCountsLoaded] = useState(false);
    const [workspaceName, setWorkspaceName] = useState('');
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('list');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [hydrated, setHydrated] = useState(false);

    const effectiveWorkspaceId = workspaceId || currentWorkspaceId || '';
    const workspaceInfo = useWorkspaceInfo(effectiveWorkspaceId);
    const [showInterestModal, setShowInterestModal] = useState(false);
    const [showPropertyModal, setShowPropertyModal] = useState(false);
    const [showEnquiryModal, setShowEnquiryModal] = useState(false);

    // Lead boards are the original CRM; interest and property boards hold the
    // buyer journey and the owner funnel. Which one is selected decides what the
    // header offers and what the board draws.
    const boardSubject: SubjectType = selectedPipeline?.subjectType ?? 'Lead';
    /** Interests open on their property's interests tab; properties on their own page. */
    const openSubjectCard = (card: any) => router.push(
        boardSubject === 'Interest'
            ? `/properties/${card.propertyId ?? card.property?.id}?workspace=${effectiveWorkspaceId}&tab=interests`
            : `/properties/${card.id}?workspace=${effectiveWorkspaceId}`
    );

    // currentWorkspaceId is restored from localStorage after the first render; without this
    // gate a direct visit to /crm flashes the "no workspace" screen before the board appears.
    // Runs client-side only: zustand omits the persist API during SSR, where there is no localStorage.
    useEffect(() => {
        const store = useAppStore.persist;
        if (!store) {
            setHydrated(true);
            return;
        }
        if (store.hasHydrated()) {
            setHydrated(true);
            return;
        }
        return store.onFinishHydration(() => setHydrated(true));
    }, []);

    const showError = (message: string) => setToast({ message, type: 'error' });

    /** Reads the API's { error } message, falling back to a caller-supplied default. */
    const errorFrom = async (response: Response, fallback: string) => {
        try {
            const data = await response.json();
            return typeof data?.error === 'string' ? data.error : fallback;
        } catch {
            return fallback;
        }
    };

    // The list is the default. The key was renamed when it became the default so
    // everyone starts on the list once; a later choice of kanban is remembered.
    useEffect(() => {
        try {
            const savedViewMode = localStorage.getItem(VIEW_MODE_KEY);
            if (savedViewMode === 'kanban' || savedViewMode === 'list') {
                setViewMode(savedViewMode);
            }
        } catch {
            // Storage blocked: stay on the list.
        }
    }, []);

    const handleViewModeChange = (mode: 'kanban' | 'list') => {
        setViewMode(mode);
        try {
            localStorage.setItem(VIEW_MODE_KEY, mode);
        } catch {
            // Storage blocked: the choice lasts for this visit only.
        }
    };

    useEffect(() => {
        if (effectiveWorkspaceId) {
            fetchPipelines();
            fetchLeadLists();
            fetchWorkspace();
        }
    }, [effectiveWorkspaceId]);

    const fetchWorkspace = async () => {
        try {
            const data = await cachedJson(`/api/workspaces/${effectiveWorkspaceId}`);
            setWorkspaceName(data.workspace?.name || '');
        } catch (error) {
            console.error('Error fetching workspace:', error);
        }
    };

    const fetchPipelines = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/pipelines?workspaceId=${effectiveWorkspaceId}`);
            if (response.ok) {
                const data = await response.json();
                setPipelines(data);
                setSelectedPipeline(prev => {
                    // /crm?pipeline=<id> opens that board (the properties page links here).
                    const wanted = !prev ? data.find((p: Pipeline) => p.id === searchParams.get('pipeline')) : null;
                    if (wanted) return wanted;
                    if (!prev) return data[0] || null;
                    // Keep current pipeline selected but with updated data
                    return data.find((p: Pipeline) => p.id === prev.id) || data[0] || null;
                });
            } else {
                showError(await errorFrom(response, t('crm.page.errors.loadPipelinesFailed')));
            }
        } catch (error) {
            console.error('Error fetching pipelines:', error);
            showError(t('crm.page.errors.loadPipelinesNetwork'));
        } finally {
            setLoading(false);
        }
    };

    const fetchLeadLists = async () => {
        try {
            const response = await fetch(`/api/lead-lists?workspaceId=${effectiveWorkspaceId}`);
            if (response.ok) {
                const data = await response.json();
                setLeadLists(data);
            } else {
                showError(await errorFrom(response, t('crm.page.errors.loadListsFailed')));
            }
        } catch (error) {
            console.error('Error fetching lead lists:', error);
        }
    };

    const handlePipelineSelect = (pipeline: Pipeline) => {
        setSelectedPipeline(pipeline);
    };

    // The board and list view render from their own fetched state, so these handlers
    // report success and let the child roll back; they no longer touch selectedPipeline.
    const handleLeadCreate = async (leadData: Partial<Lead>): Promise<boolean> => {
        if (!selectedPipeline) return false;

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...leadData,
                    pipelineId: selectedPipeline.id,
                    workspaceId: effectiveWorkspaceId,
                }),
            });

            if (!response.ok) {
                showError(await errorFrom(response, t('crm.page.errors.createLeadFailed')));
                return false;
            }

            setShowLeadModal(false);
            setBoardRefreshKey(k => k + 1);
            return true;
        } catch (error) {
            console.error('Error creating lead:', error);
            showError(t('crm.page.errors.createLeadNetwork'));
            return false;
        }
    };

    const handleLeadUpdate = async (leadId: string, updates: Partial<Lead>): Promise<boolean> => {
        try {
            const response = await fetch(`/api/leads/${leadId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                showError(await errorFrom(response, t('crm.page.errors.updateLeadFailed')));
                return false;
            }

            setShowLeadModal(false);
            setEditingLead(null);
            setBoardRefreshKey(k => k + 1);
            return true;
        } catch (error) {
            console.error('Error updating lead:', error);
            showError(t('crm.page.errors.changeNotSavedNetwork'));
            return false;
        }
    };

    const handleLeadDelete = async (leadId: string): Promise<boolean> => {
        try {
            const response = await fetch(`/api/leads/${leadId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                showError(await errorFrom(response, t('crm.page.errors.deleteLeadFailed')));
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error deleting lead:', error);
            showError(t('crm.page.errors.deleteLeadNetwork'));
            return false;
        }
    };

    const handlePipelineCreate = async (pipelineData: Partial<Pipeline>) => {
        try {
            const response = await fetch('/api/pipelines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...pipelineData,
                    workspaceId: effectiveWorkspaceId,
                }),
            });

            if (!response.ok) {
                showError(await errorFrom(response, t('crm.page.errors.createPipelineFailed')));
                return;
            }

            const newPipeline = await response.json();
            setShowPipelineModal(false);
            setPipelines(prev => [...prev, newPipeline]);
            setSelectedPipeline(newPipeline);
            setBoardRefreshKey(k => k + 1);
        } catch (error) {
            console.error('Error creating pipeline:', error);
            showError(t('crm.page.errors.createPipelineNetwork'));
        }
    };

    const handlePipelineUpdate = async (pipelineId: string, updates: Partial<Pipeline>) => {
        try {
            const response = await fetch(`/api/pipelines/${pipelineId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                showError(await errorFrom(response, t('crm.page.errors.updatePipelineFailed')));
                return;
            }

            setShowPipelineModal(false);
            setEditingPipeline(null);
            fetchPipelines();
            setBoardRefreshKey(k => k + 1);
        } catch (error) {
            console.error('Error updating pipeline:', error);
            showError(t('crm.page.errors.changeNotSavedNetwork'));
        }
    };

    const handlePipelineDelete = async (pipelineId: string) => {
        const target = pipelines.find(p => p.id === pipelineId);
        const leadCount = (target?._count?.leads ?? 0) + (target?._count?.interests ?? 0) + (target?._count?.properties ?? 0);
        const name = target?.name ?? t('crm.page.thisPipelineFallback');
        const warning = leadCount > 0
            ? t('crm.page.confirmDeletePipelineWithLeads', { name, count: leadCount })
            : t('crm.page.confirmDeletePipeline', { name });

        if (!confirm(warning)) return;

        try {
            const response = await fetch(`/api/pipelines/${pipelineId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                showError(await errorFrom(response, t('crm.page.errors.deletePipelineFailed')));
                return;
            }

            if (selectedPipeline?.id === pipelineId) {
                setSelectedPipeline(pipelines.find(p => p.id !== pipelineId) || null);
            }
            fetchPipelines();
        } catch (error) {
            console.error('Error deleting pipeline:', error);
            showError(t('crm.page.errors.deletePipelineNetwork'));
        }
    };

    const handleLeadListCreate = async (leadListData: Partial<LeadList>) => {
        try {
            const response = await fetch('/api/lead-lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...leadListData,
                    workspaceId: effectiveWorkspaceId,
                }),
            });

            if (!response.ok) {
                showError(await errorFrom(response, t('crm.page.errors.createListFailed')));
                return;
            }

            setShowLeadListModal(false);
            fetchLeadLists();
        } catch (error) {
            console.error('Error creating lead list:', error);
            showError(t('crm.page.errors.createListNetwork'));
        }
    };

    const handleLeadListUpdate = async (leadListId: string, updates: Partial<LeadList>) => {
        try {
            const response = await fetch(`/api/lead-lists/${leadListId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                showError(await errorFrom(response, t('crm.page.errors.updateListFailed')));
                return;
            }

            setShowLeadListModal(false);
            setEditingLeadList(null);
            fetchLeadLists();
        } catch (error) {
            console.error('Error updating lead list:', error);
            showError(t('crm.page.errors.changeNotSavedNetwork'));
        }
    };

    const handleLeadListDelete = async (leadListId: string) => {
        try {
            const response = await fetch(`/api/lead-lists/${leadListId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                showError(await errorFrom(response, t('crm.page.errors.deleteListFailed')));
                return;
            }

            fetchLeadLists();
            setBoardRefreshKey(k => k + 1);
        } catch (error) {
            console.error('Error deleting lead list:', error);
            showError(t('crm.page.errors.deleteListNetwork'));
        }
    };

    const handleOpenLeadModal = (lead?: Lead) => {
        setEditingLead(lead || null);
        setLeadModalTab('details');
        setShowLeadModal(true);
    };

    // Deep link: /crm?lead=<id>&tab=files|history|meetings opens that prospect
    // (used by notifications and links shared between teammates).
    const deepLinkLeadId = searchParams.get('lead');
    const deepLinkTab = searchParams.get('tab');
    useEffect(() => {
        if (!deepLinkLeadId) return;
        let cancelled = false;
        fetch(`/api/leads/${deepLinkLeadId}`)
            .then(res => (res.ok ? res.json() : null))
            .then(lead => {
                if (cancelled || !lead?.id) return;
                const tab = ['details', 'interests', 'meetings', 'files', 'history'].includes(deepLinkTab ?? '')
                    ? (deepLinkTab as LeadModalTab)
                    : 'details';
                setEditingLead(lead);
                setLeadModalTab(tab);
                setShowLeadModal(true);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [deepLinkLeadId, deepLinkTab]);

    const handleOpenPipelineModal = async (pipeline?: Pipeline) => {
        setEditingPipeline(pipeline || null);
        setStageLeadCounts({});
        setStageCountsLoaded(false);
        setShowPipelineModal(true);

        if (!pipeline) {
            setStageCountsLoaded(true);
            return;
        }

        // Used to warn before removing a stage that still holds cards
        try {
            const subject = pipeline.subjectType ?? 'Lead';
            const url = subject === 'Lead'
                ? `/api/leads?pipelineId=${pipeline.id}`
                : `${SUBJECT_ENDPOINTS[subject]}?workspaceId=${effectiveWorkspaceId}&pipelineId=${pipeline.id}`;
            const response = await fetch(url);
            if (!response.ok) return;
            const body = await response.json();
            const cards: { stage: string }[] = subject === 'Lead' ? body : (body.interests ?? body.properties ?? []);
            setStageLeadCounts(
                cards.reduce<Record<string, number>>((counts, card) => {
                    counts[card.stage] = (counts[card.stage] || 0) + 1;
                    return counts;
                }, {})
            );
            setStageCountsLoaded(true);
        } catch {
            // Counts are advisory; the API still migrates leads correctly without them.
        }
    };

    const handleOpenLeadListModal = (leadList?: LeadList) => {
        setEditingLeadList(leadList || null);
        setShowLeadListModal(true);
    };

    if (!hydrated || (effectiveWorkspaceId && loading)) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background">
                <div className="skeleton w-64 h-8 rounded mb-4"></div>
                <div className="skeleton w-96 h-32 rounded"></div>
            </div>
        );
    }

    if (!effectiveWorkspaceId) return <NoWorkspace />;

    return (
        <AppShell
            workspace={{ id: effectiveWorkspaceId, name: workspaceName || t('crm.page.workspaceFallback') }}
            currentPage={undefined}
            breadcrumbs={[
                { label: t('nav.dashboard'), href: '/dashboard' },
                { label: t('realEstate.nav.buyers'), href: `/crm?workspace=${effectiveWorkspaceId}` },
            ]}
        >
            <div className="p-4 sm:p-6 h-full">
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-center justify-between">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                        <h1 className="display-md text-on-surface">
                            {boardSubject === 'Property' ? t('realEstate.nav.properties') : t('realEstate.nav.buyers')}
                        </h1>

                        {/* Pipeline Selector */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <SelectRefined
                                value={selectedPipeline?.id || ''}
                                options={pipelines.map(p => ({ value: p.id, label: p.name }))}
                                onChange={(val) => {
                                    const pipeline = pipelines.find(p => p.id === val);
                                    if (pipeline) handlePipelineSelect(pipeline);
                                }}
                                className="flex-1 sm:w-64"
                                placeholder={t('crm.page.selectPipelinePlaceholder')}
                            />
                            <button
                                onClick={() => handleOpenPipelineModal()}
                                className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded transition-colors"
                                title={t('crm.page.addPipelineAria')}
                                aria-label={t('crm.page.addPipelineAria')}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                        </div>

                        {/* View Toggle */}
                        {selectedPipeline && (
                            <ViewToggle
                                viewMode={viewMode}
                                onViewModeChange={handleViewModeChange}
                            />
                        )}

                        {/* A developer's own pile, or someone else's */}
                        {selectedPipeline && boardSubject === 'Lead' && isDeveloper && effectiveWorkspaceId && (
                            <OwnerFilter workspaceId={effectiveWorkspaceId} value={ownerFilter} onChange={setOwnerFilter} />
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {boardSubject === 'Interest' && (
                            <button
                                onClick={() => setShowInterestModal(true)}
                                className="flex-1 sm:flex-none px-4 py-2 bg-primary text-on-primary rounded text-sm hover:bg-primary-container transition-colors"
                            >
                                {t('realEstate.interests.new')}
                            </button>
                        )}
                        {boardSubject === 'Property' && (
                            <button
                                onClick={() => setShowPropertyModal(true)}
                                className="flex-1 sm:flex-none px-4 py-2 bg-primary text-on-primary rounded text-sm hover:bg-primary-container transition-colors"
                            >
                                {t('realEstate.properties.new')}
                            </button>
                        )}
                        {boardSubject === 'Lead' && (<>
                        <button
                            onClick={() => setShowEnquiryModal(true)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-surface-container-high rounded text-sm text-on-surface hover:bg-surface-container-highest transition-colors"
                        >
                            {t('realEstate.intake.button')}
                        </button>
                        <button
                            onClick={() => handleOpenLeadListModal()}
                            className="flex-1 sm:flex-none px-4 py-2 bg-surface-container-high rounded text-sm text-on-surface hover:bg-surface-container-highest transition-colors"
                        >
                            <span className="hidden sm:inline">{t('crm.page.manageListsFull')}</span>
                            <span className="sm:hidden">{t('crm.page.manageListsShort')}</span>
                        </button>
                        {selectedPipeline && (
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="flex-1 sm:flex-none px-4 py-2 bg-surface-container-high rounded text-sm text-on-surface hover:bg-surface-container-highest transition-colors flex items-center gap-1.5"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                <span className="hidden sm:inline">{t('crm.page.importButton')}</span>
                            </button>
                        )}
                        <button
                            onClick={() => handleOpenLeadModal()}
                            className="flex-1 sm:flex-none px-4 py-2 bg-primary text-on-primary rounded text-sm hover:bg-primary-container transition-colors"
                        >
                            {t('crm.page.addLeadButton')}
                        </button>
                        </>)}
                    </div>
                </div>

                {isDeveloper && boardSubject === 'Lead' && (
                    <div className="mb-6 space-y-3">
                        <p className="text-sm text-on-surface-variant">{t('developerGuide.pages.buyers.subtitle')}</p>
                        <StandaloneGuide id="buyers" />
                    </div>
                )}

                {/* Pipeline Board / List View */}
                {selectedPipeline ? (
                    <div className="h-[calc(100vh-180px)]">
                        {boardSubject !== 'Lead' && viewMode === 'list' ? (
                            <SubjectListView
                                pipeline={selectedPipeline}
                                subjectType={boardSubject as 'Interest' | 'Property'}
                                workspaceId={effectiveWorkspaceId}
                                refreshKey={boardRefreshKey}
                                currency={workspaceInfo.currency}
                                onOpen={openSubjectCard}
                            />
                        ) : boardSubject !== 'Lead' ? (
                            <PipelineBoard
                                pipeline={selectedPipeline}
                                leadLists={leadLists}
                                subjectType={boardSubject as 'Interest' | 'Property'}
                                workspaceId={effectiveWorkspaceId}
                                refreshKey={boardRefreshKey}
                                renderCard={boardSubject === 'Interest'
                                    ? (card) => <InterestBoardCard interest={card} currency={workspaceInfo.currency} />
                                    : (card) => <PropertyBoardCard property={card} currency={workspaceInfo.currency} />}
                                onOpenCard={openSubjectCard}
                                onMoveError={showError}
                                onLeadDelete={handleLeadDelete}
                                onPipelineUpdate={handlePipelineUpdate}
                                onPipelineDelete={handlePipelineDelete}
                                onOpenLeadModal={handleOpenLeadModal}
                                onOpenPipelineModal={handleOpenPipelineModal}
                            />
                        ) : viewMode === 'kanban' ? (
                            <PipelineBoard
                                pipeline={selectedPipeline}
                                leadLists={leadLists}
                                refreshKey={boardRefreshKey}
                                ownerFilter={ownerFilter}
                                onLeadUpdate={handleLeadUpdate}
                                onLeadDelete={handleLeadDelete}
                                onPipelineUpdate={handlePipelineUpdate}
                                onPipelineDelete={handlePipelineDelete}
                                onOpenLeadModal={handleOpenLeadModal}
                                onOpenPipelineModal={handleOpenPipelineModal}
                            />
                        ) : (
                            <LeadListView
                                pipeline={selectedPipeline}
                                refreshKey={boardRefreshKey}
                                ownerFilter={ownerFilter}
                                onLeadUpdate={handleLeadUpdate}
                                onLeadDelete={handleLeadDelete}
                                onOpenLeadModal={handleOpenLeadModal}
                            />
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-[calc(100vh-180px)]">
                        <div className="text-center">
                            <p className="body-lg text-on-surface-variant mb-4">
                                {t('crm.page.noPipelineSelected')}
                            </p>
                            <button
                                onClick={() => handleOpenPipelineModal()}
                                className="px-6 py-3 bg-primary text-on-primary rounded hover:bg-primary-container transition-colors"
                            >
                                {t('crm.page.createFirstPipeline')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Modals */}
                {showLeadModal && (
                    <LeadModal
                        lead={editingLead}
                        pipeline={selectedPipeline}
                        leadLists={leadLists}
                        workspaceId={effectiveWorkspaceId}
                        initialTab={leadModalTab}
                        onSave={editingLead ? (data) => handleLeadUpdate(editingLead.id, data) : handleLeadCreate}
                        onClose={() => {
                            setShowLeadModal(false);
                            setEditingLead(null);
                        }}
                    />
                )}

                {showPipelineModal && (
                    <PipelineModal
                        pipeline={editingPipeline}
                        leadCountsByStage={stageLeadCounts}
                        leadCountsLoaded={stageCountsLoaded}
                        onSave={editingPipeline ? (data) => handlePipelineUpdate(editingPipeline.id, data) : handlePipelineCreate}
                        onClose={() => {
                            setShowPipelineModal(false);
                            setEditingPipeline(null);
                        }}
                    />
                )}

                {showLeadListModal && (
                    <LeadListModal
                        leadLists={leadLists}
                        onSave={handleLeadListCreate}
                        onUpdate={handleLeadListUpdate}
                        onDelete={handleLeadListDelete}
                        onClose={() => {
                            setShowLeadListModal(false);
                            setEditingLeadList(null);
                        }}
                    />
                )}

                {showEnquiryModal && (
                    <EnquiryModal
                        workspaceId={effectiveWorkspaceId}
                        onClose={() => setShowEnquiryModal(false)}
                        onDone={(message) => {
                            setShowEnquiryModal(false);
                            setToast({ message, type: 'success' });
                            setBoardRefreshKey(k => k + 1);
                        }}
                    />
                )}

                {showInterestModal && (
                    <InterestModal
                        workspaceId={effectiveWorkspaceId}
                        onClose={() => setShowInterestModal(false)}
                        onSaved={() => {
                            setShowInterestModal(false);
                            setBoardRefreshKey(k => k + 1);
                        }}
                    />
                )}

                {showPropertyModal && (
                    <PropertyFormModal
                        workspaceId={effectiveWorkspaceId}
                        onClose={() => setShowPropertyModal(false)}
                        onSaved={() => {
                            setShowPropertyModal(false);
                            setBoardRefreshKey(k => k + 1);
                        }}
                    />
                )}

                {showImportModal && selectedPipeline && (
                    <ImportModal
                        pipeline={selectedPipeline}
                        onClose={() => setShowImportModal(false)}
                        onImportComplete={() => {
                            setShowImportModal(false);
                            setBoardRefreshKey(k => k + 1);
                            fetchPipelines();
                        }}
                    />
                )}
            </div>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </AppShell>
    );
}

export default function CRMPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex flex-col items-center justify-center bg-background">
                    <div className="skeleton w-64 h-8 rounded mb-4"></div>
                    <div className="skeleton w-96 h-32 rounded"></div>
                </div>
            }
        >
            <CRMPageInner />
        </Suspense>
    );
}
