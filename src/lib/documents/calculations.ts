/**
 * Quote / invoice money math — the single source of truth.
 *
 * This module exists because the totals formula was previously duplicated in six
 * places (four server routes, two client pages) with three different meanings, so
 * the figure a user approved in the UI was not the figure the server persisted.
 * Both sides now import from here.
 *
 * The model, stated once so the routes don't have to restate it:
 *
 *   lineNet   = quantity x unitPrice x (1 - itemDiscount%)   <- no tax
 *   subtotal  = sum of lineNet                               <- no tax
 *   discount  = header discount applied to subtotal
 *   taxAmount = per-line tax + header tax, each on the post-discount base
 *   total     = subtotal - discount + taxAmount
 *
 * Two invariants follow, and both are load-bearing:
 *
 *  1. `subtotal` and every stored `item.total` EXCLUDE tax, so
 *     `sum(item.total) === subtotal`. The old code baked per-line tax into
 *     `item.total` while leaving it out of `subtotal`, so the line items on a
 *     document never added up to its own subtotal.
 *  2. Tax is counted exactly once. The old code applied per-line tax to the item
 *     rows AND the header rate to the same base, double-taxing any document that
 *     used both.
 *
 * A header discount shrinks the base that per-line tax applies to, so per-line
 * tax is scaled by the same ratio the discount reduced the subtotal by. Without
 * that, discounting a document would leave its tax computed on the undiscounted
 * amount.
 */

/** Only the fields the math needs; both `LineItem` (client) and `InvoiceItem`/`QuoteItem` (Prisma) satisfy it. */
export interface CalculableItem {
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}

export type DocumentDiscountType = 'percentage' | 'fixed' | 'none' | null | undefined;

export interface DocumentTotalsInput {
  taxRate?: number | null;
  discountType?: DocumentDiscountType;
  discountValue?: number | null;
}

export interface DocumentTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  /** Per-item tax-exclusive line totals, index-aligned with the input items. */
  lineTotals: number[];
}

/**
 * Money is stored in `Float` columns, so every value that gets persisted or
 * compared is rounded to 2dp to keep binary dust from accumulating across the
 * subtotal -> discount -> tax -> total chain.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Coerce anything that arrived over JSON into a finite number. */
function num(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
}

/** A percentage clamped to 0-100; anything out of range is a client bug, not a negative charge. */
function pct(value: unknown): number {
  return Math.min(100, Math.max(0, num(value)));
}

/**
 * One line's tax-exclusive total: quantity x price, less the line discount.
 *
 * This is what gets stored in `item.total` and shown in the line-items table, so
 * the rows visibly add up to the subtotal.
 */
export function calculateLineTotal(item: CalculableItem): number {
  const gross = num(item.quantity) * num(item.unitPrice);
  return roundMoney(gross * (1 - pct(item.discount) / 100));
}

/**
 * Whole-document totals. Pass the items and the header-level tax/discount
 * settings; get back every figure that needs to be persisted or rendered.
 */
export function calculateDocumentTotals(
  items: CalculableItem[] | null | undefined,
  { taxRate, discountType, discountValue }: DocumentTotalsInput = {}
): DocumentTotals {
  const lineItems = items ?? [];
  const lineTotals = lineItems.map(calculateLineTotal);
  const subtotal = roundMoney(lineTotals.reduce((sum, value) => sum + value, 0));

  // A fixed discount larger than the document, or a stale value left behind when
  // the type was cleared, must not push the total negative.
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = subtotal * (pct(discountValue) / 100);
  } else if (discountType === 'fixed') {
    discountAmount = Math.max(0, num(discountValue));
  }
  discountAmount = roundMoney(Math.min(discountAmount, subtotal));

  const afterDiscount = roundMoney(subtotal - discountAmount);

  // Scale per-line tax by however much the header discount reduced the base, so
  // tax is charged on what the client actually pays.
  const discountRatio = subtotal > 0 ? afterDiscount / subtotal : 0;
  const lineTax = lineItems.reduce(
    (sum, item, index) => sum + lineTotals[index] * discountRatio * (pct(item.taxRate) / 100),
    0
  );
  const headerTax = afterDiscount * (pct(taxRate) / 100);
  const taxAmount = roundMoney(lineTax + headerTax);

  return {
    subtotal,
    discountAmount,
    taxAmount,
    total: roundMoney(afterDiscount + taxAmount),
    lineTotals,
  };
}

/**
 * Prisma `create` rows for a document's line items, with totals from the shared
 * formula and `order` taken from array position.
 */
export function buildItemCreateData(items: (CalculableItem & { description?: string })[] | null | undefined) {
  const lineItems = items ?? [];
  return lineItems.map((item, index) => ({
    description: item.description ?? '',
    quantity: num(item.quantity),
    unitPrice: num(item.unitPrice),
    discount: pct(item.discount),
    taxRate: pct(item.taxRate),
    total: calculateLineTotal(item),
    order: index,
  }));
}
