'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Package, Plus, Sparkles, Upload, XCircle } from 'lucide-react';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import FilterBar from '@/components/documents/FilterBar';
import ViewToggle from '@/components/documents/ViewToggle';
import SelectRefined from '@/components/ui/SelectRefined';
import ProductCard from '@/components/products/ProductCard';
import ProductTable from '@/components/products/ProductTable';
import CSVImportModal from '@/components/products/CSVImportModal';
import { useAppStore } from '@/store/appStore';
import { useProductStore } from '@/store/productStore';
import { buildPageWindow, errorFrom } from '@/lib/products';
import type { CSVImportResult, Product } from '@/types';

const PAGE_SIZE = 24;

const sortOptions = [
  { value: 'updated', label: 'Updated' },
  { value: 'name', label: 'Name' },
  { value: 'price', label: 'Price' },
  { value: 'stock', label: 'Stock' },
];

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active only' },
  { value: 'inactive', label: 'Inactive only' },
];

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
  const [workspaceName, setWorkspaceName] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Local mirror of the search box so typing stays responsive while the store (and
  // therefore the request) only updates once the user pauses.
  const [searchInput, setSearchInput] = useState(productsSearchQuery);

  const canWrite = role !== null && role !== 'viewer';

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
          throw new Error(await errorFrom(response, 'Failed to fetch products'));
        }

        const data = await response.json();
        setProducts(data.products || []);
        setCategories(data.categories || []);
        setRole(data.role ?? null);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(data.pagination?.totalPages || 1);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
        setError(fetchError instanceof Error ? fetchError.message : 'An error occurred');
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
        const response = await fetch(`/api/workspaces/${workspaceId}`);
        if (response.ok) {
          const data = await response.json();
          setWorkspaceName(data.workspace?.name || '');
        }
      } catch {
        setWorkspaceName('');
      }
    };

    fetchWorkspace();
  }, [workspaceId]);

  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'All Categories' },
      ...categories.map((category) => ({ value: category, label: category })),
    ],
    [categories]
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
      const skippedNote = result.skipped ? `, skipped ${result.skipped}` : '';
      addToast(
        `Imported ${result.created} product${result.created === 1 ? '' : 's'}${skippedNote}`,
        result.created > 0 ? 'success' : 'error'
      );
    }
    setPage(1);
    refreshProducts();
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete ${product.name}? This cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await errorFrom(response, 'Failed to delete product'));
      }

      // Mutation failures go to a toast rather than the page-level error panel, which
      // would replace the list the user is still working in.
      addToast(`${product.name} deleted`, 'success');

      // Deleting the last row of a page would otherwise strand the user on an empty one.
      if (products.length === 1 && page > 1) {
        setPage((value) => value - 1);
      } else {
        refreshProducts();
      }
    } catch (deleteError) {
      addToast(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete product',
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
      workspace={{ id: workspaceId, name: workspaceName || 'Workspace' }}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Products', href: `/products?workspace=${workspaceId}` },
      ]}
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-on-surface">Products</h1>
            <p className="mt-2 text-on-surface-variant">
              Build a reusable catalog for quotes and invoices.
            </p>
          </div>

          {canWrite ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push(`/products/new?workspace=${workspaceId}&ai=1`)}
                className="flex items-center gap-2 rounded-lg border border-secondary/20 bg-secondary/10 px-4 py-2.5 text-sm font-medium text-secondary transition-colors hover:bg-secondary/15"
              >
                <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                Generate with AI
              </button>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
              >
                <Upload className="h-4 w-4" strokeWidth={1.75} />
                Import CSV
              </button>
              <button
                type="button"
                onClick={() => router.push(`/products/new?workspace=${workspaceId}`)}
                className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-on-secondary transition-colors hover:bg-secondary-dim"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                New Product
              </button>
            </div>
          ) : null}
        </div>

        <div className="mb-5">
          <FilterBar
            searchQuery={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search products..."
            searchAriaLabel="Search products"
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
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && products.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-low px-6 py-16 text-center">
            <Package className="mx-auto h-14 w-14 text-on-surface-variant" strokeWidth={1.5} />
            <h2 className="mt-4 text-xl font-semibold text-on-surface">No products yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-on-surface-variant">
              {hasActiveFilters
                ? 'Try adjusting your filters or search terms.'
                : 'Create your first catalog item so your team can reuse it in documents.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 rounded-lg bg-surface px-5 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high"
              >
                Clear filters
              </button>
            ) : canWrite ? (
              <button
                type="button"
                onClick={() => router.push(`/products/new?workspace=${workspaceId}`)}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-medium text-on-secondary transition-colors hover:bg-secondary-dim"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Create your first product
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
            onEdit={(product) => router.push(`/products/${product.id}?workspace=${workspaceId}`)}
            onDelete={handleDelete}
          />
        ) : null}

        {!loading && products.length > 0 ? (
          <div className="mt-8 flex flex-col items-center gap-4">
            <p className="text-sm text-on-surface-variant">
              Showing {rangeStart}&ndash;{rangeEnd} of {total} product{total === 1 ? '' : 's'}
            </p>

            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page === 1}
                  className="rounded-lg bg-surface-container-low px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
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
                  Next
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showImportModal ? (
        <CSVImportModal
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
