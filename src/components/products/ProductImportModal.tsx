'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, SlidersHorizontal, Upload, X } from 'lucide-react';
import { MAX_IMPORT_PRODUCTS } from '@/lib/products';
import {
  MAX_SPREADSHEET_BYTES,
  SPREADSHEET_ACCEPT,
  SpreadsheetError,
  decodeTextFile,
  isDelimitedFile,
  isExcelFile,
  isLegacyExcelFile,
  parseDelimited,
  readExcelWorkbook,
  type SheetData,
} from '@/lib/spreadsheet';
import { useI18n } from '@/i18n/I18nProvider';
import type { CSVImportResult, ProductCSVField } from '@/types';
import {
  CUSTOM_MAPPING_PREFIX,
  coerceCustomValue,
  guessFieldType,
  normalizeHeader,
} from '@/lib/product-custom-fields';
import { useProductCustomFields } from './useProductCustomFields';
import { NewCustomFieldForm, useFieldTypeLabels } from './ProductCustomFieldsModal';

/** A column maps to a built-in field, a custom field (`custom:<key>`), or nothing. */
type Mapping = ProductCSVField | `custom:${string}`;
const NEW_FIELD_OPTION = '__new__';

type Step = 'upload' | 'sheet' | 'map' | 'preview' | 'import' | 'done';

interface ProductImportModalProps {
  workspaceId: string;
  onClose: () => void;
  onImported: (result?: CSVImportResult) => void;
}

const PRODUCT_FIELD_KEYS: Array<{ key: Exclude<ProductCSVField, '__skip__'>; required?: boolean }> = [
  { key: 'name', required: true },
  { key: 'description' },
  { key: 'sku' },
  { key: 'price', required: true },
  { key: 'unit' },
  { key: 'category' },
  { key: 'taxRate' },
  { key: 'stockQuantity' },
];

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

function describeFileError(error: unknown, fallbackMessage: string): string {
  if (error instanceof SpreadsheetError) return error.message;
  console.error('Product import: could not read the selected file', error);
  return fallbackMessage;
}

