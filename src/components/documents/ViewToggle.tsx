'use client';

import React from 'react';
import { LayoutGrid, List } from 'lucide-react';

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
  return (
    <div
      className="inline-flex items-center bg-surface-container-low rounded-lg"
      role="group"
      aria-label="View mode toggle"
    >
      <button
        onClick={() => onViewModeChange('grid')}
        className={`flex items-center justify-center rounded-md transition-all duration-200 ${
          viewMode === 'grid'
            ? 'bg-surface-container-highest text-secondary shadow-sm'
            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
        } ${sizeStyles[size]}`}
        aria-label="Grid view"
        aria-pressed={viewMode === 'grid'}
        title="Grid view"
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
        aria-label="Table view"
        aria-pressed={viewMode === 'table'}
        title="Table view"
      >
        <List className={iconSizes[size]} strokeWidth={1.75} />
      </button>
    </div>
  );
}
