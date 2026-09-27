'use client';

import { useState } from 'react';
import { Edit2, Trash2, ArrowUpDown, MoreVertical, CheckCircle2, Clock, Circle, Table2 } from 'lucide-react';

interface KanbanProject {
    id: string;
    name: string;
    color?: string;
}

interface KanbanCard {
    id: string;
    title: string;
    description?: string;
    status: 'todo' | 'inprogress' | 'done';
    priority: 'low' | 'medium' | 'high';
    tags?: string[];
    dueDate?: Date;
    assignees?: string[];
    attachments?: number;
    comments?: number;
    checklistCompleted?: number;
    checklistTotal?: number;
    projectId?: string;
    project?: KanbanProject;
}

interface KanbanFilter {
    priority?: 'low' | 'medium' | 'high';
    assignee?: string;
    tag?: string;
    search?: string;
}

interface KanbanListViewProps {
    cards: KanbanCard[];
    projects: KanbanProject[];
    onCardUpdate: (cardId: string, updates: any) => void;
    onCardDelete: (cardId: string) => void;
    onCardEdit?: (card: KanbanCard) => void;
    filter?: KanbanFilter;
    loading?: boolean;
}

type SortField = 'title' | 'status' | 'priority' | 'dueDate' | 'project';
type SortOrder = 'asc' | 'desc';

