'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Package, Plus, SlidersHorizontal, Sparkles, Upload, XCircle } from 'lucide-react';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import FilterBar from '@/components/documents/FilterBar';
import ViewToggle from '@/components/documents/ViewToggle';
import SelectRefined from '@/components/ui/SelectRefined';
import ProductCard from '@/components/products/ProductCard';
import ProductTable from '@/components/products/ProductTable';
import ProductImportModal from '@/components/products/ProductImportModal';
import ProductCustomFieldsModal from '@/components/products/ProductCustomFieldsModal';
import CurrencySelect from '@/components/products/CurrencySelect';
import { useProductCustomFields } from '@/components/products/useProductCustomFields';
import { useAppStore } from '@/store/appStore';
import { useProductStore } from '@/store/productStore';
import { buildPageWindow, errorFrom } from '@/lib/products';
import { useI18n } from '@/i18n/I18nProvider';
import type { CSVImportResult, Product } from '@/types';
import { cachedJson } from '@/lib/client-cache';

const PAGE_SIZE = 24;

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success' ? 'bg-success' : 'bg-error'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <XCircle className="h-4 w-4" strokeWidth={1.75} />
          )}
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function ProductsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="rounded-xl border border-outline-variant/10 bg-surface p-5 shadow-sm"
        >
          <div className="skeleton mb-3 h-5 w-2/3 rounded" />
          <div className="skeleton mb-6 h-4 w-full rounded" />
          <div className="grid grid-cols-2 gap-3 border-t border-outline-variant/10 pt-4">
            <div className="skeleton h-10 rounded" />
            <div className="skeleton h-10 rounded" />
            <div className="skeleton h-10 rounded" />
            <div className="skeleton h-10 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="skeleton mb-4 h-8 w-64 rounded" />
      <div className="skeleton h-32 w-96 rounded" />
    </div>
  );
}

function ProductsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { currentWorkspaceId } = useAppStore();
  const {
    products,
    setProducts,
    productsViewMode,
    setProductsViewMode,
    productsSearchQuery,
    setProductsSearchQuery,
    productsCategoryFilter,
    setProductsCategoryFilter,
    productsActiveFilter,
    setProductsActiveFilter,
  } = useProductStore();

  const workspaceId = searchParams.get('workspace') || currentWorkspaceId || '';
  const [hydrated, setHydrated] = useState(false);
  const [sortBy, setSortBy] = useState('updated');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [workspaceName, setWorkspaceName] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFieldsModal, setShowFieldsModal] = useState(false);
  const { fields: customFields } = useProductCustomFields(workspaceId);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Local mirror of the search box so typing stays responsive while the store (and
  // therefore the request) only updates once the user pauses.
  const [searchInput, setSearchInput] = useState(productsSearchQuery);

  const canWrite = role !== null && role !== 'viewer';

  const sortOptions = useMemo(
    () => [
      { value: 'updated', label: t('products.sortUpdated') },
      { value: 'name', label: t('products.sortName') },
      { value: 'price', label: t('products.sortPrice') },
      { value: 'stock', label: t('products.sortStock') },
    ],
    [t]
  );

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('products.statusAll') },
      { value: 'active', label: t('products.statusActiveOnly') },
      { value: 'inactive', label: t('products.statusInactiveOnly') },
    ],
    [t]
  );

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, type }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3500);
  }, []);

  // currentWorkspaceId is restored from localStorage after the first render; without
  // this gate a direct visit to /products flashes the "no workspace" screen.
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

  useEffect(() => {
    const timer = setTimeout(() => setProductsSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput, setProductsSearchQuery]);

  // Any change to what is being listed invalidates the current page number —
  // filtering from page 3 would otherwise land on an empty page.
  const isFirstFilterRun = useRef(true);
  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      return;
    }
    setPage(1);
  }, [productsSearchQuery, productsCategoryFilter, productsActiveFilter, sortBy]);

  useEffect(() => {
    if (!workspaceId) return;

    const controller = new AbortController();
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          workspaceId,
          page: String(page),
          limit: String(PAGE_SIZE),
          sort: sortBy,
        });

        if (productsSearchQuery) params.set('search', productsSearchQuery);
        if (productsCategoryFilter !== 'all') params.set('category', productsCategoryFilter);
        if (productsActiveFilter !== 'all') {
          params.set('isActive', productsActiveFilter === 'active' ? 'true' : 'false');
        }

        const response = await fetch(`/api/products?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await errorFrom(response, t('products.fetchFailed')));
        }

        const data = await response.json();
        setProducts(data.products || []);
        setCategories(data.categories || []);
        setRole(data.role ?? null);
        if (data.currency) setCurrency(data.currency);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(data.pagination?.totalPages || 1);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
        setError(fetchError instanceof Error ? fetchError.message : t('common.error'));
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
    return () => controller.abort();
  }, [
    page,
    productsActiveFilter,
    productsCategoryFilter,
    productsSearchQuery,
    refreshKey,
    setProducts,
    sortBy,
    workspaceId,
  ]);

  useEffect(() => {
    if (!workspaceId) return;

    const fetchWorkspace = async () => {
      try {
        const data = await cachedJson(`/api/workspaces/${workspaceId}`);
        setWorkspaceName(data.workspace?.name || '');
      } catch {
        setWorkspaceName('');
      }
    };

    fetchWorkspace();
  }, [workspaceId]);

  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: t('products.allCategories') },
      ...categories.map((category) => ({ value: category, label: category })),
    ],
    [categories, t]
  );

  const hasActiveFilters =
    productsSearchQuery !== '' ||
    productsCategoryFilter !== 'all' ||
    productsActiveFilter !== 'all';

  /** Re-runs the list query with every active filter intact. */
  const refreshProducts = useCallback(() => setRefreshKey((value) => value + 1), []);

  const clearFilters = () => {
    setSearchInput('');
    setProductsSearchQuery('');
    setProductsCategoryFilter('all');
    setProductsActiveFilter('all');
  };

  const handleImported = (result?: CSVImportResult) => {
    if (result) {
      const skippedNote = result.skipped ? t('products.importedSkipped', { count: result.skipped }) : '';
      addToast(
        `${t('products.imported', { count: result.created })}${skippedNote}`,
        result.created > 0 ? 'success' : 'error'
      );
    }
    setPage(1);
    refreshProducts();
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(t('products.deleteConfirm', { name: product.name }))) return;

    try {
      const response = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await errorFrom(response, t('products.deleteFailed')));
      }

      // Mutation failures go to a toast rather than the page-level error panel, which
      // would replace the list the user is still working in.
      addToast(t('products.deletedToast', { name: product.name }), 'success');

      // Deleting the last row of a page would otherwise strand the user on an empty one.
      if (products.length === 1 && page > 1) {
        setPage((value) => value - 1);
      } else {
        refreshProducts();
      }
    } catch (deleteError) {
      addToast(
        deleteError instanceof Error ? deleteError.message : t('products.deleteFailed'),
        'error'
      );
    }
  };

  if (!hydrated) {
    return <PageSkeleton />;
  }

  if (!workspaceId) {
    return <NoWorkspace />;
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <AppShell
      workspace={{ id: workspaceId, name: workspaceName || t('products.workspaceFallback') }}
      breadcrumbs={[
        { label: t('nav.dashboard'), href: '/dashboard' },
        { label: t('nav.products'), href: `/products?workspace=${workspaceId}` },
      ]}
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-on-surface">{t('nav.products')}</h1>
            <p className="mt-2 text-on-surface-variant">
              {t('products.subtitle')}
            </p>
          </div>

          {canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <CurrencySelect
                workspaceId={workspaceId}
                currency={currency}
                canChange={role === 'owner' || role === 'admin'}
                onChanged={(code) => {
                  setCurrency(code);
                  addToast(t('products.currency.changed', { currency: code }), 'success');
                }}
                onError={(message) => addToast(message, 'error')}
              />
              <button
                type="button"
                onClick={() => router.push(`/products/new?workspace=${workspaceId}&ai=1`)}
                className="flex items-center gap-2 rounded-lg border border-secondary/20 bg-secondary/10 px-4 py-2.5 text-sm font-medium text-secondary transition-colors hover:bg-secondary/15"
              >
                <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                {t('products.generateWithAI')}
              </button>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
              >
                <Upload className="h-4 w-4" strokeWidth={1.75} />
                {t('products.import')}
              </button>
              <button
                type="button"
                onClick={() => setShowFieldsModal(true)}
                className="flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
              >
                <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />
                {t('products.customFields.title')}
                {customFields.length > 0 ? (
                  <span className="rounded-full bg-secondary/15 px-1.5 text-xs font-semibold text-secondary">{customFields.length}</span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/products/new?workspace=${workspaceId}`)}
                className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-on-secondary transition-colors hover:bg-secondary-dim"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                {t('products.newProduct')}
              </button>
            </div>
          ) : null}
        </div>

        <div className="mb-5">
          <FilterBar
            searchQuery={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder={t('products.searchPlaceholder')}
            searchAriaLabel={t('products.searchAria')}
            statusFilter={productsCategoryFilter}
            onStatusChange={setProductsCategoryFilter}
            statusOptions={categoryOptions}
            sortBy={sortBy}
            onSortChange={setSortBy}
            sortOptions={sortOptions}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          />
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ViewToggle viewMode={productsViewMode} onViewModeChange={setProductsViewMode} />

          <SelectRefined
            value={productsActiveFilter}
            options={statusOptions}
            onChange={setProductsActiveFilter}
            className="w-full sm:w-48"
          />
        </div>

        {loading ? <ProductsSkeleton /> : null}

        {error && !loading ? (
          <div className="rounded-xl border border-error/20 bg-error/10 p-5 text-center">
            <p className="text-sm text-error">{error}</p>
            <button
              type="button"
              onClick={refreshProducts}
              className="mt-3 rounded-lg bg-surface px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
            >
              {t('common.tryAgain')}
            </button>
          </div>
        ) : null}

        {!loading && !error && products.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-low px-6 py-16 text-center">
            <Package className="mx-auto h-14 w-14 text-on-surface-variant" strokeWidth={1.5} />
            <h2 className="mt-4 text-xl font-semibold text-on-surface">{t('products.emptyTitle')}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-on-surface-variant">
              {hasActiveFilters
                ? t('products.emptyFilteredSubtitle')
                : t('products.emptySubtitle')}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 rounded-lg bg-surface px-5 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high"
              >
                {t('common.clearFilters')}
              </button>
            ) : canWrite ? (
              <button
                type="button"
                onClick={() => router.push(`/products/new?workspace=${workspaceId}`)}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-medium text-on-secondary transition-colors hover:bg-secondary-dim"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                {t('products.createFirst')}
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && products.length > 0 && productsViewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                canWrite={canWrite}
                currency={currency}
                customFields={customFields}
                onEdit={() => router.push(`/products/${product.id}?workspace=${workspaceId}`)}
                onDelete={() => handleDelete(product)}
              />
            ))}
          </div>
        ) : null}

        {!loading && products.length > 0 && productsViewMode === 'table' ? (
          <ProductTable
            products={products}
            canWrite={canWrite}
            currency={currency}
            onEdit={(product) => router.push(`/products/${product.id}?workspace=${workspaceId}`)}
            onDelete={handleDelete}
          />
        ) : null}

        {!loading && products.length > 0 ? (
          <div className="mt-8 flex flex-col items-center gap-4">
            <p className="text-sm text-on-surface-variant">
              {t('products.showingRange', { start: rangeStart, end: rangeEnd, total })}
            </p>

            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page === 1}
                  className="rounded-lg bg-surface-container-low px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('common.previous')}
                </button>

                {buildPageWindow(page, totalPages).map((entry, index) =>
                  entry === 'ellipsis' ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="px-2 text-sm text-on-surface-variant"
                      aria-hidden="true"
                    >
                      &hellip;
                    </span>
                  ) : (
                    <button
                      key={entry}
                      type="button"
                      onClick={() => setPage(entry)}
                      aria-current={page === entry ? 'page' : undefined}
                      className={`rounded-lg px-4 py-2 text-sm font-medium ${
                        page === entry
                          ? 'bg-secondary text-on-secondary'
                          : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      {entry}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg bg-surface-container-low px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('common.next')}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showFieldsModal ? (
        <ProductCustomFieldsModal workspaceId={workspaceId} onClose={() => setShowFieldsModal(false)} />
      ) : null}

      {showImportModal ? (
        <ProductImportModal
          workspaceId={workspaceId}
          onClose={() => setShowImportModal(false)}
          onImported={handleImported}
        />
      ) : null}

      <ToastContainer toasts={toasts} />
    </AppShell>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProductsPageInner />
    </Suspense>
  );
}
