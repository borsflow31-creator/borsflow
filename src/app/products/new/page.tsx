'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import ProductFormFields from '@/components/products/ProductFormFields';
import { useAppStore } from '@/store/appStore';
import { useProductStore } from '@/store/productStore';
import { useI18n } from '@/i18n/I18nProvider';

function NewProductPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { currentWorkspaceId } = useAppStore();
  const { addProduct } = useProductStore();

  const workspaceId = searchParams.get('workspace') || currentWorkspaceId || '';
  const openAIDefault = searchParams.get('ai') === '1';
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // currentWorkspaceId is restored from localStorage after the first render; without
  // this gate a direct visit to /products/new flashes the "no workspace" screen.
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
    if (!workspaceId) return;

    const fetchCategories = async () => {
      try {
        const response = await fetch(`/api/products?workspaceId=${workspaceId}&page=1&limit=1`);
        const data = await response.json();
        if (response.ok) {
          setCategories(data.categories || []);
          // The list endpoint reports the caller's role, so a viewer who reaches this
          // URL directly is sent back rather than filling in a form the API will reject.
          if (data.role === 'viewer') {
            router.replace(`/products?workspace=${workspaceId}`);
          }
        }
      } catch {
        setCategories([]);
      }
    };

    fetchCategories();
  }, [router, workspaceId]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="skeleton mb-4 h-8 w-64 rounded" />
        <div className="skeleton h-32 w-96 rounded" />
      </div>
    );
  }

  if (!workspaceId) {
    return <NoWorkspace />;
  }

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
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
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
        throw new Error(data.error || t('products.newForm.createFailed'));
      }

      addProduct(data.product);
      router.push(`/products?workspace=${workspaceId}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('products.newForm.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      workspace={{ id: workspaceId, name: t('products.workspaceFallback') }}
      breadcrumbs={[
        { label: t('nav.products'), href: `/products?workspace=${workspaceId}` },
        { label: t('products.newProduct'), href: `/products/new?workspace=${workspaceId}` },
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
              <h1 className="text-2xl font-bold text-on-surface">{t('products.newProduct')}</h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                {t('products.newForm.subtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-medium text-on-secondary transition-colors hover:bg-secondary-dim disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : <Save className="h-4 w-4" strokeWidth={1.75} />}
            {t('products.newForm.createButton')}
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        ) : null}

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
            disabled={saving}
            openAIDefault={openAIDefault}
            customFieldValues={customFieldValues}
            onCustomFieldChange={(key, value) => setCustomFieldValues((current) => ({ ...current, [key]: value }))}
          />
        </div>
      </div>
    </AppShell>
  );
}

export default function NewProductPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-background">
          <div className="skeleton mb-4 h-8 w-64 rounded" />
          <div className="skeleton h-32 w-96 rounded" />
        </div>
      }
    >
      <NewProductPageInner />
    </Suspense>
  );
}
