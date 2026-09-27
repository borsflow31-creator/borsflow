'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, GanttChart, MoreVertical } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, differenceInDays, addDays } from 'date-fns';

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
    createdAt: Date;
}

interface KanbanFilter {
    priority?: 'low' | 'medium' | 'high';
    assignee?: string;
    tag?: string;
    search?: string;
}

interface KanbanTimelineViewProps {
    cards: KanbanCard[];
    projects: KanbanProject[];
    onCardUpdate: (cardId: string, updates: any) => void;
    onCardClick: (card: KanbanCard) => void;
    filter?: KanbanFilter;
    startDate?: Date;
    endDate?: Date;
}

type TimelineZoom = 'day' | 'week' | 'month';
type TimelineGroupBy = 'project' | 'status' | 'priority' | 'none';

export default function KanbanTimelineView({
    cards,
    projects,
    onCardUpdate,
    onCardClick,
    filter,
    startDate: initialStartDate,
    endDate: initialEndDate,
}: KanbanTimelineViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [zoom, setZoom] = useState<TimelineZoom>('month');
    const [groupBy, setGroupBy] = useState<TimelineGroupBy>('project');

    const getFilteredCards = () => {
        let filtered = [...cards];

        if (filter) {
            if (filter.priority) {
                filtered = filtered.filter(card => card.priority === filter.priority);
            }
            if (filter.assignee) {
                const assignee = filter.assignee;
                filtered = filtered.filter(card => card.assignees?.includes(assignee) ?? false);
            }
            if (filter.tag) {
                const tag = filter.tag;
                filtered = filtered.filter(card => card.tags?.includes(tag) ?? false);
            }
            if (filter.search) {
                const searchLower = filter.search.toLowerCase();
                filtered = filtered.filter(card =>
                    card.title.toLowerCase().includes(searchLower) ||
                    card.description?.toLowerCase().includes(searchLower)
                );
            }
        }

        // Only show cards with due dates
        filtered = filtered.filter(card => card.dueDate);

        return filtered;
    };

    const filteredCards = useMemo(() => getFilteredCards(), [cards, filter]);

    const timelineStart = initialStartDate || startOfMonth(currentDate);
    const timelineEnd = initialEndDate || endOfMonth(addMonths(currentDate, 2));
    const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;

    const getGroupedCards = () => {
        const groups: Record<string, KanbanCard[]> = {};

        filteredCards.forEach(card => {
            let key = 'Ungrouped';

            switch (groupBy) {
                case 'project':
                    key = card.project?.name || 'No Project';
                    break;
                case 'status':
                    const statusMap = { todo: 'To Do', inprogress: 'In Progress', done: 'Done' };
                    key = statusMap[card.status] || 'Unknown';
                    break;
                case 'priority':
                    const priorityMap: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' };
                    key = priorityMap[card.priority] || 'Unknown';
                    break;
                case 'none':
                default:
                    key = 'All Cards';
                    break;
            }

            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(card);
        });

        return groups;
    };

    const groupedCards = useMemo(() => getGroupedCards(), [filteredCards, groupBy]);

    const getStatusColor = (status: string) => {
        const colors = {
            todo: 'bg-surface-container-high',
            inprogress: 'bg-secondary-container',
            done: 'bg-success-container',
        };
        return colors[status as keyof typeof colors] || colors.todo;
    };

    const getPriorityIndicator = (priority: string) => {
        const colors = {
            low: 'bg-success',
            medium: 'bg-warning',
            high: 'bg-error',
        };
        return colors[priority as keyof typeof colors] || colors.medium;
    };

    const getCardPosition = (card: KanbanCard) => {
        if (!card.dueDate) return { left: 0, width: 0 };

        const startOffset = differenceInDays(card.createdAt, timelineStart);
        const duration = differenceInDays(card.dueDate, card.createdAt) + 1;

        const left = Math.max(0, (startOffset / totalDays) * 100);
        const width = Math.min(100 - left, (duration / totalDays) * 100);

        return { left, width };
    };

    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentDate(prev =>
            direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
        );
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const renderTimelineHeader = () => {
        const days = [];
        let currentDay = new Date(timelineStart);

        while (currentDay <= timelineEnd) {
            days.push(new Date(currentDay));
            currentDay = addDays(currentDay, 1);
        }

        return (
            <div className="flex border-b border-outline-variant/30">
                <div className="w-48 flex-shrink-0 p-3 bg-surface-container-high font-semibold text-xs text-on-surface-variant uppercase tracking-wide">
                    Card
                </div>
                <div className="flex-1 overflow-x-auto">
                    <div className="flex" style={{ width: `${totalDays * 40}px` }}>
                        {days.map((day, index) => (
                            <div
                                key={index}
                                className="flex-shrink-0 p-2 text-center border-r border-outline-variant/20"
                                style={{ width: '40px' }}
                            >
                                <div className="text-xs text-on-surface-variant">
                                    {format(day, 'MMM')}
                                </div>
                                <div className="text-sm font-medium text-on-surface">
                                    {format(day, 'd')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderTimelineRow = (card: KanbanCard) => {
        const { left, width } = getCardPosition(card);
        const isOverdue = card.dueDate && card.dueDate < new Date();

        return (
            <div className="flex border-b border-outline-variant/20 hover:bg-surface-container-highest/50 transition-colors">
                <div className="w-48 flex-shrink-0 p-3 bg-surface-container-high">
                    <div className="flex items-center gap-2">
                        <div
                            className={`w-2 h-2 rounded-full ${getPriorityIndicator(card.priority)}`}
                        />
                        <span className="text-sm font-medium text-on-surface truncate">
                            {card.title}
                        </span>
                    </div>
                    {card.project && (
                        <div className="mt-1 flex items-center gap-1">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: card.project.color }}
                            />
                            <span className="text-xs text-on-surface-variant truncate">
                                {card.project.name}
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-x-auto relative">
                    <div className="flex" style={{ width: `${totalDays * 40}px` }}>
                        {/* Grid lines */}
                        {Array.from({ length: totalDays }).map((_, index) => (
                            <div
                                key={index}
                                className="flex-shrink-0 h-full border-r border-outline-variant/10"
                                style={{ width: '40px' }}
                            />
                        ))}

                        {/* Card bar */}
                        {width > 0 && (
                            <div
                                onClick={() => onCardClick(card)}
                                className={`
                                    absolute top-2 bottom-2 rounded-md cursor-pointer transition-all duration-200
                                    ${getStatusColor(card.status)}
                                    hover:shadow-md hover:scale-105
                                    ${isOverdue ? 'ring-2 ring-error' : ''}
                                `}
                                style={{
                                    left: `${left}%`,
                                    width: `${Math.max(width, 2)}%`,
                                }}
                                title={`${card.title} (${format(card.createdAt, 'MMM d')} - ${card.dueDate ? format(card.dueDate, 'MMM d') : 'No due date'})`}
                            >
                                <div className="h-full p-2 flex items-center">
                                    <span className="text-xs font-medium text-on-surface truncate">
                                        {card.title}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-surface-container-low rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-surface-container-high border-b border-outline-variant/30">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <GanttChart className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold text-on-surface">
                            Timeline
                        </h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => navigateMonth('prev')}
                            className="p-1.5 rounded-md hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
                            aria-label="Previous month"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={goToToday}
                            className="px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-highest rounded-md transition-colors"
                        >
                            Today
                        </button>
                        <button
                            onClick={() => navigateMonth('next')}
                            className="p-1.5 rounded-md hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
                            aria-label="Next month"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3">
                    {/* Zoom Level */}
                    <div className="flex items-center gap-1 bg-surface-container-high rounded-lg p-1">
                        {(['day', 'week', 'month'] as TimelineZoom[]).map((level) => (
                            <button
                                key={level}
                                onClick={() => setZoom(level)}
                                className={`
                                    px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 capitalize
                                    ${zoom === level
                                        ? 'bg-surface text-on-surface shadow-sm'
                                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
                                    }
                                `}
                            >
                                {level}
                            </button>
                        ))}
                    </div>

                    {/* Group By */}
                    <select
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value as TimelineGroupBy)}
                        className="px-3 py-1.5 bg-surface-container-high rounded-lg text-sm text-on-surface focus:bg-surface-container-highest focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                    >
                        <option value="none">No Grouping</option>
                        <option value="project">Group by Project</option>
                        <option value="status">Group by Status</option>
                        <option value="priority">Group by Priority</option>
                    </select>
                </div>
            </div>

            {/* Timeline */}
            <div className="overflow-x-auto">
                {renderTimelineHeader()}

                {/* Grouped Cards */}
                {Object.entries(groupedCards).map(([groupName, groupCards]) => (
                    <div key={groupName}>
                        {/* Group Header */}
                        {groupBy !== 'none' && (
                            <div className="flex bg-surface-container-highest border-b border-outline-variant/30">
                                <div className="w-48 flex-shrink-0 p-3 font-semibold text-sm text-on-surface">
                                    {groupName}
                                    <span className="ml-2 text-xs text-on-surface-variant font-normal">
                                        ({groupCards.length})
                                    </span>
                                </div>
                                <div className="flex-1" />
                            </div>
                        )}

                        {/* Group Cards */}
                        <div>
                            {groupCards.map((card) => (
                                <div key={card.id}>
                                    {renderTimelineRow(card)}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-surface-container-high border-t border-outline-variant/30 text-xs text-on-surface-variant flex items-center justify-between">
                <span>
                    Showing {filteredCards.length} cards with due dates
                </span>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-surface-container-high" />
                        <span>To Do</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-secondary-container" />
                        <span>In Progress</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-success-container" />
                        <span>Done</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
