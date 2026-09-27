'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Package, Plus, ReceiptText } from 'lucide-react';
import LineItemRow, { LineItem } from './LineItemRow';
import { calculateLineTotal } from '@/lib/documents/calculations';
import ProductPicker from '@/components/products/ProductPicker';
import type { ProductPickResult } from '@/types';

export type { LineItem };

interface LineItemsTableProps {
  items: LineItem[];
  currency: string;
  onChange: (items: LineItem[]) => void;
  readOnly?: boolean;
  workspaceId?: string;
}

export default function LineItemsTable({
  items,
  currency,
  onChange,
  readOnly = false,
  workspaceId,
}: LineItemsTableProps) {
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowProductPicker(false);
      }
    };
    if (showProductPicker) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showProductPicker]);


  const handleUpdateItem = useCallback(
    (index: number, field: keyof LineItem, value: string | number) => {
      const newItems = [...items];
      newItems[index] = { ...newItems[index], [field]: value };
      newItems[index].total = calculateLineTotal(newItems[index]);
      onChange(newItems);
    },
    [items, onChange]
  );

  const handleAddItem = useCallback(() => {
    const newItem: LineItem = {
      id: `item-${Date.now()}`,
      description: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      taxRate: 0,
      total: 0,
    };
    onChange([...items, newItem]);
  }, [items, onChange]);

  const handleProductPick = useCallback(
    (result: ProductPickResult) => {
      const newItem: LineItem = {
        id: `item-${Date.now()}`,
        description: result.description,
        quantity: 1,
        unitPrice: result.unitPrice,
        discount: 0,
        taxRate: result.taxRate,
        total: calculateLineTotal({
          quantity: 1,
          unitPrice: result.unitPrice,
          discount: 0,
          taxRate: result.taxRate,
        }),
      };
      onChange([...items, newItem]);
    },
    [items, onChange]
  );

  const handleDeleteItem = useCallback(
    (index: number) => {
      const newItems = items.filter((_, i) => i !== index);
      onChange(newItems);
    },
    [items, onChange]
  );

  const handleReorderItems = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const newItems = [...items];
      const [removed] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, removed);
      onChange(newItems);
    },
    [items, onChange]
  );

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
    setDraggingIndex(index);
  };

  const handleDragOver = (index: number) => {
    if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
      setDropTargetIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (dragIndexRef.current !== null && dropTargetIndex !== null) {
      handleReorderItems(dragIndexRef.current, dropTargetIndex);
    }
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setDropTargetIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Card wrapper header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">Line Items</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {items.length === 0 ? 'No items added yet' : `${items.length} item${items.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Line Items */}
      <div
        className="space-y-3"
        onDragOver={(e) => e.preventDefault()}
      >
        {items.map((item, index) => (
          <LineItemRow
            key={item.id}
            item={item}
            index={index}
            currency={currency}
            isDragging={draggingIndex === index}
            isDropTarget={dropTargetIndex === index}
            onUpdate={handleUpdateItem}
            onDelete={handleDeleteItem}
            showDragHandle={!readOnly && items.length > 1}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {/* Empty State */}
      {items.length === 0 && (
        <div className="text-center py-12 px-4 bg-surface-container-low rounded-xl border-2 border-dashed border-outline-variant/20">
          <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-3">
            <ReceiptText className="h-6 w-6 text-secondary" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-on-surface mb-1">No items yet</p>
          <p className="text-xs text-on-surface-variant">
            Add line items using the buttons below
          </p>
        </div>
      )}

      {/* Add Item Buttons */}
      {!readOnly && (
        <div className="relative flex flex-col gap-3 sm:flex-row" ref={pickerRef}>
          <button
            onClick={handleAddItem}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-outline-variant/30 rounded-xl text-on-surface-variant hover:border-secondary/50 hover:text-secondary hover:bg-secondary/5 transition-all duration-200 group"
            aria-label="Add new line item"
          >
            <Plus className="h-5 w-5 transition-transform group-hover:scale-110" strokeWidth={1.75} />
            <span className="text-sm font-medium">Add Item</span>
          </button>

          {workspaceId ? (
            <button
              type="button"
              onClick={() => setShowProductPicker((value) => !value)}
              className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant/20 bg-surface px-4 py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
            >
              <Package className="h-4 w-4 text-secondary" strokeWidth={1.75} />
              Pick from catalog
            </button>
          ) : null}

          {workspaceId && showProductPicker ? (
            <ProductPicker
              workspaceId={workspaceId}
              currency={currency}
              onSelect={handleProductPick}
              onClose={() => setShowProductPicker(false)}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
