'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { CUSTOM_FIELD_TYPES, MAX_CUSTOM_LABEL, isValidFieldKey, toFieldKey } from '@/lib/product-custom-fields';
import type { ProductCustomFieldType } from '@/types';
import { useProductCustomFields, type CustomFieldWithUsage } from './useProductCustomFields';

export function useFieldTypeLabels() {
  const { t } = useI18n();
  return {
    text: t('products.customFields.typeText'),
    number: t('products.customFields.typeNumber'),
    boolean: t('products.customFields.typeBoolean'),
    date: t('products.customFields.typeDate'),
  } satisfies Record<ProductCustomFieldType, string>;
}

const inputClass =
  'w-full rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 disabled:opacity-50';

/** Add-field form, also used inline by the import mapping step. */
export function NewCustomFieldForm({
  initialLabel = '',
  initialType = 'text',
  onCreate,
  onCancel,
  compact = false,
}: {
  initialLabel?: string;
  initialType?: ProductCustomFieldType;
  onCreate: (input: { label: string; key: string; type: ProductCustomFieldType }) => Promise<void>;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const typeLabels = useFieldTypeLabels();
  const [label, setLabel] = useState(initialLabel);
  const [key, setKey] = useState(toFieldKey(initialLabel));
  const [keyEdited, setKeyEdited] = useState(false);
  const [type, setType] = useState<ProductCustomFieldType>(initialType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keyOk = isValidFieldKey(key);

  const submit = async () => {
    if (!label.trim() || !keyOk || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate({ label: label.trim(), key, type });
      setLabel('');
      setKey('');
      setKeyEdited(false);
      setType('text');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('products.customFields.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rounded-xl border border-secondary/20 bg-secondary/5 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem]">
        <div>
          <label className="mb-1 block text-xs font-medium text-on-surface-variant">{t('products.customFields.labelLabel')}</label>
          <input
            value={label}
            autoFocus
            maxLength={MAX_CUSTOM_LABEL}
            onChange={(e) => {
              setLabel(e.target.value);
              if (!keyEdited) setKey(toFieldKey(e.target.value));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void submit(); }
              if (e.key === 'Escape') onCancel?.();
            }}
            placeholder={t('products.customFields.labelPlaceholder')}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-on-surface-variant">{t('products.customFields.typeLabel')}</label>
          <select value={type} onChange={(e) => setType(e.target.value as ProductCustomFieldType)} className={inputClass}>
            {CUSTOM_FIELD_TYPES.map((value) => (
              <option key={value} value={value}>{typeLabels[value]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
        <span>{t('products.customFields.keyLabel')}</span>
        <input
          value={key}
          onChange={(e) => { setKey(e.target.value.replace(/[^A-Za-z0-9]/g, '')); setKeyEdited(true); }}
          aria-label={t('products.customFields.keyLabel')}
          className={`w-44 rounded-md bg-surface-container-low px-2 py-1 font-mono text-xs text-on-surface focus:outline-none focus:ring-2 ${keyOk || !key ? 'focus:ring-secondary/50' : 'ring-1 ring-error/60 focus:ring-error/60'}`}
        />
        <span className="opacity-70">{t('products.customFields.keyHint')}</span>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-error">{error}</p> : null}
      <div className="mt-3 flex justify-end gap-2">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high">
            {t('common.cancel')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!label.trim() || !keyOk || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-on-secondary hover:bg-secondary-dim disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {t('products.customFields.addField')}
        </button>
      </div>
    </div>
  );
}

function FieldRow({
  field, index, total, onMove, onRename, onRetype, onDelete,
}: {
  field: CustomFieldWithUsage;
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onRename: (label: string) => Promise<void>;
  onRetype: (type: ProductCustomFieldType) => Promise<void>;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const typeLabels = useFieldTypeLabels();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(field.label);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setLabel(field.label), [field.label]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('products.customFields.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <button type="button" disabled={index === 0 || busy} onClick={() => onMove(-1)} aria-label={t('products.customFields.moveUp')} className="rounded p-0.5 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-25">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" disabled={index === total - 1 || busy} onClick={() => onMove(1)} aria-label={t('products.customFields.moveDown')} className="rounded p-0.5 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-25">
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                value={label}
                autoFocus
                maxLength={MAX_CUSTOM_LABEL}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void run(async () => { await onRename(label.trim()); setEditing(false); });
                  if (e.key === 'Escape') { setLabel(field.label); setEditing(false); }
                }}
                aria-label={t('products.customFields.labelLabel')}
                className={`${inputClass} py-1.5`}
              />
              <button type="button" disabled={!label.trim() || busy} onClick={() => void run(async () => { await onRename(label.trim()); setEditing(false); })} aria-label={t('common.save')} className="rounded-lg p-1.5 text-secondary hover:bg-secondary/10 disabled:opacity-40">
                <Check className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => { setLabel(field.label); setEditing(false); }} aria-label={t('common.cancel')} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="group flex max-w-full items-center gap-1.5 text-left">
              <span className="truncate text-sm font-medium text-on-surface">{field.label}</span>
              <Pencil className="h-3 w-3 shrink-0 text-on-surface-variant opacity-0 group-hover:opacity-100" />
            </button>
          )}
          <p className="mt-0.5 truncate text-xs text-on-surface-variant">
            <span className="font-mono">{field.key}</span>
            {' · '}
            {t('products.customFields.usage', { count: field.usageCount ?? 0 })}
          </p>
        </div>

        <select
          value={field.type}
          disabled={busy}
          onChange={(e) => void run(() => onRetype(e.target.value as ProductCustomFieldType))}
          aria-label={t('products.customFields.typeLabel')}
          className="rounded-lg bg-surface-container-high px-2 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50"
        >
          {CUSTOM_FIELD_TYPES.map((value) => (
            <option key={value} value={value}>{typeLabels[value]}</option>
          ))}
        </select>

        <button type="button" onClick={onDelete} disabled={busy} aria-label={t('products.customFields.deleteNamed', { name: field.label })} className="rounded-lg p-2 text-on-surface-variant hover:bg-error/10 hover:text-error">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-error">{error}</p> : null}
    </li>
  );
}

/** Products page: create, rename, retype, reorder and delete custom product fields. */
export default function ProductCustomFieldsModal({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { fields, loading, error, create, update, remove, move } = useProductCustomFields(workspaceId);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CustomFieldWithUsage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !confirmDelete) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, confirmDelete]);

  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await remove(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('products.customFields.saveFailed'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="custom-fields-title" className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/10 px-6 py-5">
          <div>
            <h2 id="custom-fields-title" className="flex items-center gap-2 text-lg font-semibold text-on-surface">
              <SlidersHorizontal className="h-5 w-5 text-secondary" strokeWidth={1.75} />
              {t('products.customFields.title')}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">{t('products.customFields.subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface">
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {error ? <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{error}</div> : null}

          {loading && fields.length === 0 ? (
            <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-on-surface-variant" />
          ) : fields.length === 0 && !adding ? (
            <div className="rounded-xl border border-dashed border-outline-variant/30 px-6 py-10 text-center">
              <p className="text-sm font-medium text-on-surface">{t('products.customFields.emptyTitle')}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant">{t('products.customFields.emptyBody')}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {fields.map((field, index) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  index={index}
                  total={fields.length}
                  onMove={(dir) => void move(field.id, dir).catch(() => {})}
                  onRename={async (label) => { await update(field.id, { label }); }}
                  onRetype={async (type) => { await update(field.id, { type }); }}
                  onDelete={() => { setDeleteError(null); setConfirmDelete(field); }}
                />
              ))}
            </ul>
          )}

          {adding ? (
            <NewCustomFieldForm
              onCreate={async (input) => { await create(input); setAdding(false); }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant/40 px-4 py-3 text-sm font-medium text-secondary hover:border-secondary/50 hover:bg-secondary/5"
            >
              <Plus className="h-4 w-4" />
              {t('products.customFields.addField')}
            </button>
          )}

          <p className="text-xs text-on-surface-variant">{t('products.customFields.importHint')}</p>
        </div>
      </div>

      {confirmDelete ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !deleting && setConfirmDelete(null)}>
          <div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-on-surface">{t('products.customFields.deleteTitle', { name: confirmDelete.label })}</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              {(confirmDelete.usageCount ?? 0) > 0
                ? t('products.customFields.deleteBodyUsed', { count: confirmDelete.usageCount ?? 0 })
                : t('products.customFields.deleteBodyUnused')}
            </p>
            {deleteError ? <p role="alert" className="mt-3 text-xs text-error">{deleteError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} disabled={deleting} className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low">
                {t('common.cancel')}
              </button>
              <button type="button" onClick={() => void doDelete()} disabled={deleting} className="inline-flex items-center gap-2 rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
