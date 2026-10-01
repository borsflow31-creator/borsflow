'use client';

import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface ViewToggleProps {
  viewMode: 'grid' | 'table';
  onViewModeChange: (mode: 'grid' | 'table') => void;
  size?: 'sm' | 'md';
}

const sizeStyles = {
  sm: 'p-1.5',
  md: 'p-2',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
};

export default function ViewToggle({ viewMode, onViewModeChange, size = 'md' }: ViewToggleProps) {
  const { t } = useI18n();
  return (
    <div
      className="inline-flex items-center bg-surface-container-low rounded-lg"
      role="group"
      aria-label={t('documents.viewToggle.ariaLabel')}
    >
      <button
        onClick={() => onViewModeChange('grid')}
        className={`flex items-center justify-center rounded-md transition-all duration-200 ${
          viewMode === 'grid'
            ? 'bg-surface-container-highest text-secondary shadow-sm'
            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
        } ${sizeStyles[size]}`}
        aria-label={t('documents.viewToggle.gridView')}
        aria-pressed={viewMode === 'grid'}
        title={t('documents.viewToggle.gridView')}
      >
        <LayoutGrid className={iconSizes[size]} strokeWidth={1.75} />
      </button>
      <button
        onClick={() => onViewModeChange('table')}
        className={`flex items-center justify-center rounded-md transition-all duration-200 ${
          viewMode === 'table'
            ? 'bg-surface-container-highest text-secondary shadow-sm'
            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
        } ${sizeStyles[size]}`}
        aria-label={t('documents.viewToggle.tableView')}
        aria-pressed={viewMode === 'table'}
        title={t('documents.viewToggle.tableView')}
      >
        <List className={iconSizes[size]} strokeWidth={1.75} />
      </button>
    </div>
  );
}
