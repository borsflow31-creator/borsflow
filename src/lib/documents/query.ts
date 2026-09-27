/**
 * Shared list-query parsing for the quote and invoice endpoints.
 *
 * Both routes previously read `page` and `limit` with a bare `parseInt`, so
 * `?page=abc` sent `NaN` into `skip` and `?limit=99999` returned every row in the
 * workspace. Both also used `contains` without a mode, which is case-sensitive on
 * Postgres — searching "acme" missed "Acme Corp".
 */

/** High enough for a full page of results, low enough not to be a table dump. */
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export function parsePagination(searchParams: URLSearchParams): Pagination {
  const rawPage = Number.parseInt(searchParams.get('page') ?? '', 10);
  const rawLimit = Number.parseInt(searchParams.get('limit') ?? '', 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  return { page, limit, skip: (page - 1) * limit, take: limit };
}

/** Case-insensitive match across the client fields shown in the list UI. */
export function buildClientSearchFilter(search: string) {
  return [
    { clientName: { contains: search, mode: 'insensitive' as const } },
    { clientEmail: { contains: search, mode: 'insensitive' as const } },
    { clientCompany: { contains: search, mode: 'insensitive' as const } },
  ];
}

/**
 * Whitelisted sort orders, keyed by the values the list pages' sort selectors
 * already emit. The control has always been rendered, but the value was never sent
 * and the routes hardcoded `createdAt desc`, so choosing a sort did nothing.
 * Mapping to a fixed set keeps arbitrary field names out of `orderBy`.
 */
const SORT_ORDERS = {
  date: { createdAt: 'desc' },
  client: { clientName: 'asc' },
  total: { total: 'desc' },
  status: { status: 'asc' },
} as const;

export type SortKey = keyof typeof SORT_ORDERS;

export function parseSort(value: string | null): Record<string, 'asc' | 'desc'> {
  if (value && value in SORT_ORDERS) {
    return SORT_ORDERS[value as SortKey] as Record<string, 'asc' | 'desc'>;
  }
  return { createdAt: 'desc' };
}

/**
 * Invoices additionally sort by due date. Nulls last, so invoices with no due date
 * don't crowd out the ones that are actually dated.
 */
export function parseInvoiceSort(value: string | null): Record<string, unknown> {
  if (value === 'dueDate') {
    return { dueDate: { sort: 'asc', nulls: 'last' } };
  }
  return parseSort(value);
}
