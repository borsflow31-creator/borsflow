'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useAppStore } from '@/store/appStore';
import { errorFrom } from '@/lib/products';
import FilterBar from '@/components/documents/FilterBar';
import ViewToggle from '@/components/documents/ViewToggle';
import { Plus, FileText, MoreVertical, Loader2, Trash2, LayoutTemplate } from 'lucide-react';
import NoWorkspace from '@/components/NoWorkspace';
import { ToastContainer, type ToastType } from '@/components/Toast';
import TemplatePickerModal from '@/components/templates/TemplatePickerModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageWithWorkspace {
  id: string;
  title: string;
  icon: string | null;
  coverImage: string | null;
  workspaceId: string;
  parentId: string | null;
  order: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  workspace: { id: string; name: string };
}

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const sortOptions = [
  { value: 'updatedAt', label: 'Last Updated' },
  { value: 'title', label: 'Title' },
  { value: 'createdAt', label: 'Created' },
];

// Pages have no status dimension; an empty list tells FilterBar to omit the control.
const statusOptions: { value: string; label: string }[] = [];

const dateFormat: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

// ─── PageActions ──────────────────────────────────────────────────────────────

/**
 * The menu is rendered into `document.body` rather than next to its trigger: in
 * table view it would otherwise be clipped by the scroll container the table needs
 * on narrow screens.
 */
function PageActions({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const MENU_WIDTH = 176;

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - MENU_WIDTH),
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    // A portalled menu does not travel with its trigger, so close on anything
    // that would move it out from under the pointer.
    const close = () => setOpen(false);

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!open) place();
          setOpen((o) => !o);
        }}
        className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
        aria-label="Page actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && coords && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ position: 'fixed', top: coords.top, left: coords.left, width: MENU_WIDTH }}
              className="z-50 bg-surface rounded-xl shadow-lg border border-outline-variant/20 py-1"
            >
              <button
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onDelete();
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-error hover:bg-error/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

// ─── PageCard ─────────────────────────────────────────────────────────────────