export default function KanbanListView({
    cards,
    projects,
    onCardUpdate,
    onCardDelete,
    onCardEdit,
    filter,
    loading = false,
}: KanbanListViewProps) {
    const [sortField, setSortField] = useState<SortField>('dueDate');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

    const getFilteredAndSortedCards = () => {
        let filtered = [...cards];

        // Apply filters
        if (filter) {
            if (filter.priority) {
                filtered = filtered.filter(card => card.priority === filter.priority);
            }
            if (filter.assignee) {
                filtered = filtered.filter(card => card.assignees?.includes(filter.assignee!) ?? false);
            }
            if (filter.tag) {
                filtered = filtered.filter(card => card.tags?.includes(filter.tag!) ?? false);
            }
            if (filter.search) {
                const searchLower = filter.search.toLowerCase();
                filtered = filtered.filter(card =>
                    card.title.toLowerCase().includes(searchLower) ||
                    card.description?.toLowerCase().includes(searchLower)
                );
            }
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let comparison = 0;

            switch (sortField) {
                case 'title':
                    comparison = a.title.localeCompare(b.title);
                    break;
                case 'status':
                    const statusOrder = { todo: 0, inprogress: 1, done: 2 };
                    comparison = statusOrder[a.status] - statusOrder[b.status];
                    break;
                case 'priority':
                    const priorityOrder = { low: 0, medium: 1, high: 2 };
                    comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
                    break;
                case 'dueDate':
                    if (!a.dueDate && !b.dueDate) comparison = 0;
                    else if (!a.dueDate) comparison = 1;
                    else if (!b.dueDate) comparison = -1;
                    else comparison = a.dueDate.getTime() - b.dueDate.getTime();
                    break;
                case 'project':
                    const projectA = a.project?.name || '';
                    const projectB = b.project?.name || '';
                    comparison = projectA.localeCompare(projectB);
                    break;
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return filtered;
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const getStatusBadge = (status: string) => {
        const statusConfig = {
            todo: { icon: Circle, label: 'To Do', color: 'text-on-surface-variant bg-surface-container-high' },
            inprogress: { icon: Clock, label: 'In Progress', color: 'text-secondary bg-secondary-container' },
            done: { icon: CheckCircle2, label: 'Done', color: 'text-success bg-success-container' },
        };
        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.todo;
        const Icon = config.icon;

        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
                <Icon className="w-3.5 h-3.5" />
                {config.label}
            </span>
        );
    };

    const getPriorityBadge = (priority: string) => {
        const priorityConfig = {
            low: { label: 'Low', color: 'text-success bg-success-container' },
            medium: { label: 'Medium', color: 'text-warning bg-warning-container' },
            high: { label: 'High', color: 'text-error bg-error-container' },
        };
        const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium;

        return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
                {config.label}
            </span>
        );
    };

    const getProjectBadge = (project?: KanbanProject) => {
        if (!project) return null;

        return (
            <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-on-surface"
                style={{ backgroundColor: `${project.color}20` }}
            >
                <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: project.color }}
                />
                {project.name}
            </span>
        );
    };

    const isOverdue = (dueDate?: Date) => {
        if (!dueDate) return false;
        return dueDate < new Date();
    };

    const formatDate = (date?: Date) => {
        if (!date) return '-';
        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    };

    const filteredCards = getFilteredAndSortedCards();

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="bg-surface-container-low rounded-lg p-4 animate-pulse">
                        <div className="h-5 bg-surface-container-high rounded w-1/3 mb-3" />
                        <div className="h-4 bg-surface-container-high rounded w-1/2 mb-2" />
                        <div className="h-4 bg-surface-container-high rounded w-1/4" />
                    </div>
                ))}
            </div>
        );
    }

    if (filteredCards.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
                    <Table2 className="w-8 h-8 text-on-surface-variant/30" />
                </div>
                <h3 className="text-lg font-semibold text-on-surface mb-2">No cards found</h3>
                <p className="text-sm text-on-surface-variant max-w-sm">
                    {filter?.search || filter?.priority || filter?.tag || filter?.assignee
                        ? 'Try adjusting your filters or search terms'
                        : 'Create your first card to get started'}
                </p>
            </div>
        );
    }

    return (
        <div className="bg-surface-container-low rounded-xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-surface-container-high border-b border-outline-variant/30 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                <div className="col-span-4 flex items-center gap-2 cursor-pointer hover:text-on-surface transition-colors" onClick={() => handleSort('title')}>
                    Title
                    <ArrowUpDown className="w-3 h-3" />
                </div>
                <div className="col-span-2 flex items-center gap-2 cursor-pointer hover:text-on-surface transition-colors" onClick={() => handleSort('status')}>
                    Status
                    <ArrowUpDown className="w-3 h-3" />
                </div>
                <div className="col-span-2 flex items-center gap-2 cursor-pointer hover:text-on-surface transition-colors" onClick={() => handleSort('priority')}>
                    Priority
                    <ArrowUpDown className="w-3 h-3" />
                </div>
                <div className="col-span-2 flex items-center gap-2 cursor-pointer hover:text-on-surface transition-colors" onClick={() => handleSort('dueDate')}>
                    Due Date
                    <ArrowUpDown className="w-3 h-3" />
                </div>
                <div className="col-span-1 flex items-center gap-2 cursor-pointer hover:text-on-surface transition-colors" onClick={() => handleSort('project')}>
                    Project
                    <ArrowUpDown className="w-3 h-3" />
                </div>
                <div className="col-span-1"></div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-outline-variant/20">
                {filteredCards.map((card) => (
                    <div
                        key={card.id}
                        className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-surface-container-highest/50 transition-colors group"
                    >
                        {/* Title */}
                        <div className="col-span-4 min-w-0">
                            <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium text-on-surface truncate mb-1">
                                        {card.title}
                                    </h4>
                                    {card.description && (
                                        <p className="text-xs text-on-surface-variant line-clamp-2">
                                            {card.description}
                                        </p>
                                    )}
                                    {card.tags && card.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {card.tags.slice(0, 3).map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs text-on-surface-variant bg-surface-container-high"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                            {card.tags.length > 3 && (
                                                <span className="text-xs text-on-surface-variant">
                                                    +{card.tags.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="col-span-2 flex items-center">
                            {getStatusBadge(card.status)}
                        </div>

                        {/* Priority */}
                        <div className="col-span-2 flex items-center">
                            {getPriorityBadge(card.priority)}
                        </div>

                        {/* Due Date */}
                        <div className="col-span-2 flex items-center">
                            <span className={`text-sm ${isOverdue(card.dueDate) ? 'text-error font-medium' : 'text-on-surface'}`}>
                                {formatDate(card.dueDate)}
                            </span>
                        </div>

                        {/* Project */}
                        <div className="col-span-1 flex items-center">
                            {getProjectBadge(card.project)}
                        </div>

                        {/* Actions */}
                        <div className="col-span-1 flex items-center justify-end">
                            <div className="relative">
                                <button
                                    onClick={() => setMenuOpenId(menuOpenId === card.id ? null : card.id)}
                                    className="p-1.5 rounded-md hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors opacity-0 group-hover:opacity-100"
                                    aria-label="More options"
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </button>

                                {menuOpenId === card.id && (
                                    <div className="absolute right-0 top-full mt-1 w-32 bg-surface-container-lowest rounded-lg shadow-lg border border-outline-variant/30 py-1 z-10">
                                        {onCardEdit && (
                                            <button
                                                onClick={() => {
                                                    onCardEdit(card);
                                                    setMenuOpenId(null);
                                                }}
                                                className="w-full px-3 py-2 text-sm text-left text-on-surface hover:bg-surface-container-high flex items-center gap-2"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                Edit
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                onCardDelete(card.id);
                                                setMenuOpenId(null);
                                            }}
                                            className="w-full px-3 py-2 text-sm text-left text-error hover:bg-error-container flex items-center gap-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-surface-container-high border-t border-outline-variant/30 text-xs text-on-surface-variant">
                Showing {filteredCards.length} of {cards.length} cards
            </div>
        </div>
    );
}
