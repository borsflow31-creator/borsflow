'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import KanbanBoard, { matchesKanbanFilter } from '@/components/kanban/KanbanBoard';
import ProjectSidebar from '@/components/kanban/ProjectSidebar';
import ProjectModal from '@/components/kanban/ProjectModal';
import ViewToggle, { ViewMode } from '@/components/kanban/ViewToggle';
import KanbanListView from '@/components/kanban/KanbanListView';
import KanbanCalendarView from '@/components/kanban/KanbanCalendarView';
import KanbanTimelineView from '@/components/kanban/KanbanTimelineView';
import { useAppStore } from '@/store/appStore';
import { DropResult } from '@hello-pangea/dnd';
import TemplatePickerModal from '@/components/templates/TemplatePickerModal';
import SelectRefined from '@/components/ui/SelectRefined';
import { useI18n } from '@/i18n/I18nProvider';
import { cachedJson } from '@/lib/client-cache';

interface KanbanProject {
    id: string;
    name: string;
    description?: string;
    color?: string;
    order: number;
    _count?: {
        cards: number;
    };
}

interface KanbanCard {
    id: string;
    title: string;
    description?: string;
    status: 'todo' | 'inprogress' | 'done';
    priority: 'low' | 'medium' | 'high';
    order: number;
    tags?: string[];
    dueDate?: Date;
    assignees?: string[];
    attachments?: number;
    comments?: number;
    checklistCompleted?: number;
    checklistTotal?: number;
    projectId?: string;
    project?: KanbanProject;
    createdAt: Date;
}

