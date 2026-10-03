// Product custom fields: shared by the API (validation) and the UI (import
// preview, product form), so a value is judged the same way on both sides.
// No server-only imports here.

import type { ProductCustomField, ProductCustomFieldType } from '@/types'

export const CUSTOM_FIELD_TYPES: ProductCustomFieldType[] = ['text', 'number', 'boolean', 'date']
export const MAX_CUSTOM_FIELDS = 50
export const MAX_CUSTOM_LABEL = 60
export const MAX_CUSTOM_TEXT = 500

/** Built-in product columns; a custom field may not reuse one of these keys. */
export const BUILT_IN_PRODUCT_KEYS = [
  'id', 'workspaceId', 'name', 'description', 'sku', 'price', 'unit', 'category',
  'taxRate', 'stockQuantity', 'isActive', 'createdById', 'createdAt', 'updatedAt', 'customFields',
] as const

/** Prefix for custom fields in the import mapping (`custom:unitsPerBox`). */
export const CUSTOM_MAPPING_PREFIX = 'custom:'

export function isCustomFieldType(value: unknown): value is ProductCustomFieldType {
  return typeof value === 'string' && (CUSTOM_FIELD_TYPES as string[]).includes(value)
}

/**
 * Stable key for a field, camelCase and ASCII: "Units per box" -> "unitsPerBox".
 * A header that is already camelCase ("unitsPerBox") is kept as typed.
 */
export function toFieldKey(label: string): string {
  const ascii = label.normalize('NFKD').replace(/[̀-ͯ]/g, '')
  const words = ascii.split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) {
    const w = words[0]
    // Already camelCase / PascalCase: keep inner capitals, lower the first letter
    return (w[0].toLowerCase() + w.slice(1)).replace(/^[0-9]+/, '').slice(0, 40)
  }
  const key = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
  return key.replace(/^[0-9]+/, '').slice(0, 40)
}

export function isValidFieldKey(key: string) {
  return /^[a-z][A-Za-z0-9]{0,39}$/.test(key) && !(BUILT_IN_PRODUCT_KEYS as readonly string[]).includes(key)
}

/** Loose normalisation for matching spreadsheet headers to fields. */
export function normalizeHeader(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
}

const TRUE_WORDS = ['true', 'yes', 'y', '1', 'oui', 'si', 'sí', 'ja', 'x', '✓', 'نعم']
const FALSE_WORDS = ['false', 'no', 'n', '0', 'non', 'nein', 'لا']

export type CoerceResult = { ok: true; value: string | number | boolean | null } | { ok: false; message: string }

/**
 * Turn a raw value (spreadsheet cell, form input, JSON) into what's stored for
 * this field. Empty input clears the value (null).
 */
export function coerceCustomValue(field: Pick<ProductCustomField, 'label' | 'type'>, raw: unknown): CoerceResult {
  if (raw === null || raw === undefined) return { ok: true, value: null }
  if (typeof raw === 'string' && raw.trim() === '') return { ok: true, value: null }

  switch (field.type) {
    case 'number': {
      if (typeof raw === 'number') return Number.isFinite(raw) ? { ok: true, value: raw } : { ok: false, message: `${field.label} must be a number` }
      // "1 234,5" and "1,234.5" and "1.5" all work
      let s = String(raw).trim().replace(/\s| /g, '')
      if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
      else if (s.includes(',')) s = s.replace(',', '.')
      const n = Number(s)
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, message: `${field.label} must be a number` }
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return { ok: true, value: raw }
      const s = String(raw).trim().toLowerCase()
      if (TRUE_WORDS.includes(s)) return { ok: true, value: true }
      if (FALSE_WORDS.includes(s)) return { ok: true, value: false }
      return { ok: false, message: `${field.label} must be yes or no` }
    }
    case 'date': {
      const s = String(raw).trim()
      // Accept ISO dates and dd/mm/yyyy (common in spreadsheets); store yyyy-mm-dd
      const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
      const d = dmy ? new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1])) : new Date(s)
      if (isNaN(d.getTime())) return { ok: false, message: `${field.label} must be a date` }
      return { ok: true, value: d.toISOString().slice(0, 10) }
    }
    default: {
      const s = String(raw).trim()
      if (s.length > MAX_CUSTOM_TEXT) return { ok: false, message: `${field.label} can be at most ${MAX_CUSTOM_TEXT} characters` }
      return { ok: true, value: s }
    }
  }
}

/**
 * Keep only defined fields and coerce each value. Keys that aren't defined are
 * dropped silently; invalid values are reported. Null values are omitted so
 * the stored object stays small.
 */
export function sanitizeCustomFields(
  defs: Pick<ProductCustomField, 'key' | 'label' | 'type'>[],
  input: unknown,
): { ok: true; values: Record<string, string | number | boolean> } | { ok: false; message: string } {
  const values: Record<string, string | number | boolean> = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: true, values }
  const raw = input as Record<string, unknown>
  for (const def of defs) {
    if (!(def.key in raw)) continue
    const result = coerceCustomValue(def, raw[def.key])
    if (!result.ok) return result
    if (result.value !== null) values[def.key] = result.value
  }
  return { ok: true, values }
}

/** Guess a field type from sample cells (used when creating a field from a column). */
export function guessFieldType(samples: string[]): ProductCustomFieldType {
  const filled = samples.map(s => s.trim()).filter(Boolean)
  if (filled.length === 0) return 'text'
  const fits = (type: ProductCustomFieldType) => filled.every(s => coerceCustomValue({ label: '', type }, s).ok)
  if (fits('number')) return 'number'
  if (filled.every(s => [...TRUE_WORDS, ...FALSE_WORDS].includes(s.toLowerCase()))) return 'boolean'
  if (filled.every(s => /\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/.test(s)) && fits('date')) return 'date'
  return 'text'
}

/** Human display of a stored value. */
export function formatCustomValue(value: unknown, labels: { yes: string; no: string }): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'boolean') return value ? labels.yes : labels.no
  return String(value)
}