export default function ProductImportModal({
  workspaceId,
  onClose,
  onImported,
}: ProductImportModalProps) {
  const { t } = useI18n();
  const fieldLabels: Record<Exclude<ProductCSVField, '__skip__'>, string> = {
    name: t('products.fields.name'),
    description: t('products.fields.description'),
    sku: t('products.fields.sku'),
    price: t('products.fields.price'),
    unit: t('products.fields.unit'),
    category: t('products.fields.category'),
    taxRate: t('products.fields.taxRate'),
    stockQuantity: t('products.fields.stockQuantity'),
  };
  const PRODUCT_FIELDS = useMemo(
    () => PRODUCT_FIELD_KEYS.map((field) => ({ ...field, label: fieldLabels[field.key] })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );
  const stepLabels: Record<Step, string> = {
    upload: t('products.importModal.steps.upload'),
    sheet: t('products.importModal.steps.sheet'),
    map: t('products.importModal.steps.map'),
    preview: t('products.importModal.steps.preview'),
    import: t('products.importModal.steps.import'),
    done: t('products.importModal.steps.done'),
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [reading, setReading] = useState(false);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping[]>([]);
  // Columns the user has set by hand; automatic matching never overrides those
  const [touched, setTouched] = useState<Set<number>>(new Set());
  // Column whose "create custom field" form is open
  const [creatingFor, setCreatingFor] = useState<number | null>(null);
  const { fields: customFields, create: createCustomField } = useProductCustomFields(workspaceId);
  const typeLabels = useFieldTypeLabels();
  const customByKey = useMemo(() => new Map(customFields.map((field) => [field.key, field])), [customFields]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<CSVImportResult | null>(null);

  // The sheet picker only exists for multi-sheet workbooks, so the progress
  // rail is derived rather than fixed.
  const steps = useMemo<Step[]>(
    () =>
      sheets.length > 1
        ? ['upload', 'sheet', 'map', 'preview', 'import', 'done']
        : ['upload', 'map', 'preview', 'import', 'done'],
    [sheets.length]
  );

  const applyTable = useCallback(
    (table: string[][], name: string) => {
      const [headerRow, ...dataRows] = table;
      const filledRows = dataRows.filter((row) => row.some((cell) => cell.trim()));

      if (!headerRow || filledRows.length === 0) {
        setError(
          name
            ? t('products.importModal.sheetMissingHeaderNamed', { name })
            : t('products.importModal.sheetMissingHeader')
        );
        return;
      }

      setSheetName(name);
      setHeaders(headerRow);
      setRows(filledRows);
      setMapping(headerRow.map(autoMatch));
      setTouched(new Set());
      setCreatingFor(null);
      setError('');
      setStep('map');
    },
    [t]
  );

  const processFile = useCallback(
    async (file: File) => {
      setError('');
      setResult(null);

      if (isLegacyExcelFile(file.name)) {
        setError(t('products.importModal.legacyExcelError'));
        return;
      }

      if (!isExcelFile(file.name) && !isDelimitedFile(file.name)) {
        setError(t('products.importModal.unsupportedFileError'));
        return;
      }

      if (file.size > MAX_SPREADSHEET_BYTES) {
        setError(
          t('products.importModal.fileTooLarge', {
            size: Math.round(file.size / 1024 / 1024),
            max: Math.round(MAX_SPREADSHEET_BYTES / 1024 / 1024),
          })
        );
        return;
      }

      setReading(true);

      try {
        const buffer = await file.arrayBuffer();

        if (isExcelFile(file.name)) {
          const workbook = await readExcelWorkbook(buffer);
          const populated = workbook.filter((sheet) => sheet.rows.length > 0);

          if (populated.length === 0) {
            setError(t('products.importModal.emptyWorkbook'));
            return;
          }

          setFileName(file.name);
          setSheets(populated);

          if (populated.length === 1) {
            applyTable(populated[0].rows, populated[0].name);
          } else {
            setStep('sheet');
          }

          return;
        }

        setFileName(file.name);
        setSheets([]);
        applyTable(parseDelimited(decodeTextFile(buffer)), '');
      } catch (readError) {
        setError(describeFileError(readError, t('products.importModal.readError')));
      } finally {
        setReading(false);
      }
    },
    [applyTable, t]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer.files?.[0];
      if (file) void processFile(file);
    },
    [processFile]
  );

  // Custom fields load after the file may already be mapped: match any column the
  // user hasn't touched whose header equals a field's key or label.
  useEffect(() => {
    if (customFields.length === 0 || headers.length === 0) return;
    setMapping((current) => current.map((value, index) => {
      if (value !== '__skip__' || touched.has(index)) return value;
      const header = normalizeHeader(headers[index] ?? '');
      if (!header) return value;
      const match = customFields.find(
        (field) => normalizeHeader(field.key) === header || normalizeHeader(field.label) === header
      );
      return match ? (`${CUSTOM_MAPPING_PREFIX}${match.key}` as Mapping) : value;
    }));
  }, [customFields, headers, touched]);

  const setColumnMapping = (index: number, value: Mapping) => {
    setMapping((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    setTouched((current) => new Set(current).add(index));
  };

  const mappedProducts = useMemo(
    () =>
      rows.map((row) => {
        const product: Record<string, string> & { customFields?: Record<string, string> } = {};
        const custom: Record<string, string> = {};
        headers.forEach((_, index) => {
          const field = mapping[index];
          if (!field || field === '__skip__') return;
          if (field.startsWith(CUSTOM_MAPPING_PREFIX)) {
            custom[field.slice(CUSTOM_MAPPING_PREFIX.length)] = row[index] ?? '';
          } else {
            product[field] = row[index] ?? '';
          }
        });
        if (Object.keys(custom).length > 0) product.customFields = custom;
        return product;
      }),
    [headers, mapping, rows]
  );

  type PreviewColumn = { id: string; label: string; custom: boolean; read: (p: (typeof mappedProducts)[number]) => string };
  const previewFields: PreviewColumn[] = [
    ...PRODUCT_FIELDS.filter((field) => mapping.includes(field.key)).map((field) => ({
      id: field.key, label: field.label, custom: false, read: (p: (typeof mappedProducts)[number]) => p[field.key] ?? '',
    })),
    ...customFields
      .filter((field) => mapping.includes(`${CUSTOM_MAPPING_PREFIX}${field.key}` as Mapping))
      .map((field) => ({
        id: `${CUSTOM_MAPPING_PREFIX}${field.key}`, label: field.label, custom: true,
        read: (p: (typeof mappedProducts)[number]) => p.customFields?.[field.key] ?? '',
      })),
  ];

  // Same validation the server applies, so bad cells show before importing
  const invalidCustomCells = useMemo(() => {
    let count = 0;
    for (const product of mappedProducts) {
      for (const [key, raw] of Object.entries(product.customFields ?? {})) {
        const def = customByKey.get(key);
        if (def && !coerceCustomValue(def, raw).ok) count += 1;
      }
    }
    return count;
  }, [mappedProducts, customByKey]);

  const createFieldForColumn = async (
    index: number,
    input: { label: string; key: string; type: import('@/types').ProductCustomFieldType }
  ) => {
    const field = await createCustomField(input);
    setColumnMapping(index, `${CUSTOM_MAPPING_PREFIX}${field.key}` as Mapping);
    setCreatingFor(null);
  };
  const overRowLimit = mappedProducts.length > MAX_IMPORT_PRODUCTS;
  const canContinue = mapping.includes('name') && mapping.includes('price') && !overRowLimit;

  const sourceLabel = sheetName ? `${fileName} · ${sheetName}` : fileName;

  const handleBack = () => {
    if (step === 'map') {
      setStep(sheets.length > 1 ? 'sheet' : 'upload');
      return;
    }

    if (step === 'sheet') {
      setStep('upload');
      return;
    }

    setStep('map');
  };

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
        throw new Error(data.error || t('products.importModal.importFailed'));
      }

      setResult(data);
      setStep('done');
      onImported(data);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : t('products.importModal.importFailed'));
      setStep('preview');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant/10 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">{t('products.importModal.title')}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {t('products.importModal.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            aria-label={t('products.importModal.closeAria')}
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex items-center gap-3 border-b border-outline-variant/10 px-6 py-4">
          {steps.map((item, index) => {
            const currentIndex = steps.indexOf(step);
            const isComplete = index < currentIndex;
            const isCurrent = index === currentIndex;

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
                  {stepLabels[item]}
                </span>
                {index < steps.length - 1 ? (
                  <div className="hidden h-px w-6 bg-outline-variant/20 sm:block" />
                ) : null}
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

          {overRowLimit && (step === 'map' || step === 'preview') ? (
            <div className="mb-4 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
              {t('products.importModal.overRowLimit', {
                count: mappedProducts.length.toLocaleString(),
                max: MAX_IMPORT_PRODUCTS.toLocaleString(),
              })}
            </div>
          ) : null}

          {step === 'upload' ? (
            <div className="space-y-5">
              <button
                type="button"
                disabled={reading}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors disabled:cursor-wait ${
                  dragOver
                    ? 'border-secondary bg-secondary/5'
                    : 'border-outline-variant/30 bg-surface-container-low hover:border-secondary/40 hover:bg-surface-container'
                }`}
              >
                {reading ? (
                  <>
                    <Loader2
                      className="mb-3 h-10 w-10 animate-spin text-secondary"
                      strokeWidth={1.75}
                    />
                    <p className="text-base font-medium text-on-surface">{t('products.importModal.reading')}</p>
                  </>
                ) : (
                  <>
                    <Upload className="mb-3 h-10 w-10 text-on-surface-variant" strokeWidth={1.75} />
                    <p className="text-base font-medium text-on-surface">
                      {t('products.importModal.dropPrompt')}
                    </p>
                    <p className="mt-2 text-sm text-on-surface-variant">
                      {t('products.importModal.supportedFormats')}
                    </p>
                  </>
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept={SPREADSHEET_ACCEPT}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  // Cleared so re-picking the same file still fires a change.
                  event.target.value = '';
                  if (file) void processFile(file);
                }}
              />
            </div>
          ) : null}

          {step === 'sheet' ? (
            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                {t('products.importModal.sheetPrompt', { fileName, count: sheets.length })}
              </p>

              <div className="space-y-2">
                {sheets.map((sheet) => (
                  <button
                    key={sheet.name}
                    type="button"
                    onClick={() => applyTable(sheet.rows, sheet.name)}
                    className="flex w-full items-center gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-3 text-left transition-colors hover:border-secondary/40 hover:bg-surface-container"
                  >
                    <FileSpreadsheet
                      className="h-5 w-5 shrink-0 text-on-surface-variant"
                      strokeWidth={1.75}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-on-surface">
                        {sheet.name}
                      </span>
                      <span className="block text-sm text-on-surface-variant">
                        {t('products.importModal.rowsLabel', {
                          count: Math.max(0, sheet.rows.length - 1).toLocaleString(),
                        })}{' '}
                        ·{' '}
                        {sheet.rows[0]
                          .filter((cell) => cell.trim())
                          .slice(0, 4)
                          .join(', ') || t('products.importModal.noHeader')}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 'map' ? (
            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                {t('products.customFields.mappingHint')}
              </p>
              <p className="text-sm text-on-surface-variant">
                {t('products.importModal.rowsFoundIn', {
                  count: rows.length.toLocaleString(),
                  source: sourceLabel,
                })}
              </p>

              <div className="overflow-x-auto rounded-xl border border-outline-variant/10">
                <table className="w-full min-w-[720px]">
                  <thead className="bg-surface-container-low">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        {t('products.importModal.columnFileColumn')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        {t('products.importModal.columnSample')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        {t('products.importModal.columnMapsTo')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {headers.map((header, index) => (
                      <Fragment key={`${header}-${index}`}>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-on-surface">
                          {header.trim() || t('products.importModal.unnamedColumn', { index: index + 1 })}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-sm text-on-surface-variant">
                          {rows[0]?.[index] || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={mapping[index] && (mapping[index] === '__skip__' || !mapping[index].startsWith(CUSTOM_MAPPING_PREFIX) || customByKey.has(mapping[index].slice(CUSTOM_MAPPING_PREFIX.length))) ? mapping[index] : '__skip__'}
                            aria-label={t('products.importModal.mapColumnAria', {
                              column: header.trim() || String(index + 1),
                            })}
                            onChange={(event) => {
                              if (event.target.value === NEW_FIELD_OPTION) {
                                setCreatingFor(index);
                                return;
                              }
                              setColumnMapping(index, event.target.value as Mapping);
                            }}
                            className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50"
                          >
                            <option value="__skip__">{t('products.importModal.skipOption')}</option>
                            <optgroup label={t('products.customFields.builtInGroup')}>
                              {PRODUCT_FIELDS.map((field) => (
                                <option key={field.key} value={field.key}>
                                  {field.label}
                                  {field.required ? ' *' : ''}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label={t('products.customFields.customGroup')}>
                              {customFields.map((field) => (
                                <option key={field.id} value={`${CUSTOM_MAPPING_PREFIX}${field.key}`}>
                                  {field.label} ({typeLabels[field.type]})
                                </option>
                              ))}
                              <option value={NEW_FIELD_OPTION}>{t('products.customFields.createFromColumn')}</option>
                            </optgroup>
                          </select>
                          {mapping[index]?.startsWith(CUSTOM_MAPPING_PREFIX) ? (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-[11px] font-medium text-secondary">
                              <SlidersHorizontal className="h-3 w-3" />
                              {t('products.customFields.customBadge')}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                      {creatingFor === index ? (
                        <tr>
                          <td colSpan={3} className="bg-surface-container-low/50 px-4 py-3">
                            <NewCustomFieldForm
                              compact
                              initialLabel={header.trim()}
                              initialType={guessFieldType(rows.slice(0, 50).map((row) => row[index] ?? ''))}
                              onCreate={(input) => createFieldForColumn(index, input)}
                              onCancel={() => setCreatingFor(null)}
                            />
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {step === 'preview' ? (
            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                {t('products.importModal.previewingRows', { count: Math.min(5, mappedProducts.length) })}
              </p>
              {invalidCustomCells > 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                  {t('products.customFields.invalidSummary', { count: invalidCustomCells })}
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-xl border border-outline-variant/10">
                <table className="w-full min-w-[720px]">
                  <thead className="bg-surface-container-low">
                    <tr>
                      {previewFields.map((field) => (
                        <th
                          key={field.id}
                          className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant"
                        >
                          {field.label}
                          {field.custom ? (
                            <span className="ml-1.5 rounded-full bg-secondary/10 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-secondary">
                              {t('products.customFields.customBadge')}
                            </span>
                          ) : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {mappedProducts.slice(0, 5).map((product, index) => (
                      <tr key={`preview-${index}`}>
                        {previewFields.map((field) => {
                          const value = field.read(product);
                          const def = field.custom ? customByKey.get(field.id.slice(CUSTOM_MAPPING_PREFIX.length)) : undefined;
                          const invalid = !!def && !coerceCustomValue(def, value).ok;
                          return (
                            <td
                              key={field.id}
                              title={invalid ? t('products.customFields.invalidCell', { type: typeLabels[def!.type] }) : undefined}
                              className={`px-4 py-3 text-sm ${invalid ? 'bg-error/10 font-medium text-error' : 'text-on-surface'}`}
                            >
                              {value || '—'}
                            </td>
                          );
                        })}
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
              <h3 className="text-lg font-semibold text-on-surface">{t('products.importModal.importingTitle')}</h3>
              <p className="mt-2 max-w-md text-sm text-on-surface-variant">
                {t('products.importModal.importingBody', { count: mappedProducts.length.toLocaleString() })}
              </p>
            </div>
          ) : null}

          {step === 'done' && result ? (
            <div className="space-y-5">
              <div className="rounded-xl bg-surface-container-low p-5">
                <h3 className="text-lg font-semibold text-on-surface">{t('products.importModal.doneTitle')}</h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {t('products.importModal.doneSummary', { created: result.created, skipped: result.skipped })}
                </p>
              </div>

              {result.errors.length > 0 ? (
                <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4">
                  <p className="mb-3 text-sm font-medium text-on-surface">{t('products.importModal.rowErrorsTitle')}</p>
                  <div className="max-h-52 space-y-2 overflow-y-auto text-sm text-on-surface-variant">
                    {result.errors.map((item) => (
                      <p key={`${item.row}-${item.message}`}>
                        {t('products.importModal.rowErrorPrefix', { row: item.row })} {item.message}
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
                onClick={handleBack}
                className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
              >
                {t('common.back')}
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            >
              {step === 'done' ? t('common.close') : t('common.cancel')}
            </button>

            {step === 'map' ? (
              <button
                type="button"
                onClick={() => setStep('preview')}
                disabled={!canContinue}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-on-secondary transition-colors hover:bg-secondary-dim disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('products.importModal.previewButton')}
              </button>
            ) : null}

            {step === 'preview' ? (
              <button
                type="button"
                onClick={handleImport}
                disabled={overRowLimit}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-on-secondary transition-colors hover:bg-secondary-dim disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('products.importModal.importButton', { count: mappedProducts.length.toLocaleString() })}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
