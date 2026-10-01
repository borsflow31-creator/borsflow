'use client';

import React, { useState } from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  statusOptions: { value: string; label: string }[];
  sortBy: string;
  onSortChange: (sort: string) => void;
  sortOptions: { value: string; label: string }[];
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
  /** Overrides for non-document surfaces (e.g. the product catalog). */
  searchPlaceholder?: string;
  searchAriaLabel?: string;
}

export default function FilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  statusOptions,
  sortBy,
  onSortChange,
  sortOptions,
  onClearFilters,
  hasActiveFilters = false,
  searchPlaceholder = 'Search documents...',
  searchAriaLabel = 'Search documents',
}: FilterBarProps) {
  const { t } = useI18n();
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-on-surface-variant" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
            aria-label={searchAriaLabel}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label={t('documents.filterBar.clearSearch')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status Filter — omitted when the surface has nothing to filter by,
            rather than rendering a dropdown with a single inert option. */}
        {statusOptions.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 ${
              statusFilter !== 'all'
                ? 'bg-secondary/10 text-secondary border border-secondary/20'
                : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
            }`}
            aria-expanded={showStatusDropdown}
            aria-haspopup="listbox"
          >
            <Filter className="h-4 w-4" strokeWidth={1.75} />
            <span className="text-sm font-medium">
              {statusOptions.find((opt) => opt.value === statusFilter)?.label || 'Status'}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showStatusDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowStatusDropdown(false)}
              />
              <div className="absolute right-0 top-full mt-2 z-20 w-56 bg-surface rounded-lg shadow-lg border border-outline-variant/10 py-1">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onStatusChange(option.value);
                      setShowStatusDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      statusFilter === option.value
                        ? 'bg-secondary/10 text-secondary'
                        : 'text-on-surface hover:bg-surface-container-low'
                    }`}
                    role="option"
                    aria-selected={statusFilter === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        )}

        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-low text-on-surface hover:bg-surface-container-high rounded-lg transition-all duration-200"
            aria-expanded={showSortDropdown}
            aria-haspopup="listbox"
          >
            <span className="text-sm font-medium">
              {sortOptions.find((opt) => opt.value === sortBy)?.label || 'Sort'}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showSortDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showSortDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowSortDropdown(false)}
              />
              <div className="absolute right-0 top-full mt-2 z-20 w-56 bg-surface rounded-lg shadow-lg border border-outline-variant/10 py-1">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onSortChange(option.value);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      sortBy === option.value
                        ? 'bg-secondary/10 text-secondary'
                        : 'text-on-surface hover:bg-surface-container-low'
                    }`}
                    role="option"
                    aria-selected={sortBy === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && onClearFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-all duration-200"
            aria-label={t('documents.filterBar.clearFilters')}
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
            <span>{t('documents.filterBar.clear')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
