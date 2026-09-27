/**
 * Quote / invoice number generation.
 *
 * Numbers look like `Q-2026-0001` / `INV-2026-0001` and are scoped per workspace
 * per year. Three separate copies of this logic existed; two of them ordered by
 * `invoiceNumber` descending to find the last number, which is a string sort, so
 * `INV-2026-0009` sorted above `INV-2026-0010` and the tenth document of the year
 * reused the ninth's number. Counting rows avoids the string-sort trap entirely.
 *
 * The retry loop is not optional. `Quote.quoteNumber` and `Invoice.invoiceNumber`
 * are globally `@unique` rather than `@@unique([workspaceId, number])`, so two
 * workspaces creating their first document in the same year genuinely collide on
 * `-0001`, and the loop is what lets the second one through. `count()` also
 * under-reports after a deletion, which collides the same way. Both cases land on
 * P2002 and resolve by trying the next number.
 */

import { prisma } from '@/lib/prisma';

export type DocumentKind = 'quote' | 'invoice';

const PREFIXES: Record<DocumentKind, string> = {
  quote: 'Q',
  invoice: 'INV',
};

/** Enough headroom for concurrent creates without retrying forever on a real fault. */
const MAX_ATTEMPTS = 8;

/** Prisma client or interactive-transaction client — both expose the model delegates we use. */
type Db = Pick<typeof prisma, 'quote' | 'invoice'>;

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}

export function documentNumberPrefix(kind: DocumentKind, year = new Date().getFullYear()): string {
  return `${PREFIXES[kind]}-${year}`;
}

function formatNumber(prefix: string, sequence: number): string {
  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
}

/**
 * The highest sequence this workspace has used under `prefix` this year.
 *
 * Counting rows under-reports once a document is deleted (three documents with
 * 0001 and 0003 left give a count of 2, and 0003 collides), so read the numbers
 * and take the largest. Parsed numerically: once past 9999 the zero-padded
 * strings no longer sort in numeric order.
 */
async function highestSequence(kind: DocumentKind, workspaceId: string, prefix: string, db: Db): Promise<number> {
  const rows = kind === 'quote'
    ? await db.quote.findMany({ where: { workspaceId, quoteNumber: { startsWith: `${prefix}-` } }, select: { quoteNumber: true } })
    : await db.invoice.findMany({ where: { workspaceId, invoiceNumber: { startsWith: `${prefix}-` } }, select: { invoiceNumber: true } });

  let max = 0;
  for (const row of rows) {
    const value = 'quoteNumber' in row ? row.quoteNumber : row.invoiceNumber;
    const sequence = Number.parseInt(value.slice(prefix.length + 1), 10);
    if (Number.isFinite(sequence) && sequence > max) max = sequence;
  }
  return max;
}

/**
 * Create a quote or invoice, generating its number and retrying on collision.
 *
 * The caller supplies the actual write as a callback so the number and the row it
 * belongs to are created together — this is what makes the P2002 retry correct.
 *
 * Do not call this from inside an interactive transaction. On Postgres the first
 * unique violation aborts the whole transaction, so every retry after it fails with
 * "current transaction is aborted" instead of trying the next number. When the
 * document must be written together with other rows, make the callback itself run
 * the transaction, so each attempt is a fresh transaction:
 *
 * @example
 * const invoice = await createWithDocumentNumber('invoice', workspaceId, (invoiceNumber) =>
 *   prisma.$transaction(async (tx) => {
 *     const created = await tx.invoice.create({ data: { invoiceNumber, ...rest } });
 *     await tx.quote.update({ ... });
 *     return created;
 *   })
 * );
 */
export async function createWithDocumentNumber<T>(
  kind: DocumentKind,
  workspaceId: string,
  create: (documentNumber: string) => Promise<T>,
  db: Db = prisma
): Promise<T> {
  const prefix = documentNumberPrefix(kind);
  const field = kind === 'quote' ? 'quoteNumber' : 'invoiceNumber';

  const next = (await highestSequence(kind, workspaceId, prefix, db)) + 1;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await create(formatNumber(prefix, next + attempt));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      lastError = error;
    }
  }

  throw (
    lastError ??
    new Error(`Could not allocate a unique ${field} for workspace ${workspaceId} after ${MAX_ATTEMPTS} attempts`)
  );
}
