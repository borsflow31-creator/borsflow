'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { formatMoney } from '@/lib/products';
import { useI18n } from '@/i18n/I18nProvider';
import type { Product, ProductCustomField } from '@/types';
import { formatCustomValue } from '@/lib/product-custom-fields';

const MAX_CARD_CUSTOM_VALUES = 3;

interface ProductCardProps {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  /** Viewers see the card read-only, with no actions menu. */
  canWrite?: boolean;
  currency?: string;
  /** Workspace custom fields; up to 3 filled values show on the card */
  customFields?: ProductCustomField[];
}

export default function ProductCard({
  product,
  onEdit,
  onDelete,
  canWrite = true,
  currency = 'USD',
  customFields = [],
}: ProductCardProps) {
  const { t } = useI18n();
  const boolLabels = { yes: t('products.customFields.yes'), no: t('products.customFields.no') };
  const customValues = customFields
    .map((field) => ({ field, text: formatCustomValue(product.customFields?.[field.key], boolLabels) }))
    .filter((entry) => entry.text)
    .slice(0, MAX_CARD_CUSTOM_VALUES);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-on-surface">{product.name}</h3>
            <span
              className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                product.isActive
                  ? 'bg-success/10 text-success'
                  : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {product.isActive ? t('products.active') : t('products.inactive')}
            </span>
          </div>
          {product.description && (
            <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">
              {product.description}
            </p>
          )}
        </div>

        {canWrite ? (
        <div ref={ref} className="relative">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            aria-label={t('products.actionsAria')}
          >
            <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
          </button>

          {open && (
            <div className="absolute right-0 top-full z-20 mt-2 w-40 overflow-hidden rounded-lg border border-outline-variant/10 bg-surface shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-on-surface transition-colors hover:bg-surface-container-low"
              >
                <Pencil className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
                {t('common.edit')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-error transition-colors hover:bg-error/5"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                {t('common.delete')}
              </button>
            </div>
          )}
        </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-outline-variant/10 pt-4 text-sm">
        <div>
          <p className="text-on-surface-variant">{t('products.fields.price')}</p>
          <p className="mt-1 font-semibold text-on-surface">
            {formatMoney(product.price, currency)}
            {product.unit ? <span className="ml-1 font-normal text-on-surface-variant">/ {product.unit}</span> : null}
          </p>
        </div>
        <div>
          <p className="text-on-surface-variant">{t('products.fields.taxRate')}</p>
          <p className="mt-1 font-medium text-on-surface">{product.taxRate}%</p>
        </div>
        <div>
          <p className="text-on-surface-variant">{t('products.fields.sku')}</p>
          <p className="mt-1 truncate text-on-surface">{product.sku || '—'}</p>
        </div>
        <div>
          <p className="text-on-surface-variant">{t('products.fields.category')}</p>
          <p className="mt-1 truncate text-on-surface">{product.category || '—'}</p>
        </div>
        <div className="col-span-2">
          <p className="text-on-surface-variant">{t('products.stockLabel')}</p>
          <p className="mt-1 text-on-surface">
            {product.stockQuantity === null ? t('products.stockNotTracked') : product.stockQuantity}
          </p>
        </div>
      </div>

      {customValues.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {customValues.map(({ field, text }) => (
            <span
              key={field.id}
              title={`${field.label}: ${text}`}
              className="max-w-full truncate rounded-full bg-secondary/10 px-2.5 py-1 text-xs text-on-surface"
            >
              <span className="text-on-surface-variant">{field.label}:</span> {text}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
