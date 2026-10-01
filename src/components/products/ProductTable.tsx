'use client';

import { createPortal } from 'react-dom';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '@/lib/products';
import { useI18n } from '@/i18n/I18nProvider';
import type { Product } from '@/types';

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  /** Viewers get the table without the actions column. */
  canWrite?: boolean;
  currency?: string;
}

function ProductTableActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedTrigger = ref.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);

      if (!clickedTrigger && !clickedMenu) {
        setOpen(false);
      }
    };

    const updateMenuPosition = () => {
      if (!open || !buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.right - 160,
      });
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);
    updateMenuPosition();

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPosition({
              top: rect.bottom + 8,
              left: rect.right - 160,
            });
          }
          setOpen((value) => !value);
        }}
        className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
        aria-label={t('products.actionsAria')}
      >
        <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {open && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[100] w-40 overflow-hidden rounded-lg border border-outline-variant/10 bg-surface shadow-xl"
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
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
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export default function ProductTable({
  products,
  onEdit,
  onDelete,
  canWrite = true,
  currency = 'USD',
}: ProductTableProps) {
  const { t } = useI18n();
  const baseHeaders = [
    t('products.fields.name'),
    t('products.fields.sku'),
    t('products.fields.category'),
    t('products.fields.price'),
    t('products.fields.taxRate'),
    t('products.stockLabel'),
    t('products.statusLabel'),
  ];
  const headers = canWrite ? [...baseHeaders, t('products.actionsLabel')] : baseHeaders;

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px]">
          <thead className="bg-surface-container-low">
            <tr>
              {headers.map(
                (header, index) => (
                  <th
                    key={header}
                    className={`px-5 py-3 text-xs font-medium uppercase tracking-wider text-on-surface-variant ${
                      index >= 3 && index !== 6 ? 'text-right' : 'text-left'
                    }`}
                  >
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {products.map((product) => (
              <tr key={product.id} className="transition-colors hover:bg-surface-container-low/60">
                <td className="px-5 py-4">
                  <div>
                    <p className="font-medium text-on-surface">{product.name}</p>
                    {product.unit && (
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {t('products.unitPrefix', { unit: product.unit })}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-on-surface">{product.sku || '—'}</td>
                <td className="px-5 py-4 text-sm text-on-surface">{product.category || '—'}</td>
                <td className="px-5 py-4 text-right text-sm font-medium text-on-surface">
                  {formatMoney(product.price, currency)}
                </td>
                <td className="px-5 py-4 text-right text-sm text-on-surface">{product.taxRate}%</td>
                <td className="px-5 py-4 text-right text-sm text-on-surface">
                  {product.stockQuantity === null ? '—' : product.stockQuantity}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      product.isActive
                        ? 'bg-success/10 text-success'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {product.isActive ? t('products.active') : t('products.inactive')}
                  </span>
                </td>
                {canWrite ? (
                  <td className="px-5 py-4 text-right">
                    <ProductTableActions
                      onEdit={() => onEdit(product)}
                      onDelete={() => onDelete(product)}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
