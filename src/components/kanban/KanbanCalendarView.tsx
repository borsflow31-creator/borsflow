'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MoreVertical } from 'lucide-react';
import { startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';
import { useI18n } from '@/i18n/I18nProvider';

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

interface KanbanCalendarViewProps {
    cards: KanbanCard[];
    projects: KanbanProject[];
    onCardUpdate: (cardId: string, updates: any) => void;
    onCardClick: (card: KanbanCard) => void;
    filter?: KanbanFilter;
    currentDate?: Date;
}

type CalendarView = 'month' | 'week' | 'day';

export default function KanbanCalendarView({
    cards,
    projects,
    onCardUpdate,
    onCardClick,
    filter,
    currentDate: initialCurrentDate = new Date(),
}: KanbanCalendarViewProps) {
    const { t, formatDate } = useI18n();
    const [currentDate, setCurrentDate] = useState(initialCurrentDate);
    const [viewMode, setViewMode] = useState<CalendarView>('month');
    const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

    const WEEKDAY_LABELS = [
        t('kanban.weekdaySun'),
        t('kanban.weekdayMon'),
        t('kanban.weekdayTue'),
        t('kanban.weekdayWed'),
        t('kanban.weekdayThu'),
        t('kanban.weekdayFri'),
        t('kanban.weekdaySat'),
    ];

    const VIEW_MODE_LABELS: Record<CalendarView, string> = {
        month: t('kanban.unitMonth'),
        week: t('kanban.unitWeek'),
        day: t('kanban.unitDay'),
    };

    const getFilteredCards = () => {
        let filtered = [...cards];

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

        // Only show cards with due dates
        filtered = filtered.filter(card => card.dueDate);

        return filtered;
    };

    const filteredCards = useMemo(() => getFilteredCards(), [cards, filter]);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const getCardsForDay = (date: Date) => {
        return filteredCards.filter(card =>
            card.dueDate && isSameDay(card.dueDate, date)
        );
    };

    const isOverdue = (date: Date) => {
        return date < new Date() && !isSameDay(date, new Date());
    };

    const getStatusColor = (status: string) => {
        const colors = {
            todo: 'bg-surface-container-high border-l-4 border-l-on-surface-variant',
            inprogress: 'bg-secondary-container border-l-4 border-l-secondary',
            done: 'bg-success-container border-l-4 border-l-success',
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

    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentDate(prev =>
            direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
        );
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const handleDragStart = (e: React.DragEvent, cardId: string) => {
        e.dataTransfer.setData('cardId', cardId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, newDate: Date) => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData('cardId');
        if (cardId) {
            onCardUpdate(cardId, { dueDate: newDate });
        }
    };

    return (
        <div className="bg-surface-container-low rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-surface-container-high border-b border-outline-variant/30">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold text-on-surface">
                            {formatDate(currentDate, { month: 'long', year: 'numeric' })}
                        </h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => navigateMonth('prev')}
                            className="p-1.5 rounded-md hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
                            aria-label={t('kanban.previousMonthAria')}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={goToToday}
                            className="px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-highest rounded-md transition-colors"
                        >
                            {t('kanban.today')}
                        </button>
                        <button
                            onClick={() => navigateMonth('next')}
                            className="p-1.5 rounded-md hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
                            aria-label={t('kanban.nextMonthAria')}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-surface-container-high rounded-lg p-1">
                    {(['month', 'week', 'day'] as CalendarView[]).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`
                                px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 capitalize
                                ${viewMode === mode
                                    ? 'bg-surface text-on-surface shadow-sm'
                                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
                                }
                            `}
                        >
                            {VIEW_MODE_LABELS[mode]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Calendar Grid */}
            {viewMode === 'month' && (
                <div className="p-4">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-2 mb-2">
                        {WEEKDAY_LABELS.map((day) => (
                            <div
                                key={day}
                                className="text-center text-xs font-semibold text-on-surface-variant uppercase tracking-wide py-2"
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days */}
                    <div className="grid grid-cols-7 gap-2">
                        {calendarDays.map((date) => {
                            const dayCards = getCardsForDay(date);
                            const isCurrentMonth = isSameMonth(date, currentDate);
                            const isToday = isSameDay(date, new Date());
                            const dayIsOverdue = isOverdue(date);

                            return (
                                <div
                                    key={date.toISOString()}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, date)}
                                    className={`
                                        min-h-24 p-2 rounded-lg border transition-all duration-200
                                        ${isToday
                                            ? 'border-secondary bg-secondary-container/10'
                                            : 'border-outline-variant/20 bg-surface-container-high/50'
                                        }
                                        ${!isCurrentMonth ? 'opacity-40' : ''}
                                        hover:border-secondary/50 hover:bg-surface-container-highest
                                    `}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span
                                            className={`
                                                text-sm font-medium
                                                ${isToday ? 'text-secondary' : 'text-on-surface'}
                                                ${dayIsOverdue && !isToday ? 'text-error' : ''}
                                            `}
                                        >
                                            {formatDate(date, { day: 'numeric' })}
                                        </span>
                                        {dayCards.length > 0 && (
                                            <span className="text-xs text-on-surface-variant bg-surface-container-low px-1.5 py-0.5 rounded">
                                                {dayCards.length}
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        {dayCards.slice(0, 3).map((card) => (
                                            <div
                                                key={card.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, card.id)}
                                                onClick={() => onCardClick(card)}
                                                onMouseEnter={() => setHoveredCardId(card.id)}
                                                onMouseLeave={() => setHoveredCardId(null)}
                                                className={`
                                                    ${getStatusColor(card.status)}
                                                    p-1.5 rounded text-xs cursor-pointer transition-all duration-200
                                                    hover:shadow-md hover:scale-105
                                                `}
                                                title={card.title}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <div
                                                        className={`w-1.5 h-1.5 rounded-full ${getPriorityIndicator(card.priority)}`}
                                                    />
                                                    <span className="truncate flex-1">{card.title}</span>
                                                </div>
                                                {card.project && (
                                                    <div
                                                        className="mt-1 h-0.5 rounded-full"
                                                        style={{ backgroundColor: card.project.color }}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                        {dayCards.length > 3 && (
                                            <div className="text-xs text-on-surface-variant text-center py-1">
                                                {t('kanban.moreCardsCount', { count: dayCards.length - 3 })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Week and Day Views (Simplified) */}
            {(viewMode === 'week' || viewMode === 'day') && (
                <div className="flex items-center justify-center py-16 text-center">
                    <div>
                        <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-on-surface-variant/30" />
                        <h3 className="text-lg font-semibold text-on-surface mb-2">
                            {viewMode === 'week' ? t('kanban.weekViewTitle') : t('kanban.dayViewTitle')}
                        </h3>
                        <p className="text-sm text-on-surface-variant max-w-sm">
                            {viewMode === 'week'
                                ? t('kanban.weekViewComingSoon')
                                : t('kanban.dayViewComingSoon')}
                        </p>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="px-6 py-3 bg-surface-container-high border-t border-outline-variant/30 text-xs text-on-surface-variant flex items-center justify-between">
                <span>
                    {t('kanban.showingCardsWithDueDates', { count: filteredCards.length })}
                </span>
                <span className="text-on-surface-variant/60">
                    {t('kanban.dragToChangeDueDatesHint')}
                </span>
            </div>
        </div>
    );
}
