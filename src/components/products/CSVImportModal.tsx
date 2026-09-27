'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import type { CSVImportResult, ProductCSVField } from '@/types';

type Step = 'upload' | 'map' | 'preview' | 'import' | 'done';

interface CSVImportModalProps {
  workspaceId: string;
  onClose: () => void;
  onImported: (result?: CSVImportResult) => void;
}

const PRODUCT_FIELDS: Array<{ key: ProductCSVField; label: string; required?: boolean }> = [
  { key: 'name', label: 'Name', required: true },
  { key: 'description', label: 'Description' },
  { key: 'sku', label: 'SKU' },
  { key: 'price', label: 'Price', required: true },
  { key: 'unit', label: 'Unit' },
  { key: 'category', label: 'Category' },
  { key: 'taxRate', label: 'Tax Rate' },
  { key: 'stockQuantity', label: 'Stock Quantity' },
];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;

    const columns: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];

      if (char === '"') {
        if (inQuotes && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === ',' || char === ';' || char === '\t') && !inQuotes) {
        columns.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    columns.push(current);
    rows.push(columns);
  }

  return rows;
}

function autoMatch(header: string): ProductCSVField {
  const normalized = header.toLowerCase().replace(/[^a-z]/g, '');

  if (/^(name|product|productname|item|itemname|title)$/.test(normalized)) return 'name';
  if (/^(description|details|summary|notes)$/.test(normalized)) return 'description';
  if (/^(sku|code|ref|reference|productcode)$/.test(normalized)) return 'sku';
  if (/^(price|cost|rate|amount|unitprice)$/.test(normalized)) return 'price';
  if (/^(unit|uom|measure)$/.test(normalized)) return 'unit';
  if (/^(category|group|type)$/.test(normalized)) return 'category';
  if (/^(tax|taxrate|vat)$/.test(normalized)) return 'taxRate';
  if (/^(stock|qty|quantity|inventory|stockquantity)$/.test(normalized)) return 'stockQuantity';

  return '__skip__';
}

