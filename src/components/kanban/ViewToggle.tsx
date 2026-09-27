'use client';

import { useEffect, useState } from 'react';
import { Columns, Table2, Calendar, GanttChart } from 'lucide-react';

type ViewMode = 'kanban' | 'list' | 'calendar' | 'timeline';

interface ViewToggleProps {
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
}

const VIEW_OPTIONS = [
    { id: 'kanban' as ViewMode, label: 'Kanban', icon: Columns, title: 'Kanban Board' },
    { id: 'list' as ViewMode, label: 'List', icon: Table2, title: 'List View' },
    { id: 'calendar' as ViewMode, label: 'Calendar', icon: Calendar, title: 'Calendar View' },
    { id: 'timeline' as ViewMode, label: 'Timeline', icon: GanttChart, title: 'Timeline View' },
];

export default function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
    const [mounted, setMounted] = useState(false);

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
