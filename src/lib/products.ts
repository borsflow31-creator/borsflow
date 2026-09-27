/**
 * Shared product helpers.
 *
 * Kept free of any Prisma / server-only import so client components can pull in
 * `formatMoney` without dragging the Prisma client into the browser bundle. The
 * raw-SQL ORDER BY fragments live in the API route; this module only owns the
 * whitelist of sort keys both sides agree on.
 */

/** Shape of a row selected from "Product" by the raw-SQL product routes. */
export interface ProductRow {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  unit: string | null;
  category: string | null;
  taxRate: number;
  stockQuantity: number | null;
  isActive: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const PRODUCT_SORT_KEYS = ['updated', 'name', 'price', 'stock'] as const;
export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

export const DEFAULT_PRODUCT_SORT: ProductSortKey = 'updated';

/** Narrows an untrusted `sort` query param to a known key, never throwing. */
export function resolveProductSort(value: unknown): ProductSortKey {
  return PRODUCT_SORT_KEYS.includes(value as ProductSortKey)
    ? (value as ProductSortKey)
    : DEFAULT_PRODUCT_SORT;
}

/**
 * Parses an integer query param and clamps it into range.
 * Guards the raw-SQL OFFSET/LIMIT: an unchecked `parseInt` lets `?page=0` build a
 * negative OFFSET and `?page=abc` build a NaN one, both of which Postgres rejects.
 */
export function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

/** Trimmed string, or null when blank/absent. */
export function toOptionalString(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

/** Number with thousands separators stripped, or null when blank or unparseable. */
export function toOptionalNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/** True when a value was actually supplied (so null from `toOptionalNumber` means "bad"). */
export function isPresent(value: unknown) {
  return value !== '' && value !== null && value !== undefined;
}

export type NumericFieldResult =
  | { ok: true; value: number | null }
  | { ok: false; message: string };

/**
 * Validates an optional numeric body field. Unlike `Number(x) || 0`, garbage is
 * rejected with a message naming the field rather than silently becoming 0.
 */
export function parseNumericField(
  value: unknown,
  label: string,
  options: { required?: boolean; min?: number; integer?: boolean } = {}
): NumericFieldResult {
  if (!isPresent(value)) {
    if (options.required) return { ok: false, message: `${label} is required` };
    return { ok: true, value: null };
  }

  const parsed = toOptionalNumber(value);
  if (parsed === null) return { ok: false, message: `${label} must be a valid number` };
  if (options.min !== undefined && parsed < options.min) {
    return { ok: false, message: `${label} cannot be less than ${options.min}` };
  }

  return { ok: true, value: options.integer ? Math.round(parsed) : parsed };
}

/**
 * Escapes the LIKE wildcards so a user typing `%` searches for a literal percent
 * sign instead of matching every row. Pairs with `ESCAPE '\'` in the query.
 */
export function escapeLikePattern(term: string) {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Single money formatter for the whole product surface. */
export function formatMoney(amount: number, currency = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

/** Reads the API's `{ error }` message, falling back to a caller-supplied default. */
export async function errorFrom(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return typeof data?.error === 'string' ? data.error : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Builds the page numbers to render, collapsing long runs to `'ellipsis'` so a
 * 40-page catalog does not render 40 buttons.
 */
export function buildPageWindow(current: number, total: number, maxSlots = 7): Array<number | 'ellipsis'> {
  if (total <= maxSlots) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const slots = new Set<number>([1, total, current]);
  const side = Math.max(1, Math.floor((maxSlots - 3) / 2));

  for (let offset = 1; offset <= side; offset += 1) {
    if (current - offset > 1) slots.add(current - offset);
    if (current + offset < total) slots.add(current + offset);
  }

  const pages = Array.from(slots)
    .filter((page) => page >= 1 && page <= total)
    .sort((left, right) => left - right);

  const result: Array<number | 'ellipsis'> = [];
  let previous = 0;

  for (const page of pages) {
    if (previous && page - previous > 1) result.push('ellipsis');
    result.push(page);
    previous = page;
  }

  return result;
}