export default function CSVImportModal({
  workspaceId,
  onClose,
  onImported,
}: CSVImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ProductCSVField[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<CSVImportResult | null>(null);

  const processFile = (file: File) => {
    setError('');

    if (!file.name.match(/\.(csv|tsv|txt)$/i)) {
      setError('Please upload a CSV, TSV, or TXT file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || '');
      const parsedRows = parseCSV(text);

      if (parsedRows.length < 2) {
        setError('Your file needs a header row and at least one product row.');
        return;
      }

      const [headerRow, ...dataRows] = parsedRows;
      const filteredRows = dataRows.filter((row) => row.some((cell) => cell.trim()));

      setHeaders(headerRow);
      setRows(filteredRows);
      setMapping(headerRow.map(autoMatch));
      setFileName(file.name);
      setStep('map');
    };
    reader.onerror = () => setError('Failed to read the selected file.');
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, []);

  const mappedProducts = useMemo(
    () =>
      rows.map((row) => {
        const product: Record<string, string> = {};
        headers.forEach((_, index) => {
          const field = mapping[index];
          if (field && field !== '__skip__') {
            product[field] = row[index] ?? '';
          }
        });
        return product;
      }),
    [headers, mapping, rows]
  );

  const previewFields = PRODUCT_FIELDS.filter((field) => mapping.includes(field.key));
  const canContinue = mapping.includes('name') && mapping.includes('price');

  const handleImport = async () => {
    setStep('import');
    setError('');

    try {
      const response = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, products: mappedProducts }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setResult(data);
      setStep('done');
      onImported(data);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import failed');
      setStep('preview');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant/10 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">Import Products</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Upload a CSV and map its columns into your shared catalog.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            aria-label="Close import modal"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex items-center gap-3 border-b border-outline-variant/10 px-6 py-4">
          {(['upload', 'map', 'preview', 'import', 'done'] as Step[]).map((item, index) => {
            const order: Step[] = ['upload', 'map', 'preview', 'import', 'done'];
            const currentIndex = order.indexOf(step);
            const itemIndex = order.indexOf(item);
            const isComplete = itemIndex < currentIndex;
            const isCurrent = itemIndex === currentIndex;

            return (
              <div key={item} className="flex items-center gap-3">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    isCurrent
                      ? 'bg-secondary text-on-secondary'
                      : isComplete
                        ? 'bg-secondary/15 text-secondary'
                        : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {index + 1}
                </div>
                <span
                  className={`hidden text-sm capitalize sm:inline ${
                    isCurrent ? 'font-medium text-on-surface' : 'text-on-surface-variant'
                  }`}
                >
                  {item}
                </span>
                {index < 4 ? <div className="hidden h-px w-6 bg-outline-variant/20 sm:block" /> : null}
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="mb-4 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          ) : null}

          {step === 'upload' ? (
            <div className="space-y-5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
                  dragOver
                    ? 'border-secondary bg-secondary/5'
                    : 'border-outline-variant/30 bg-surface-container-low hover:border-secondary/40 hover:bg-surface-container'
                }`}
              >
                <Upload className="mb-3 h-10 w-10 text-on-surface-variant" strokeWidth={1.75} />
                <p className="text-base font-medium text-on-surface">
                  Drop your file here or click to choose one
                </p>
                <p className="mt-2 text-sm text-on-surface-variant">
                  CSV, TSV, and TXT files are supported
                </p>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) processFile(file);
                }}
              />
            </div>
          ) : null}

          {step === 'map' ? (
            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                {rows.length} rows found in <span className="font-medium text-on-surface">{fileName}</span>.
              </p>

              <div className="overflow-x-auto rounded-xl border border-outline-variant/10">
                <table className="w-full min-w-[720px]">
                  <thead className="bg-surface-container-low">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        File Column
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        Sample
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        Maps To
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {headers.map((header, index) => (
                      <tr key={`${header}-${index}`}>
                        <td className="px-4 py-3 text-sm font-medium text-on-surface">{header}</td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-sm text-on-surface-variant">
                          {rows[0]?.[index] || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={mapping[index]}
                            onChange={(event) => {
                              const next = [...mapping];
                              next[index] = event.target.value as ProductCSVField;
                              setMapping(next);
                            }}
                            className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50"
                          >
                            <option value="__skip__">Skip</option>
                            {PRODUCT_FIELDS.map((field) => (
                              <option key={field.key} value={field.key}>
                                {field.label}
                                {field.required ? ' *' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {step === 'preview' ? (
            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                Previewing the first {Math.min(5, mappedProducts.length)} rows before import.
              </p>

              <div className="overflow-x-auto rounded-xl border border-outline-variant/10">
                <table className="w-full min-w-[720px]">
                  <thead className="bg-surface-container-low">
                    <tr>
                      {previewFields.map((field) => (
                        <th
                          key={field.key}
                          className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant"
                        >
                          {field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {mappedProducts.slice(0, 5).map((product, index) => (
                      <tr key={`preview-${index}`}>
                        {previewFields.map((field) => (
                          <td key={field.key} className="px-4 py-3 text-sm text-on-surface">
                            {product[field.key] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {step === 'import' ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
              <Loader2 className="mb-4 h-10 w-10 animate-spin text-secondary" strokeWidth={1.75} />
              <h3 className="text-lg font-semibold text-on-surface">Importing products</h3>
              <p className="mt-2 max-w-md text-sm text-on-surface-variant">
                Creating catalog entries from {mappedProducts.length} mapped rows.
              </p>
            </div>
          ) : null}

          {step === 'done' && result ? (
            <div className="space-y-5">
              <div className="rounded-xl bg-surface-container-low p-5">
                <h3 className="text-lg font-semibold text-on-surface">Import complete</h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {result.created} created, {result.skipped} skipped.
                </p>
              </div>

              {result.errors.length > 0 ? (
                <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4">
                  <p className="mb-3 text-sm font-medium text-on-surface">Row-level errors</p>
                  <div className="max-h-52 space-y-2 overflow-y-auto text-sm text-on-surface-variant">
                    {result.errors.map((item) => (
                      <p key={`${item.row}-${item.message}`}>
                        Row {item.row}: {item.message}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-outline-variant/10 px-6 py-4">
          <div>
            {step !== 'upload' && step !== 'import' && step !== 'done' ? (
              <button
                type="button"
                onClick={() => setStep(step === 'map' ? 'upload' : 'map')}
                className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
              >
                Back
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            >
              {step === 'done' ? 'Close' : 'Cancel'}
            </button>

            {step === 'map' ? (
              <button
                type="button"
                onClick={() => setStep('preview')}
                disabled={!canContinue}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-on-secondary transition-colors hover:bg-secondary-dim disabled:cursor-not-allowed disabled:opacity-40"
              >
                Preview
              </button>
            ) : null}

            {step === 'preview' ? (
              <button
                type="button"
                onClick={handleImport}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-on-secondary transition-colors hover:bg-secondary-dim"
              >
                Import {mappedProducts.length} products
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