function PageCard({
  page,
  canDelete,
  onDelete,
}: {
  page: PageWithWorkspace;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="bg-surface rounded-xl p-6 hover:shadow-lg transition-all duration-200 group border border-outline-variant/10 hover:border-outline-variant/30 focus-within:border-outline-variant/30">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {page.icon ? (
            <span className="text-2xl flex-shrink-0">{page.icon}</span>
          ) : (
            <FileText className="h-6 w-6 flex-shrink-0 text-on-surface-variant" strokeWidth={1.5} />
          )}
          {/* A real link rather than a click handler on the card: keyboard
              reachable, and supports middle-click / open-in-new-tab. */}
          <Link
            href={`/pages/${page.id}`}
            className="text-base font-semibold text-on-surface hover:text-secondary focus-visible:text-secondary transition-colors line-clamp-2 leading-snug focus-visible:outline-none focus-visible:underline after:absolute after:inset-0 after:content-['']"
          >
            {page.title || 'Untitled'}
          </Link>
        </div>
        {canDelete && (
          <div className="flex-shrink-0 ml-2 relative z-10">
            <PageActions onDelete={onDelete} />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10 text-xs text-on-surface-variant">
        <span className="truncate">{page.workspace?.name || '—'}</span>
        <span className="flex-shrink-0 ml-2">
          {new Date(page.updatedAt).toLocaleDateString('en-US', dateFormat)}
        </span>
      </div>
    </div>
  );
}

// ─── PageRow ──────────────────────────────────────────────────────────────────

function PageRow({
  page,
  canDelete,
  onOpen,
  onDelete,
}: {
  page: PageWithWorkspace;
  canDelete: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    // The row click is a mouse convenience; the title link is what makes the row
    // reachable by keyboard and openable in a new tab.
    <tr onClick={onOpen} className="hover:bg-surface-container-low cursor-pointer transition-colors group">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {page.icon ? (
            <span className="text-lg">{page.icon}</span>
          ) : (
            <FileText className="h-5 w-5 text-on-surface-variant" strokeWidth={1.5} />
          )}
          <Link
            href={`/pages/${page.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-on-surface hover:text-secondary focus-visible:text-secondary transition-colors focus-visible:outline-none focus-visible:underline"
          >
            {page.title || 'Untitled'}
          </Link>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-on-surface-variant">{page.workspace?.name || '—'}</td>
      <td className="px-6 py-4 text-sm text-on-surface-variant text-right whitespace-nowrap">
        {new Date(page.updatedAt).toLocaleDateString('en-US', dateFormat)}
      </td>
      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
        {canDelete && <PageActions onDelete={onDelete} />}
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function PagesPageInner() {
  const { currentWorkspaceId } = useAppStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const effectiveWorkspaceId = searchParams.get('workspace') || currentWorkspaceId || '';

  const [pages, setPages] = useState<PageWithWorkspace[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [creating, setCreating] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Deleting requires workspace admin (the API returns 403 otherwise), so the
  // action is hidden rather than offered and then refused.
  const canDelete = role === 'owner' || role === 'admin';

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  // currentWorkspaceId is restored from localStorage after the first render; without
  // this gate a direct visit to /pages flashes the "no workspace" screen.
  // Runs client-side only: zustand omits the persist API during SSR.
  useEffect(() => {
    const store = useAppStore.persist;
    if (!store) {
      setHydrated(true);
      return;
    }
    if (store.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return store.onFinishHydration(() => setHydrated(true));
  }, []);

  // Keeps typing responsive while the derived list only recomputes once the user pauses.
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetches on workspace change only. Search and sort are applied to the fetched
  // array below — they used to sit in this dependency list, so every keystroke
  // issued a request whose result was then filtered client-side anyway.
  useEffect(() => {
    if (!effectiveWorkspaceId) return;

    const controller = new AbortController();

    const fetchPages = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/pages?workspaceId=${effectiveWorkspaceId}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(await errorFrom(res, 'Failed to fetch pages'));
        const data = await res.json();
        setPages(data.pages || []);
        setRole(data.role ?? null);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
    return () => controller.abort();
  }, [effectiveWorkspaceId, refreshKey]);

  const visiblePages = useMemo(() => {
    const sorted = [...pages];
    if (sortBy === 'updatedAt') {
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (sortBy === 'title') {
      sorted.sort((a, b) => (a.title || 'Untitled').localeCompare(b.title || 'Untitled'));
    } else if (sortBy === 'createdAt') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => (p.title || 'untitled').toLowerCase().includes(q));
  }, [pages, searchQuery, sortBy]);

  const handleCreate = async () => {
    if (!effectiveWorkspaceId || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled', workspaceId: effectiveWorkspaceId }),
      });
      if (!res.ok) throw new Error(await errorFrom(res, 'Failed to create page'));
      const data = await res.json();
      router.push(`/pages/${data.page.id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to create page', 'error');
      setCreating(false);
    }
  };

  const handleDelete = async (page: PageWithWorkspace) => {
    if (!confirm(`Delete "${page.title || 'Untitled'}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/pages/${page.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await errorFrom(res, 'Failed to delete page'));
      setPages((prev) => prev.filter((p) => p.id !== page.id));
      addToast(`"${page.title || 'Untitled'}" deleted`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete page', 'error');
    }
  };

  const hasActiveFilters = searchQuery !== '';

  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  if (!hydrated) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-on-surface-variant" />
        </div>
      </AppShell>
    );
  }

  if (!effectiveWorkspaceId) {
    return <NoWorkspace />;
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-on-surface mb-2">Pages</h1>
          <p className="text-on-surface-variant">Create and manage your pages</p>
        </div>

        {/* Filter Bar */}
        <div className="mb-6">
          <FilterBar
            searchQuery={searchInput}
            onSearchChange={setSearchInput}
            statusFilter="all"
            onStatusChange={() => {}}
            statusOptions={statusOptions}
            sortBy={sortBy}
            onSortChange={setSortBy}
            sortOptions={sortOptions}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            searchPlaceholder="Search pages..."
            searchAriaLabel="Search pages"
          />
        </div>

        {/* View Toggle + Create */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            {!loading && !error && (
              <span className="text-sm text-on-surface-variant">
                {visiblePages.length} {visiblePages.length === 1 ? 'page' : 'pages'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplatePicker(true)}
              className="flex items-center gap-2 px-3 py-2.5 bg-surface border border-outline-variant text-on-surface-variant rounded-lg hover:bg-surface-container transition-colors text-sm font-medium"
            >
              <LayoutTemplate className="h-4 w-4" strokeWidth={1.75} />
              From Template
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" strokeWidth={1.75} />
              )}
              New Page
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-on-surface-variant" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-error/10 border border-error/20 rounded-lg p-6 text-center">
            <p className="text-sm text-error mb-3">{error}</p>
            <button
              onClick={() => setRefreshKey((v) => v + 1)}
              className="px-4 py-2 bg-secondary text-on-secondary rounded-lg text-sm font-medium hover:bg-secondary-dim transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && visiblePages.length === 0 && (
          <div className="bg-surface-container-low rounded-xl p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-on-surface-variant opacity-40" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-on-surface mb-2">
              {hasActiveFilters ? 'No pages match your search' : 'No pages yet'}
            </h3>
            <p className="text-sm text-on-surface-variant mb-6">
              {hasActiveFilters
                ? 'Try adjusting your search query.'
                : 'Get started by creating your first page.'}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={1.75} />}
                Create Page
              </button>
            )}
          </div>
        )}

        {/* Grid view */}
        {!loading && !error && visiblePages.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visiblePages.map((page) => (
              <div key={page.id} className="relative">
                <PageCard
                  page={page}
                  canDelete={canDelete}
                  onDelete={() => handleDelete(page)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Table view */}
        {!loading && !error && visiblePages.length > 0 && viewMode === 'table' && (
          <div className="bg-surface rounded-xl border border-outline-variant/10 overflow-x-auto">
            <table className="w-full min-w-[40rem]">
              <thead className="bg-surface-container-low">
                <tr>
                  {['Page', 'Workspace', 'Last Updated', ''].map((h, i) => (
                    <th
                      key={i}
                      scope="col"
                      className={`px-6 py-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider ${
                        i >= 2 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {visiblePages.map((page) => (
                  <PageRow
                    key={page.id}
                    page={page}
                    canDelete={canDelete}
                    onOpen={() => router.push(`/pages/${page.id}`)}
                    onDelete={() => handleDelete(page)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <TemplatePickerModal
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        type="page"
        workspaceId={effectiveWorkspaceId}
      />
    </AppShell>
  );
}

export default function PagesPage() {
  return (
    <Suspense>
      <PagesPageInner />
    </Suspense>
  );
}
