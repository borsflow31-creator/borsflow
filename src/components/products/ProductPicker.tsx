'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Package, Search, X } from 'lucide-react';
import { formatMoney } from '@/lib/products';
import { useI18n } from '@/i18n/I18nProvider';
import type { ProductPickResult } from '@/types';

interface SearchProduct {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  taxRate: number;
  unit: string | null;
}

interface ProductPickerProps {
  workspaceId: string;
  onSelect: (result: ProductPickResult) => void;
  onClose: () => void;
  /** Currency of the document being edited, so catalog prices match the line items. */
  currency?: string;
}

export default function ProductPicker({
  workspaceId,
  onSelect,
  onClose,
  currency = 'USD',
}: ProductPickerProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          workspaceId,
          q: query,
          limit: '10',
        });

        const response = await fetch(`/api/products/search?${params.toString()}`);
        const data = await response.json();

        if (response.ok) {
          setProducts(data.products || []);
          setActiveIndex(0);
        } else {
          setProducts([]);
        }
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query, workspaceId]);

  const activeProduct = useMemo(() => products[activeIndex] || null, [activeIndex, products]);

  const handleSelect = (product: SearchProduct) => {
    const description = [product.name, product.description].filter(Boolean).join(' — ');

    onSelect({
      description,
      unitPrice: product.price,
      taxRate: product.taxRate,
      unit: product.unit,
    });
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(products.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter' && activeProduct) {
      event.preventDefault();
      handleSelect(activeProduct);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="absolute left-0 top-full z-30 mt-3 w-full max-w-xl overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface shadow-2xl">
      <div className="flex items-center justify-between border-b border-outline-variant/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
          <Package className="h-4 w-4 text-secondary" strokeWidth={1.75} />
          Pick from catalog
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          aria-label={t('misc.closeProductPicker')}
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      <div className="border-b border-outline-variant/10 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" strokeWidth={1.75} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('misc.searchProducts')}
            className="w-full rounded-lg bg-surface-container-low py-2 pl-9 pr-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50"
          />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-on-surface-variant" strokeWidth={1.75} />
          ) : null}
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {!loading && products.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-on-surface-variant">No matching products found.</p>
          </div>
        ) : null}

        {products.map((product, index) => (
          <button
            key={product.id}
            type="button"
            onClick={() => handleSelect(product)}
            onMouseEnter={() => setActiveIndex(index)}
            className={`w-full border-b border-outline-variant/10 px-4 py-3 text-left transition-colors last:border-b-0 ${
              index === activeIndex ? 'bg-secondary/8' : 'hover:bg-surface-container-low'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-on-surface">{product.name}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-on-surface-variant">
                  <span>{product.sku || 'No SKU'}</span>
                  <span>{product.taxRate}% tax</span>
                  {product.unit ? <span>{product.unit}</span> : null}
                </div>
                {product.description ? (
                  <p className="mt-2 truncate text-xs text-on-surface-variant">{product.description}</p>
                ) : null}
              </div>
              <p className="text-sm font-medium text-on-surface">{formatMoney(product.price, currency)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
