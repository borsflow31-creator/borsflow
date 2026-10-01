'use client';

import React from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  total: number;
}

interface LineItemRowProps {
  item: LineItem;
  index: number;
  currency: string;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onUpdate: (index: number, field: keyof LineItem, value: string | number) => void;
  onDelete: (index: number) => void;
  showDragHandle?: boolean;
  onDragStart?: (index: number) => void;
  onDragOver?: (index: number) => void;
  onDragEnd?: () => void;
}

export default function LineItemRow({
  item,
  index,
  currency,
  isDragging = false,
  isDropTarget = false,
  onUpdate,
  onDelete,
  showDragHandle = true,
  onDragStart,
  onDragOver,
  onDragEnd,
}: LineItemRowProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const { t } = useI18n();
  const handleInputChange = (field: keyof LineItem, value: string) => {
    if (field === 'description') {
      onUpdate(index, field, value);
      return;
    }
    let numValue = parseFloat(value) || 0;
    if (field === 'quantity' && numValue < 1) numValue = 1;
    if (field === 'discount' && (numValue < 0 || numValue > 100)) numValue = Math.max(0, Math.min(100, numValue));
    if (field === 'taxRate' && (numValue < 0 || numValue > 100)) numValue = Math.max(0, Math.min(100, numValue));
    if (field === 'unitPrice' && numValue < 0) numValue = 0;
    onUpdate(index, field, numValue);
  };

  return (
    <div
      className={`group relative border rounded-xl bg-surface transition-all duration-200 ${
        isDragging
          ? 'opacity-40 scale-[0.98] shadow-none border-outline-variant/20'
          : isDropTarget
          ? 'border-secondary/60 bg-secondary/5 shadow-md'
          : 'border-outline-variant/20 hover:shadow-md hover:border-outline-variant/40'
      }`}
      role="row"
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(index); }}
    >
      {/* Row number badge */}
      <span className="absolute -top-2.5 -left-2.5 z-10 w-5 h-5 rounded-full bg-secondary text-on-secondary text-[10px] font-bold flex items-center justify-center shadow-sm">
        {index + 1}
      </span>

      <div className="p-4 sm:p-5 grid grid-cols-12 gap-x-3 gap-y-3 items-end">

        {/* Drag Handle */}
        {showDragHandle && (
          <div className="col-span-1 flex items-center justify-center pb-1">
            <button
              className="p-1 text-on-surface-variant/40 hover:text-on-surface-variant cursor-grab active:cursor-grabbing transition-colors touch-none"
              aria-label={t('documents.lineItem.dragToReorder')}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                onDragStart?.(index);
              }}
              onDragEnd={() => onDragEnd?.()}
            >
              <GripVertical className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        )}

        {/* Description */}
        <div className={showDragHandle ? 'col-span-11 sm:col-span-5' : 'col-span-12 sm:col-span-6'}>
          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">{t('documents.lineItem.descriptionLabel')}</label>
          <input
            type="text"
            value={item.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder={t('documents.lineItem.descriptionPlaceholder')}
            className="w-full px-0 py-1.5 bg-transparent border-0 border-b border-outline-variant/30 text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-secondary transition-all text-sm"
            aria-label={`Item ${index + 1} description`}
            required
          />
        </div>

        {/* Quantity */}
        <div className="col-span-6 sm:col-span-2">
          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Qty</label>
          <input
            type="number"
            min="1"
            step="1"
            value={item.quantity}
            onChange={(e) => handleInputChange('quantity', e.target.value)}
            className="w-full px-3 py-1.5 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-sm"
            aria-label={`Item ${index + 1} quantity`}
            required
          />
        </div>

        {/* Unit Price */}
        <div className="col-span-6 sm:col-span-2">
          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">{t('documents.lineItem.unitPriceLabel')}</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-xs font-medium">{currency}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={item.unitPrice}
              onChange={(e) => handleInputChange('unitPrice', e.target.value)}
              className="w-full pl-9 pr-2 py-1.5 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-sm"
              aria-label={`Item ${index + 1} unit price`}
              required
            />
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block sm:col-span-12 border-t border-outline-variant/10 my-1" />

        {/* Discount + Tax + Total in second row */}
        <div className={showDragHandle ? 'col-span-1 hidden sm:block' : 'col-span-0 hidden'} />

        <div className="col-span-4 sm:col-span-2">
          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Discount %</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={item.discount}
              onChange={(e) => handleInputChange('discount', e.target.value)}
              className="w-full px-3 py-1.5 pr-6 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-sm"
              aria-label={`Item ${index + 1} discount percentage`}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-xs">%</span>
          </div>
        </div>

        <div className="col-span-4 sm:col-span-2">
          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Tax %</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={item.taxRate}
              onChange={(e) => handleInputChange('taxRate', e.target.value)}
              className="w-full px-3 py-1.5 pr-6 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-sm"
              aria-label={`Item ${index + 1} tax rate`}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-xs">%</span>
          </div>
        </div>

        <div className="col-span-4 sm:col-span-3">
          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">{t('documents.lineItem.totalLabel')}</label>
          <div className="px-3 py-1.5 bg-secondary/8 border border-secondary/20 rounded-lg text-on-surface font-semibold text-sm text-right">
            {formatCurrency(item.total)}
          </div>
        </div>

        {/* Delete Button — hidden until hover */}
        <div className="col-span-12 sm:col-span-3 flex items-end justify-end">
          <button
            onClick={() => onDelete(index)}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3 py-1.5 text-xs text-error hover:bg-error/10 rounded-lg transition-all duration-150"
            aria-label={`Delete item ${index + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t('documents.lineItem.remove')}
          </button>
        </div>
      </div>
    </div>
  );
}
