'use client';

import { useEffect, useState } from 'react';
import { Columns, Table2 } from 'lucide-react';

type ViewMode = 'kanban' | 'list';

interface ViewToggleProps {
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
}

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
            <button
                onClick={() => onViewModeChange('kanban')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                    viewMode === 'kanban'
                        ? 'bg-surface text-on-surface shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
                }`}
                aria-label="Kanban view"
                title="Kanban Board"
            >
                <Columns className="w-4 h-4" />
                <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
                onClick={() => onViewModeChange('list')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                    viewMode === 'list'
                        ? 'bg-surface text-on-surface shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
                }`}
                aria-label="List view"
                title="List View"
            >
                <Table2 className="w-4 h-4" />
                <span className="hidden sm:inline">List</span>
            </button>
        </div>
    );
}
