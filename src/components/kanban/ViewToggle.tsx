'use client';

import { useEffect, useState } from 'react';
import { Columns, Table2, Calendar, GanttChart } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

type ViewMode = 'kanban' | 'list' | 'calendar' | 'timeline';

interface ViewToggleProps {
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
}

export default function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
    const { t } = useI18n();
    const [mounted, setMounted] = useState(false);

    const VIEW_OPTIONS = [
        { id: 'kanban' as ViewMode, label: t('kanban.viewKanbanLabel'), icon: Columns, title: t('kanban.viewKanbanTitle') },
        { id: 'list' as ViewMode, label: t('kanban.viewListLabel'), icon: Table2, title: t('kanban.viewListTitle') },
        { id: 'calendar' as ViewMode, label: t('kanban.viewCalendarLabel'), icon: Calendar, title: t('kanban.viewCalendarTitle') },
        { id: 'timeline' as ViewMode, label: t('kanban.viewTimelineLabel'), icon: GanttChart, title: t('kanban.viewTimelineTitle') },
    ];

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    return (
        <div className="flex items-center gap-1 bg-surface-container-high rounded-lg p-1">
            {VIEW_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = viewMode === option.id;

                return (
                    <button
                        key={option.id}
                        onClick={() => onViewModeChange(option.id)}
                        className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
                            ${isActive
                                ? 'bg-surface text-on-surface shadow-sm'
                                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
                            }
                        `}
                        aria-label={option.title}
                        title={option.title}
                    >
                        <Icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

export type { ViewMode };
