'use client';

import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { useMemo, useState } from 'react';
import KanbanCard from './KanbanCard';

interface KanbanBoardProps {
    workspaceId: string;
    cards: Array<{
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
    }>;
    onCardUpdate: (cardId: string, updates: any) => void;
    onCardDelete: (cardId: string) => void;
    onCardCreate: (status: 'todo' | 'inprogress' | 'done', title: string) => Promise<void>;
    onDragEnd: (result: DropResult) => void;
    filter?: {
        priority?: 'low' | 'medium' | 'high';
        assignee?: string;
        tag?: string;
        search?: string;
    };
    isSubmitting?: boolean;
    error?: string | null;
}

export function matchesKanbanFilter(
    card: { priority: string; assignees?: string[]; tags?: string[]; title: string; description?: string },
    filter?: KanbanBoardProps['filter']
): boolean {
    if (!filter) return true;
    if (filter.priority && card.priority !== filter.priority) return false;
    if (filter.assignee && !card.assignees?.includes(filter.assignee)) return false;
    if (filter.tag && !card.tags?.includes(filter.tag)) return false;
    if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        return (
            card.title.toLowerCase().includes(searchLower) ||
            !!card.description?.toLowerCase().includes(searchLower)
        );
    }
    return true;
}

export default function KanbanBoard({
    cards,
    onCardUpdate,
    onCardDelete,
    onCardCreate,
    onDragEnd,
    filter,
    isSubmitting = false,
    error = null,
}: KanbanBoardProps) {
    const [showAddCard, setShowAddCard] = useState<string | null>(null);
    const [newCardTitle, setNewCardTitle] = useState('');

    const columns = [
        { id: 'todo', title: 'To Do', color: 'text-on-surface-variant' },
        { id: 'inprogress', title: 'In Progress', color: 'text-secondary' },
        { id: 'done', title: 'Done', color: 'text-on-surface-variant' },
    ] as const;

    const cardsByColumn = useMemo(() => {
        const result: Record<'todo' | 'inprogress' | 'done', typeof cards> = {
            todo: [],
            inprogress: [],
            done: [],
        };

        cards
            .filter((card) => matchesKanbanFilter(card, filter))
            .sort((a, b) => a.order - b.order)
            .forEach((card) => {
                result[card.status].push(card);
            });

        return result;
    }, [cards, filter]);

    const getFilteredCards = (status: 'todo' | 'inprogress' | 'done') => cardsByColumn[status];

    const handleAddCard = async (columnId: 'todo' | 'inprogress' | 'done') => {
        if (!newCardTitle.trim() || isSubmitting) return;
        await onCardCreate(columnId, newCardTitle.trim());
        setNewCardTitle('');
        setShowAddCard(null);
    };

    const openAddCard = (columnId: string) => {
        setShowAddCard(columnId);
        setNewCardTitle('');
    };

    const closeAddCard = () => {
        setShowAddCard(null);
        setNewCardTitle('');
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                {columns.map((column) => (
                    <div key={column.id} className="flex flex-col min-h-0">
                        {/* Column Header */}
                        <div className="flex items-center justify-between mb-4 px-4 py-3 bg-gradient-to-r from-surface-container-lowest to-surface rounded-t-xl">
                            <div className="flex items-center gap-3">
                                <h2 className={`text-sm font-semibold ${column.color}`}>
                                    {column.title}
                                </h2>
                                <span className="text-xs text-on-surface-variant bg-surface-container-high px-2 py-1 rounded-full shadow-sm">
                                    {getFilteredCards(column.id).length}
                                </span>
                            </div>
                            <button
                                onClick={() => openAddCard(column.id)}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-secondary hover:bg-secondary-container rounded-lg transition-all duration-200 hover:shadow-sm hover:scale-105"
                                aria-label={`Add card to ${column.title}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span>Add</span>
                            </button>
                        </div>

                        {/* Column Content */}
                        <Droppable droppableId={column.id}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`
                                        flex-1 overflow-y-auto bg-gradient-to-b from-surface-container-low to-surface rounded-b-xl p-4
                                        transition-all duration-200 min-h-[120px] space-y-3
                                        ${snapshot.isDraggingOver ? 'bg-surface-container ring-2 ring-secondary/30 shadow-inner' : ''}
                                    `}
                                >
                                    {getFilteredCards(column.id).length === 0 && !snapshot.isDraggingOver && (
                                        <div className="flex flex-col items-center justify-center h-32 text-center">
                                            <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mb-3">
                                                <svg className="w-6 h-6 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                </svg>
                                            </div>
                                            <p className="text-sm text-on-surface-variant">No cards here</p>
                                            <p className="text-xs text-on-surface-variant/60 mt-1">Drag cards here or click &quot;Add&quot;</p>
                                        </div>
                                    )}
                                    {getFilteredCards(column.id).map((card, index) => (
                                        <KanbanCard
                                            key={card.id}
                                            {...card}
                                            index={index}
                                            onUpdate={(updates) => onCardUpdate(card.id, updates)}
                                            onDelete={() => onCardDelete(card.id)}
                                        />
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>

                        {/* Add Card Form */}
                        {showAddCard === column.id && (
                            <div className="mt-3 bg-gradient-to-b from-surface-container-lowest to-surface rounded-lg p-4 border border-outline-variant/15 shadow-sm">
                                {error && (
                                    <div className="mb-3 bg-error-container text-on-error-container px-3 py-2 rounded-lg text-sm">
                                        {error}
                                    </div>
                                )}
                                <input
                                    type="text"
                                    placeholder="Card title..."
                                    value={newCardTitle}
                                    onChange={(e) => setNewCardTitle(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-surface-container-high rounded-lg mb-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-highest focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                    autoFocus
                                    disabled={isSubmitting}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddCard(column.id);
                                        else if (e.key === 'Escape') closeAddCard();
                                    }}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleAddCard(column.id)}
                                        disabled={isSubmitting || !newCardTitle.trim()}
                                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-secondary to-secondary-container text-on-secondary rounded-lg text-sm font-medium hover:shadow-md hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                    >
                                        {isSubmitting ? 'Adding...' : 'Add Card'}
                                    </button>
                                    <button
                                        onClick={closeAddCard}
                                        disabled={isSubmitting}
                                        className="px-4 py-2.5 text-on-surface-variant hover:bg-surface-container-high rounded-lg text-sm transition-all duration-200 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </DragDropContext>
    );
}
