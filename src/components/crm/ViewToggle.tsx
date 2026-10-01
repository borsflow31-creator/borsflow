'use client';

import { useEffect, useState } from 'react';
import { Columns, Table2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

type ViewMode = 'kanban' | 'list';

interface ViewToggleProps {
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
}

export default function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
    const { t } = useI18n();
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
                aria-label={t('crm.viewToggle.kanbanAria')}
                title={t('crm.viewToggle.kanbanTitle')}
            >
                <Columns className="w-4 h-4" />
                <span className="hidden sm:inline">{t('crm.viewToggle.kanbanLabel')}</span>
            </button>
            <button
                onClick={() => onViewModeChange('list')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                    viewMode === 'list'
                        ? 'bg-surface text-on-surface shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
                }`}
                aria-label={t('crm.viewToggle.listAria')}
                title={t('crm.viewToggle.listTitle')}
            >
                <Table2 className="w-4 h-4" />
                <span className="hidden sm:inline">{t('crm.viewToggle.listLabel')}</span>
            </button>
        </div>
    );
}
