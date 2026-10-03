'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import ProductFormFields from '@/components/products/ProductFormFields';
import { useAppStore } from '@/store/appStore';
import { useProductStore } from '@/store/productStore';
import { useI18n } from '@/i18n/I18nProvider';

function ProductDetailPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { currentWorkspaceId } = useAppStore();
  const { setCurrentProduct, updateProduct, deleteProduct } = useProductStore();

  const productId = params.id as string;
  const [workspaceId, setWorkspaceId] = useState(searchParams.get('workspace') || currentWorkspaceId || '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('0');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [taxRate, setTaxRate] = useState('0');
  const [stockQuantity, setStockQuantity] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [currency, setCurrency] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`/api/products?workspaceId=${workspaceId || searchParams.get('workspace') || currentWorkspaceId || ''}&page=1&limit=1`);
        const data = await response.json();
        if (response.ok) {
          setCategories(data.categories || []);
          setCurrency(data.currency);
          // The list endpoint reports the caller's role, so a viewer who reaches this
          // URL directly is sent back rather than editing a form the API will reject.
          if (data.role === 'viewer') {
            setCanWrite(false);
            router.replace(`/products?workspace=${workspaceId}`);
          }
        }
      } catch {
        setCategories([]);
      }
    };

    if (workspaceId || searchParams.get('workspace') || currentWorkspaceId) {
      fetchCategories();
    }
  }, [currentWorkspaceId, router, searchParams, workspaceId]);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/products/${productId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || t('products.detail.loadFailed'));
        }

        setCurrentProduct(data.product);
        setWorkspaceId(data.product.workspaceId);
        setName(data.product.name);
        setDescription(data.product.description || '');
        setSku(data.product.sku || '');
        setPrice(String(data.product.price ?? 0));
        setUnit(data.product.unit || '');
        setCategory(data.product.category || '');
        setCategories((current) => {
          const next = data.product.category ? [...current, data.product.category] : current;
          return Array.from(new Set(next.filter(Boolean))).sort((left, right) => left.localeCompare(right));
        });
        setTaxRate(String(data.product.taxRate ?? 0));
        setStockQuantity(
          data.product.stockQuantity === null || data.product.stockQuantity === undefined
            ? ''
            : String(data.product.stockQuantity)
        );
        setIsActive(Boolean(data.product.isActive));
        setCustomFieldValues(
          data.product.customFields && typeof data.product.customFields === 'object' ? data.product.customFields : {}
        );
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : t('products.detail.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, setCurrentProduct, t]);

  const handleAddCategory = (value: string) => {
    setCategories((current) =>
      current.includes(value) ? current : [...current, value].sort((left, right) => left.localeCompare(right))
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('products.nameRequired'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          sku,
          price,
          unit,
          category,
          taxRate,
          stockQuantity,
          isActive,
          customFields: customFieldValues,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('products.detail.saveFailed'));
      }

      updateProduct(productId, data.product);
      router.push(`/products?workspace=${workspaceId}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('products.detail.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('products.deleteConfirm', { name }))) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('products.deleteFailed'));
      }

      deleteProduct(productId);
      router.push(`/products?workspace=${workspaceId}`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('products.deleteFailed'));
      setSaving(false);
    }
  };

  return (
    <AppShell
      workspace={workspaceId ? { id: workspaceId, name: t('products.workspaceFallback') } : undefined}
      breadcrumbs={[
        { label: t('nav.products'), href: `/products?workspace=${workspaceId}` },
        { label: name || t('products.detail.editFallback'), href: `/products/${productId}?workspace=${workspaceId}` },
      ]}
    >
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push(`/products?workspace=${workspaceId}`)}
              className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
              aria-label={t('products.backToProductsAria')}
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-on-surface">
                {loading ? t('products.detail.loadingTitle') : name || t('products.detail.editFallback')}
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                {t('products.detail.subtitle')}
              </p>
            </div>
          </div>

          {canWrite ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || saving}
              className="flex items-center gap-2 rounded-lg border border-error/20 px-4 py-2.5 text-sm font-medium text-error transition-colors hover:bg-error/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              {t('common.delete')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-medium text-on-secondary transition-colors hover:bg-secondary-dim disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : <Save className="h-4 w-4" strokeWidth={1.75} />}
              {t('products.detail.saveButton')}
            </button>
          </div>
          ) : null}
        </div>

        {error ? (
          <div className="mb-6 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-secondary" strokeWidth={1.75} />
          </div>
        ) : (
          <div className="rounded-2xl bg-surface p-6 shadow-sm">
            <ProductFormFields
              workspaceId={workspaceId}
              name={name}
              setName={setName}
              description={description}
              setDescription={setDescription}
              sku={sku}
              setSku={setSku}
              price={price}
              setPrice={setPrice}
              unit={unit}
              setUnit={setUnit}
              category={category}
              setCategory={setCategory}
              categories={categories}
              onAddCategory={handleAddCategory}
              taxRate={taxRate}
              setTaxRate={setTaxRate}
              stockQuantity={stockQuantity}
              setStockQuantity={setStockQuantity}
              isActive={isActive}
              setIsActive={setIsActive}
              disabled={saving || !canWrite}
              canManageFields={canWrite}
              customFieldValues={customFieldValues}
              currency={currency}
              onCustomFieldChange={(key, value) => setCustomFieldValues((current) => ({ ...current, [key]: value }))}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-background">
          <div className="skeleton mb-4 h-8 w-64 rounded" />
          <div className="skeleton h-32 w-96 rounded" />
        </div>
      }
    >
      <ProductDetailPageInner />
    </Suspense>
  );
}
