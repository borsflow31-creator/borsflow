'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Sparkles, Wand2, X } from 'lucide-react';

interface ProductFormFieldsProps {
  workspaceId: string;
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  sku: string;
  setSku: (value: string) => void;
  price: string;
  setPrice: (value: string) => void;
  unit: string;
  setUnit: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  categories?: string[];
  onAddCategory?: (value: string) => void;
  taxRate: string;
  setTaxRate: (value: string) => void;
  stockQuantity: string;
  setStockQuantity: (value: string) => void;
  isActive: boolean;
  setIsActive: (value: boolean) => void;
  disabled?: boolean;
  openAIDefault?: boolean;
}

export default function ProductFormFields({
  workspaceId,
  name,
  setName,
  description,
  setDescription,
  sku,
  setSku,
  price,
  setPrice,
  unit,
  setUnit,
  category,
  setCategory,
  categories = [],
  onAddCategory,
  taxRate,
  setTaxRate,
  stockQuantity,
  setStockQuantity,
  isActive,
  setIsActive,
  disabled = false,
  openAIDefault = false,
}: ProductFormFieldsProps) {
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiReasoning, setAiReasoning] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(openAIDefault);
  const inputClassName =
    'w-full rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface transition-colors focus:outline-none focus:ring-2 focus:ring-secondary/50 disabled:opacity-50';
  const availableCategories = useMemo(
    () => Array.from(new Set(categories.filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [categories]
  );

  useEffect(() => {
    if (openAIDefault) {
      setShowAIAssistant(true);
    }
  }, [openAIDefault]);

  const handleAddCategory = () => {
    const normalized = newCategory.trim();
    if (!normalized) return;

    onAddCategory?.(normalized);
    setCategory(normalized);
    setNewCategory('');
    setIsAddingCategory(false);
  };

  const applySuggestion = (suggestion: {
    name?: string;
    description?: string;
    sku?: string;
    category?: string;
    unit?: string;
    price?: number | null;
    taxRate?: number | null;
    stockQuantity?: number | null;
    reasoning?: string;
  }) => {
    if (suggestion.name) setName(suggestion.name);
    if (suggestion.description) setDescription(suggestion.description);
    if (suggestion.sku) setSku(suggestion.sku);
    if (suggestion.category) {
      setCategory(suggestion.category);
      onAddCategory?.(suggestion.category);
    }
    if (suggestion.unit) setUnit(suggestion.unit);
    if (suggestion.price !== null && suggestion.price !== undefined) {
      setPrice(String(suggestion.price));
    }
    if (suggestion.taxRate !== null && suggestion.taxRate !== undefined) {
      setTaxRate(String(suggestion.taxRate));
    }
    if (suggestion.stockQuantity !== undefined) {
      setStockQuantity(
        suggestion.stockQuantity === null ? '' : String(suggestion.stockQuantity)
      );
    }
    setAiReasoning(suggestion.reasoning?.trim() || '');
  };

  const handleGenerateWithAI = async () => {
    const trimmedPrompt = aiPrompt.trim();
    if (!trimmedPrompt || aiLoading || disabled) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch('/api/products/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          prompt: trimmedPrompt,
          currentProduct: {
            name,
            description,
            sku,
            price,
            unit,
            category,
            taxRate,
            stockQuantity,
            isActive,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate product details');
      }

      applySuggestion(data.suggestion || {});
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : 'Failed to generate product details'
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-secondary/15 bg-gradient-to-br from-secondary/10 via-surface to-surface-container-low p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
              AI Product Assistant
            </div>
            <h2 className="mt-3 text-lg font-semibold text-on-surface">
              Turn a quick idea into a catalog-ready product
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Describe the item or service you want to sell and AI will draft the reusable product details for this workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAIAssistant((value) => !value)}
            disabled={disabled}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4" strokeWidth={1.75} />
            {showAIAssistant ? 'Hide AI' : 'Use AI'}
          </button>
        </div>

        {showAIAssistant ? (
          <div className="mt-5 rounded-xl border border-outline-variant/10 bg-surface/80 p-4">
            <label className="mb-2 block text-sm font-medium text-on-surface-variant">
              What should AI generate?
            </label>
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              rows={3}
              className={`${inputClassName} resize-none bg-surface-container`}
              placeholder="Example: Create a monthly social media management package for startups with a professional tone and a mid-market price."
              disabled={disabled || aiLoading}
            />

            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-on-surface-variant">
                AI can suggest name, description, SKU, category, unit, price, tax, and stock values.
              </p>
              <button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={disabled || aiLoading || !aiPrompt.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-on-secondary transition-colors hover:bg-secondary-dim disabled:opacity-40"
              >
                {aiLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                )}
                Generate details
              </button>
            </div>

            {aiError ? (
              <div className="mt-3 rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-sm text-error">
                {aiError}
              </div>
            ) : null}

            {aiReasoning ? (
              <div className="mt-3 rounded-lg border border-outline-variant/10 bg-surface-container-low px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  AI Notes
                </p>
                <p className="mt-1 text-sm text-on-surface">{aiReasoning}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-on-surface-variant">
            Name <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClassName}
            placeholder="Product name"
            disabled={disabled}
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-on-surface-variant">
            Description
          </label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className={`${inputClassName} resize-none`}
            placeholder="Helpful details your team will reuse in quotes and invoices"
            disabled={disabled}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-on-surface-variant">SKU</label>
          <input
            type="text"
            value={sku}
            onChange={(event) => setSku(event.target.value)}
            className={inputClassName}
            placeholder="e.g. PRO-001"
            disabled={disabled}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-on-surface-variant">
            Category
          </label>
          <div className="space-y-2">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={inputClassName}
              disabled={disabled}
            >
              <option value="">Select a category</option>
              {availableCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            {!isAddingCategory ? (
              <button
                type="button"
                onClick={() => setIsAddingCategory(true)}
                disabled={disabled}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/10 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Add category
              </button>
            ) : (
              <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low p-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    placeholder="New category name"
                    className={`${inputClassName} flex-1`}
                    disabled={disabled}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      disabled={disabled || !newCategory.trim()}
                      className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-on-secondary transition-colors hover:bg-secondary-dim disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCategory(false);
                        setNewCategory('');
                      }}
                      disabled={disabled}
                      className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
                      aria-label="Cancel adding category"
                    >
                      <X className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-on-surface-variant">
            Price <span className="text-error">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className={inputClassName}
            placeholder="0.00"
            disabled={disabled}
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-on-surface-variant">Unit</label>
          <input
            type="text"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            className={inputClassName}
            placeholder="e.g. seat, hour, item"
            disabled={disabled}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-on-surface-variant">
            Tax Rate (%)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={taxRate}
            onChange={(event) => setTaxRate(event.target.value)}
            className={inputClassName}
            placeholder="0"
            disabled={disabled}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-on-surface-variant">
            Stock Quantity
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={stockQuantity}
            onChange={(event) => setStockQuantity(event.target.value)}
            className={inputClassName}
            placeholder="Optional"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-on-surface">Active product</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Active products show up in the catalog picker for quotes and invoices.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            disabled={disabled}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              isActive ? 'bg-secondary' : 'bg-surface-container-high'
            } ${disabled ? 'opacity-50' : ''}`}
            aria-pressed={isActive}
            aria-label="Toggle active product"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
