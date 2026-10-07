/**
 * Writing a CSV that opens correctly in a spreadsheet and cannot attack the person
 * who opens it.
 *
 * Two things beyond RFC 4180 matter for reports built from user-entered data:
 *
 *  - A UTF-8 byte-order mark, because Excel otherwise assumes a legacy code page and
 *    turns every accented name into mojibake.
 *  - A cell that starts with =, +, - or @ is read by a spreadsheet as a formula. A
 *    lead whose name is "=HYPERLINK(...)" would run when a manager opens the export.
 *    Text cells starting with those characters get a leading apostrophe, which
 *    spreadsheets treat as "this is text". Real numbers are unaffected: they are
 *    written as numbers, and only strings are guarded, so a genuine -5 stays -5.
 */

export type CsvCell = string | number | boolean | Date | null | undefined

const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'

  let text = value
  if (FORMULA_START.test(text)) text = `'${text}`
  // Quote anything with a delimiter, a quote or a line break, doubling embedded quotes.
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** A download response for a CSV, named so the browser saves it sensibly. */
export function csvResponse(filename: string, rows: readonly (readonly CsvCell[])[]): Response {
  const safe = filename.replace(/[^A-Za-z0-9._-]+/g, '_')
  return new Response(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safe}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