function KanbanBoardPageInner() {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const workspaceId = searchParams.get('workspace') || '';
    const { currentWorkspaceId } = useAppStore();

    const PRIORITY_OPTIONS = [
        { value: 'low', label: t('kanban.priorityLow') },
        { value: 'medium', label: t('kanban.priorityMedium') },
        { value: 'high', label: t('kanban.priorityHigh') },
    ];

    const STATUS_OPTIONS = [
        { value: 'todo', label: t('kanban.statusTodo') },
        { value: 'inprogress', label: t('kanban.statusInProgress') },
        { value: 'done', label: t('kanban.statusDone') },
    ];

    const PRIORITY_FILTER_OPTIONS = [
        { value: '', label: t('kanban.priorityFilterAll') },
        { value: 'high', label: t('kanban.priorityHigh') },
        { value: 'medium', label: t('kanban.priorityMedium') },
        { value: 'low', label: t('kanban.priorityLow') },
    ];

    // Cards and Projects
    const [cards, setCards] = useState<KanbanCard[]>([]);
    const [projects, setProjects] = useState<KanbanProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [projectsLoading, setProjectsLoading] = useState(true);

    // View Mode
    const [viewMode, setViewMode] = useState<ViewMode>('kanban');

    // Project Selection
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
        searchParams.get('project') || null
    );

    // Filters
    const [filter, setFilter] = useState<{
        priority?: 'low' | 'medium' | 'high';
        assignee?: string;
        tag?: string;
        search?: string;
    }>({});

    // Workspace
    const [workspaceName, setWorkspaceName] = useState('');

    // Add Card Modal
    const [showAddCardModal, setShowAddCardModal] = useState(false);
    const [newCardTitle, setNewCardTitle] = useState('');
    const [newCardDescription, setNewCardDescription] = useState('');
    const [newCardStatus, setNewCardStatus] = useState<'todo' | 'inprogress' | 'done'>('todo');
    const [newCardPriority, setNewCardPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [newCardDueDate, setNewCardDueDate] = useState('');
    const [newCardTagsRaw, setNewCardTagsRaw] = useState('');
    const [newCardAssigneesRaw, setNewCardAssigneesRaw] = useState('');

    // Project Modal
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [editingProject, setEditingProject] = useState<KanbanProject | null>(null);
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);

    // UI State
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const effectiveWorkspaceId = workspaceId || currentWorkspaceId || '';

    useEffect(() => {
        if (effectiveWorkspaceId) {
            fetchCards();
            fetchProjects();
            fetchWorkspace();
        }
    }, [effectiveWorkspaceId, selectedProjectId]);

    const fetchWorkspace = async () => {
        try {
            const data = await cachedJson(`/api/workspaces/${effectiveWorkspaceId}`);
            setWorkspaceName(data.workspace?.name || '');
        } catch (err) {
            console.error('Error fetching workspace:', err);
        }
    };

    const fetchCards = async () => {
        try {
            // Only show the full-page skeleton on the very first load; subsequent
            // refetches (e.g. switching project) keep the board mounted.
            setLoading(prev => cards.length === 0 ? true : prev);
            const url = selectedProjectId
                ? `/api/kanban?workspaceId=${effectiveWorkspaceId}&projectId=${selectedProjectId}`
                : `/api/kanban?workspaceId=${effectiveWorkspaceId}`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                const cardsWithDates = data.map((card: any) => ({
                    ...card,
                    dueDate: card.dueDate ? new Date(card.dueDate) : undefined,
                    createdAt: card.createdAt ? new Date(card.createdAt) : new Date(),
                    tags: card.tags ? JSON.parse(card.tags) : [],
                    assignees: card.assignees ? JSON.parse(card.assignees) : [],
                }));
                setCards(cardsWithDates);
            }
        } catch (err) {
            console.error('Error fetching kanban cards:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchProjects = async () => {
        try {
            setProjectsLoading(true);
            const response = await fetch(`/api/kanban/projects?workspaceId=${effectiveWorkspaceId}`);
            if (response.ok) {
                const data = await response.json();
                setProjects(data);
            }
        } catch (err) {
            console.error('Error fetching projects:', err);
        } finally {
            setProjectsLoading(false);
        }
    };

    const handleCardUpdate = async (cardId: string, updates: any) => {
        const card = cards.find(c => c.id === cardId);
        const isStatusChange = updates.status !== undefined && card?.status !== updates.status;

        // Optimistic update
        if (isStatusChange) {
            setCards(prev => prev.map(c => c.id === cardId ? { ...c, ...updates } : c));
        }

        try {
            const response = await fetch(`/api/kanban/${cardId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || t('kanban.updateCardError'));
            }

            setCards(prev =>
                prev.map(c =>
                    c.id === cardId
                        ? {
                            ...c,
                            ...data,
                            dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
                            tags: Array.isArray(data.tags) ? data.tags : (data.tags ? JSON.parse(data.tags) : []),
                            assignees: Array.isArray(data.assignees) ? data.assignees : (data.assignees ? JSON.parse(data.assignees) : []),
                          }
                        : c
                )
            );
        } catch (err: any) {
            console.error('Error updating card:', err);
            // Revert optimistic update on error
            if (card) {
                setCards(prev => prev.map(c => c.id === cardId ? card : c));
            }
            setError(err.message || t('kanban.updateCardError'));
            setTimeout(() => setError(null), 5000);
        }
    };

    const handleCardDelete = async (cardId: string) => {
        try {
            const response = await fetch(`/api/kanban/${cardId}`, { method: 'DELETE' });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || t('kanban.deleteCardError'));
            }

            setCards(prev => prev.filter(card => card.id !== cardId));
            setSuccess(t('kanban.cardDeletedSuccess'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            console.error('Error deleting card:', err);
            setError(err.message || t('kanban.deleteCardError'));
            setTimeout(() => setError(null), 5000);
        }
    };

    const handleCardCreate = async (
        status: 'todo' | 'inprogress' | 'done',
        title: string,
        extra?: {
            description?: string;
            priority?: 'low' | 'medium' | 'high';
            dueDate?: string;
            tags?: string[];
            assignees?: string[];
        }
    ): Promise<void> => {
        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/kanban', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    status,
                    workspaceId: effectiveWorkspaceId,
                    projectId: selectedProjectId || undefined,
                    description: extra?.description || undefined,
                    priority: extra?.priority || 'medium',
                    dueDate: extra?.dueDate || undefined,
                    tags: extra?.tags || [],
                    assignees: extra?.assignees || [],
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || t('kanban.createCardError'));
            }

            const cardWithDates = {
                ...data,
                dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
                createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
                tags: data.tags ? JSON.parse(data.tags) : [],
                assignees: data.assignees ? JSON.parse(data.assignees) : [],
            };
            setCards(prev => [...prev, cardWithDates]);
            setSuccess(t('kanban.cardCreatedSuccess'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            console.error('Error creating card:', err);
            setError(err.message || t('kanban.createCardError'));
            setTimeout(() => setError(null), 5000);
            throw err; // re-throw so callers can detect failure
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetAddCardModal = () => {
        setNewCardTitle('');
        setNewCardDescription('');
        setNewCardStatus('todo');
        setNewCardPriority('medium');
        setNewCardDueDate('');
        setNewCardTagsRaw('');
        setNewCardAssigneesRaw('');
    };

    const handleGlobalAddCard = async () => {
        if (!newCardTitle.trim()) {
            setError(t('kanban.titleRequiredError'));
            return;
        }
        try {
            await handleCardCreate(newCardStatus, newCardTitle.trim(), {
                description: newCardDescription.trim() || undefined,
                priority: newCardPriority,
                dueDate: newCardDueDate || undefined,
                tags: newCardTagsRaw.split(',').map(t => t.trim()).filter(Boolean),
                assignees: newCardAssigneesRaw.split(',').map(a => a.trim()).filter(Boolean),
            });
            resetAddCardModal();
            setShowAddCardModal(false);
        } catch {
            // error already set in handleCardCreate, keep modal open
        }
    };

    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;
        const { draggableId, destination, source } = result;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const previousCards = cards;
        const originalCard = cards.find(c => c.id === draggableId);
        if (!originalCard) return;

        const newStatus = destination.droppableId as 'todo' | 'inprogress' | 'done';

        // Optimistically reorder the destination column (unfiltered) so the
        // card lands exactly where it was dropped, and renumber its siblings.
        const moved: KanbanCard = { ...originalCard, status: newStatus };
        const remaining = cards.filter(c => c.id !== draggableId);
        const destinationCards = remaining
            .filter(c => c.status === newStatus)
            .sort((a, b) => a.order - b.order);

        // destination.index is an index into the *visible* (filtered) list. Translate
        // it to a position in the full column by inserting before the visible card
        // currently at that index (or at the end if dropped past the last one).
        const visibleDestination = destinationCards.filter(c => matchesKanbanFilter(c, filter));
        const anchor = visibleDestination[destination.index];
        const insertAt = anchor ? destinationCards.findIndex(c => c.id === anchor.id) : destinationCards.length;
        destinationCards.splice(insertAt, 0, moved);
        const destinationPositions = new Map(destinationCards.map((c, i) => [c.id, i]));

        // If the source column differs, renumber it too so it stays contiguous.
        const sourceStatus = source.droppableId as 'todo' | 'inprogress' | 'done';
        const sourcePositions = new Map<string, number>();
        if (sourceStatus !== newStatus) {
            const sourceCards = remaining
                .filter(c => c.status === sourceStatus)
                .sort((a, b) => a.order - b.order);
            sourceCards.forEach((c, i) => sourcePositions.set(c.id, i));
        }

        const nextCards = cards.map(c => {
            if (c.id === draggableId) {
                return { ...c, status: newStatus, order: destinationPositions.get(c.id) ?? destination.index };
            }
            if (destinationPositions.has(c.id)) {
                return { ...c, order: destinationPositions.get(c.id)! };
            }
            if (sourcePositions.has(c.id)) {
                return { ...c, order: sourcePositions.get(c.id)! };
            }
            return c;
        });

        setCards(nextCards);

        const payloadCards = [
            ...destinationCards.map(c => ({
                id: c.id,
                status: newStatus,
                order: destinationPositions.get(c.id)!,
            })),
            ...(sourceStatus !== newStatus
                ? remaining
                    .filter(c => c.status === sourceStatus)
                    .sort((a, b) => a.order - b.order)
                    .map(c => ({ id: c.id, status: sourceStatus, order: sourcePositions.get(c.id)! }))
                : []),
        ];

        try {
            const response = await fetch('/api/kanban/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId: effectiveWorkspaceId, cards: payloadCards }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || t('kanban.reorderError'));
            }
        } catch (err: any) {
            console.error('Error reordering cards:', err);
            setCards(previousCards);
            setError(err.message || t('kanban.reorderError'));
            setTimeout(() => setError(null), 5000);
        }
    };

    // Project handlers
    const handleProjectCreate = async (data: { name: string; description?: string; color?: string }) => {
        try {
            const response = await fetch('/api/kanban/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
                    workspaceId: effectiveWorkspaceId,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || t('kanban.createProjectError'));
            }

            await fetchProjects();
            setSuccess(t('kanban.projectCreatedSuccess'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            console.error('Error creating project:', err);
            setError(err.message || t('kanban.createProjectError'));
            setTimeout(() => setError(null), 5000);
            throw err;
        }
    };

    const handleProjectUpdate = async (id: string, data: { name: string; description?: string; color?: string }) => {
        try {
            const response = await fetch(`/api/kanban/projects/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || t('kanban.updateProjectError'));
            }

            await fetchProjects();
            setSuccess(t('kanban.projectUpdatedSuccess'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            console.error('Error updating project:', err);
            setError(err.message || t('kanban.updateProjectError'));
            setTimeout(() => setError(null), 5000);
            throw err;
        }
    };

    const handleProjectDelete = async (projectId: string) => {
        if (!confirm(t('kanban.deleteProjectConfirm'))) {
            return;
        }

        try {
            const response = await fetch(`/api/kanban/projects/${projectId}`, {
                method: 'DELETE',
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || t('kanban.deleteProjectError'));
            }

            // If the deleted project was selected, deselect it
            if (selectedProjectId === projectId) {
                setSelectedProjectId(null);
            }

            await fetchProjects();
            await fetchCards();
            setSuccess(t('kanban.projectDeletedSuccess'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            console.error('Error deleting project:', err);
            setError(err.message || t('kanban.deleteProjectError'));
            setTimeout(() => setError(null), 5000);
        }
    };

    const handleProjectEdit = (project: KanbanProject) => {
        setEditingProject(project);
        setShowProjectModal(true);
    };

    const handleProjectModalSubmit = async (data: { name: string; description?: string; color?: string }) => {
        try {
            if (editingProject) {
                await handleProjectUpdate(editingProject.id, data);
            } else {
                await handleProjectCreate(data);
            }
            setShowProjectModal(false);
            setEditingProject(null);
        } catch {
            // error already handled
        }
    };

    const handleProjectModalClose = () => {
        setShowProjectModal(false);
        setEditingProject(null);
    };

    if (!effectiveWorkspaceId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <h1 className="display-md text-on-surface mb-4">{t('kanban.noWorkspaceTitle')}</h1>
                    <p className="body-lg text-on-surface-variant">
                        {t('kanban.noWorkspaceDescription')}
                    </p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="skeleton w-64 h-8 rounded mb-4"></div>
                <div className="skeleton w-96 h-32 rounded"></div>
            </div>
        );
    }

    const renderView = () => {
        switch (viewMode) {
            case 'kanban':
                return (
                    <KanbanBoard
                        workspaceId={effectiveWorkspaceId}
                        cards={cards}
                        onCardUpdate={handleCardUpdate}
                        onCardDelete={handleCardDelete}
                        onCardCreate={handleCardCreate}
                        onDragEnd={handleDragEnd}
                        filter={filter}
                        isSubmitting={isSubmitting}
                        error={error}
                    />
                );
            case 'list':
                return (
                    <KanbanListView
                        cards={cards}
                        projects={projects}
                        onCardUpdate={handleCardUpdate}
                        onCardDelete={handleCardDelete}
                        filter={filter}
                        loading={loading}
                    />
                );
            case 'calendar':
                return (
                    <KanbanCalendarView
                        cards={cards}
                        projects={projects}
                        onCardUpdate={handleCardUpdate}
                        onCardClick={(card) => console.log('Card clicked:', card)}
                        filter={filter}
                    />
                );
            case 'timeline':
                return (
                    <KanbanTimelineView
                        cards={cards}
                        projects={projects}
                        onCardUpdate={handleCardUpdate}
                        onCardClick={(card) => console.log('Card clicked:', card)}
                        filter={filter}
                    />
                );
            default:
                return null;
        }
    };

    if (!effectiveWorkspaceId) return <NoWorkspace />;

    return (
        <AppShell
            workspace={{ id: effectiveWorkspaceId, name: workspaceName || t('kanban.workspaceFallbackName') }}
            currentPage={undefined}
            breadcrumbs={[
                { label: t('nav.dashboard'), href: '/dashboard' },
                { label: t('nav.kanban'), href: `/kanban-board-view?workspace=${effectiveWorkspaceId}` },
            ]}
        >
            <div className="flex h-full">
                {/* Project Sidebar */}
                <ProjectSidebar
                    workspaceId={effectiveWorkspaceId}
                    projects={projects}
                    selectedProjectId={selectedProjectId}
                    onProjectSelect={setSelectedProjectId}
                    onProjectCreate={() => {
                        setEditingProject(null);
                        setShowProjectModal(true);
                    }}
                    onTemplateCreate={() => setShowTemplatePicker(true)}
                    onProjectEdit={handleProjectEdit}
                    onProjectDelete={handleProjectDelete}
                    loading={projectsLoading}
                />

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 flex flex-col h-full">
                        {/* Error and Success Messages */}
                        {error && (
                            <div className="mb-4 bg-error-container text-on-error-container px-4 py-3 rounded-lg flex items-center justify-between">
                                <span className="text-sm">{error}</span>
                                <button onClick={() => setError(null)} className="text-on-error-container hover:opacity-70">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        {success && (
                            <div className="mb-4 bg-success-container text-on-success-container px-4 py-3 rounded-lg flex items-center justify-between">
                                <span className="text-sm">{success}</span>
                                <button onClick={() => setSuccess(null)} className="text-on-success-container hover:opacity-70">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        {/* Filter Bar and View Toggle */}
                        <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
                            <div className="flex flex-wrap gap-4 items-center flex-1">
                                <div className="flex-1 min-w-64 relative">
                                    <input
                                        type="text"
                                        placeholder={t('kanban.searchCardsPlaceholder')}
                                        value={filter.search || ''}
                                        onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-highest focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                    />
                                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>

                                <SelectRefined
                                    value={filter.priority || ''}
                                    options={PRIORITY_FILTER_OPTIONS}
                                    onChange={(v) => setFilter({ ...filter, priority: (v as any) || undefined })}
                                    size="sm"
                                    variant="filled"
                                    className="w-44"
                                    triggerClassName="px-4 py-2.5"
                                />

                                <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />

                                {(filter.priority || filter.search) && (
                                    <button
                                        onClick={() => setFilter({})}
                                        className="px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-all duration-200"
                                    >
                                        {t('common.clearFilters')}
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={() => setShowAddCardModal(true)}
                                disabled={isSubmitting}
                                className="px-5 py-2.5 bg-secondary text-on-secondary rounded-lg text-sm font-medium hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? t('kanban.adding') : t('kanban.addCard')}
                            </button>
                        </div>

                        {/* View Content */}
                        <div className="flex-1 min-h-0 overflow-auto">
                            {renderView()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Card Modal */}
            {showAddCardModal && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowAddCardModal(false); resetAddCardModal(); setError(null); } }}
                >
                    <div className="bg-surface-container-lowest rounded-xl p-6 w-full max-w-lg shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-on-surface">{t('kanban.addCardModalTitle')}</h3>
                            <button
                                onClick={() => { setShowAddCardModal(false); resetAddCardModal(); setError(null); }}
                                className="p-1.5 hover:bg-surface-container-high rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1.5">{t('kanban.titleFieldLabel')}</label>
                                <input
                                    type="text"
                                    value={newCardTitle}
                                    onChange={(e) => setNewCardTitle(e.target.value)}
                                    placeholder={t('kanban.cardTitlePlaceholder')}
                                    className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                    autoFocus
                                    disabled={isSubmitting}
                                    onKeyDown={(e) => { if (e.key === 'Escape') { setShowAddCardModal(false); resetAddCardModal(); } }}
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1.5">{t('kanban.descriptionFieldLabel')}</label>
                                <textarea
                                    value={newCardDescription}
                                    onChange={(e) => setNewCardDescription(e.target.value)}
                                    rows={3}
                                    placeholder={t('kanban.descriptionPlaceholder')}
                                    className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all resize-none"
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Priority */}
                                <SelectRefined
                                    label={t('kanban.priorityFieldLabel')}
                                    size="sm"
                                    variant="filled"
                                    value={newCardPriority}
                                    options={PRIORITY_OPTIONS}
                                    onChange={(v) => setNewCardPriority(v as any)}
                                    disabled={isSubmitting}
                                />

                                {/* Status */}
                                <SelectRefined
                                    label={t('kanban.statusFieldLabel')}
                                    size="sm"
                                    variant="filled"
                                    value={newCardStatus}
                                    options={STATUS_OPTIONS}
                                    onChange={(v) => setNewCardStatus(v as any)}
                                    disabled={isSubmitting}
                                />
                            </div>

                            {/* Due Date */}
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1.5">{t('kanban.dueDateFieldLabel')}</label>
                                <input
                                    type="date"
                                    value={newCardDueDate}
                                    onChange={(e) => setNewCardDueDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                    disabled={isSubmitting}
                                />
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1.5">{t('kanban.tagsFieldLabel')}</label>
                                <input
                                    type="text"
                                    value={newCardTagsRaw}
                                    onChange={(e) => setNewCardTagsRaw(e.target.value)}
                                    placeholder={t('kanban.tagsPlaceholder')}
                                    className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                    disabled={isSubmitting}
                                />
                            </div>

                            {/* Assignees */}
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1.5">{t('kanban.assigneesFieldLabel')}</label>
                                <input
                                    type="text"
                                    value={newCardAssigneesRaw}
                                    onChange={(e) => setNewCardAssigneesRaw(e.target.value)}
                                    placeholder={t('kanban.assigneesPlaceholder')}
                                    className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div className="flex gap-2 justify-end pt-1">
                                <button
                                    onClick={() => { setShowAddCardModal(false); resetAddCardModal(); setError(null); }}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={handleGlobalAddCard}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-secondary text-on-secondary rounded-lg text-sm font-medium hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    {isSubmitting ? t('kanban.adding') : t('kanban.addCard')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Project Modal */}
            <ProjectModal
                isOpen={showProjectModal}
                onClose={handleProjectModalClose}
                onSubmit={handleProjectModalSubmit}
                project={editingProject}
                loading={isSubmitting}
            />

            {/* Template Picker */}
            <TemplatePickerModal
                isOpen={showTemplatePicker}
                onClose={() => setShowTemplatePicker(false)}
                type="kanban"
                workspaceId={effectiveWorkspaceId}
            />
        </AppShell>
    );
}

export default function KanbanBoardPage() {
    return (
        <Suspense>
            <KanbanBoardPageInner />
        </Suspense>
    );
}
