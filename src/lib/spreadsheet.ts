/**
 * Spreadsheet readers for import flows.
 *
 * Excel workbooks are parsed in the browser without a third-party dependency:
 * an .xlsx file is a ZIP archive of XML parts, so the archive is read with
 * DecompressionStream and the SpreadsheetML is walked with DOMParser. Legacy
 * .xls (OLE2/BIFF) is a completely different binary format and is not handled;
 * callers get a message asking for a re-save as .xlsx.
 */

export interface SheetData {
  /** Sheet name as shown on the workbook tab. */
  name: string;
  /** Cell text, row-major, padded so every row has the same length. */
  rows: string[][];
}

export class SpreadsheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpreadsheetError';
  }
}

export const SPREADSHEET_ACCEPT = '.csv,.tsv,.txt,.xlsx';
export const MAX_SPREADSHEET_BYTES = 15 * 1024 * 1024;

export function isExcelFile(fileName: string): boolean {
  return /\.xlsx$/i.test(fileName);
}

export function isLegacyExcelFile(fileName: string): boolean {
  return /\.(xls|xlsb|xlsm)$/i.test(fileName);
}

export function isDelimitedFile(fileName: string): boolean {
  return /\.(csv|tsv|txt)$/i.test(fileName);
}

/**
 * Decodes a text upload as UTF-8, falling back to Windows-1252 when the bytes
 * are not valid UTF-8. Excel's own "CSV" export still writes the legacy ANSI
 * codepage on Windows, so a strict UTF-8 read turns accented names into
 * replacement characters.
 */
export function decodeTextFile(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function padRows(rows: string[][]): string[][] {
  const width = rows.reduce((widest, row) => Math.max(widest, row.length), 0);

  return rows.map((row) => {
    const padded = row.slice();
    while (padded.length < width) padded.push('');
    return padded;
  });
}

/* -------------------------------------------------------------- CSV and TSV */

/**
 * Picks the delimiter by counting candidates outside quoted spans on the first
 * line. Scoring one delimiter beats treating every candidate as a separator,
 * which splits values that legitimately contain a semicolon.
 */
function detectDelimiter(text: string): string {
  const counts = new Map<string, number>([
    [',', 0],
    [';', 0],
    ['\t', 0],
    ['|', 0],
  ]);
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (inQuotes) continue;
    if (char === '\n' || char === '\r') break;
    if (counts.has(char)) counts.set(char, (counts.get(char) || 0) + 1);
  }

  let best = ',';
  let bestCount = 0;
  counts.forEach((count, candidate) => {
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  });

  return best;
}

/**
 * Parses delimited text character by character so quoted values may contain
 * the delimiter, embedded newlines, and escaped double quotes.
 */
export function parseDelimited(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  const endValue = () => {
    row.push(current);
    current = '';
  };

  const endRow = () => {
    endValue();
    if (row.some((value) => value.trim())) rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      endValue();
    } else if (char === '\n') {
      endRow();
    } else if (char === '\r') {
      if (text[index + 1] === '\n') index += 1;
      endRow();
    } else {
      current += char;
    }
  }

  if (current || row.length > 0) endRow();

  return padRows(rows);
}

/* ---------------------------------------------------------------- ZIP reader */

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;

function findEndOfCentralDirectory(view: DataView): number {
  const lowest = Math.max(0, view.byteLength - 22 - 0xffff);

  for (let offset = view.byteLength - 22; offset >= lowest; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }

  return -1;
}

function readZipEntries(buffer: ArrayBuffer): Map<string, ZipEntry> {
  const view = new DataView(buffer);
  const eocd = findEndOfCentralDirectory(view);

  if (eocd < 0) {
    throw new SpreadsheetError('That file is not a valid .xlsx workbook.');
  }

  const total = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder('utf-8');
  const entries = new Map<string, ZipEntry>();

  for (let index = 0; index < total; index += 1) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== CENTRAL_FILE_SIGNATURE) {
      break;
    }

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength));

    entries.set(name, { name, method, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

async function inflateRaw(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof DecompressionStream === 'undefined') {
    throw new SpreadsheetError(
      'This browser cannot unpack Excel files. Please update it, or import a CSV instead.'
    );
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipText(
  buffer: ArrayBuffer,
  entries: Map<string, ZipEntry>,
  name: string
): Promise<string | null> {
  const entry = entries.get(name);
  if (!entry) return null;
  if (entry.compressedSize === 0) return '';

  const view = new DataView(buffer);
  const header = entry.localHeaderOffset;
  const nameLength = view.getUint16(header + 26, true);
  const extraLength = view.getUint16(header + 28, true);
  const start = header + 30 + nameLength + extraLength;
  const raw = new Uint8Array(buffer, start, entry.compressedSize);
  const bytes = entry.method === 0 ? raw : await inflateRaw(raw);

  return new TextDecoder('utf-8').decode(bytes);
}

/* --------------------------------------------------------------- XLSX reader */

const RELATIONSHIP_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function parseXml(xml: string): Document {
  const document = new DOMParser().parseFromString(xml, 'application/xml');

  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new SpreadsheetError('That workbook contains malformed XML and could not be read.');
  }

  return document;
}

/** Matches by local name so workbooks that use a namespace prefix still parse. */
function elements(scope: Document | Element, localName: string): Element[] {
  return Array.from(scope.getElementsByTagNameNS('*', localName));
}

/** Converts a cell reference such as "BC12" to a zero-based column index. */
function columnIndex(reference: string): number {
  let index = 0;

  for (const char of reference) {
    const code = char.toUpperCase().charCodeAt(0);
    if (code < 65 || code > 90) break;
    index = index * 26 + (code - 64);
  }

  return Math.max(0, index - 1);
}

/** Shared strings may be split into rich-text runs, so every <t> is joined. */
function readSharedStrings(xml: string | null): string[] {
  if (!xml) return [];

  return elements(parseXml(xml), 'si').map((item) =>
    elements(item, 't')
      .map((node) => node.textContent || '')
      .join('')
  );
}

const BUILT_IN_DATE_FORMATS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51,
  52, 53, 54, 55, 56, 57, 58,
]);

function isDateFormatCode(code: string): boolean {
  const stripped = code
    .replace(/\[[^\]]*\]/g, '')
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '');

  return /[ymdhs]/i.test(stripped);
}

/** Maps each cellXfs index to whether its number format renders a date. */
function readDateStyles(xml: string | null): boolean[] {
  if (!xml) return [];

  const document = parseXml(xml);
  const customDateFormats = new Set<number>();

  for (const format of elements(document, 'numFmt')) {
    const id = Number(format.getAttribute('numFmtId'));
    const code = format.getAttribute('formatCode') || '';
    if (Number.isFinite(id) && isDateFormatCode(code)) customDateFormats.add(id);
  }

  const cellXfs = elements(document, 'cellXfs')[0];
  if (!cellXfs) return [];

  return elements(cellXfs, 'xf').map((xf) => {
    const id = Number(xf.getAttribute('numFmtId') || 0);
    return BUILT_IN_DATE_FORMATS.has(id) || customDateFormats.has(id);
  });
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Converts an Excel serial date to ISO-like text. Serials count days from the
 * epoch and carry the 1900 leap-year bug, so day 60 is the nonexistent
 * 1900-02-29 and every later serial is one day ahead of the real calendar.
 */
function formatSerialDate(serial: number, use1904: boolean): string {
  const epoch = use1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
  const offsetDays = use1904 || serial < 61 ? serial : serial - 1;
  const date = new Date(epoch + offsetDays * 86400000);

  if (Number.isNaN(date.getTime())) return String(serial);

  const datePart = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`;

  if (Math.abs(serial % 1) < 1e-9) return datePart;

  return `${datePart} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(
    date.getUTCSeconds()
  )}`;
}

function readCell(
  cell: Element,
  sharedStrings: string[],
  dateStyles: boolean[],
  use1904: boolean
): string {
  const type = cell.getAttribute('t') || 'n';

  if (type === 'inlineStr') {
    return elements(cell, 't')
      .map((node) => node.textContent || '')
      .join('');
  }

  const valueNode = elements(cell, 'v')[0];
  const value = valueNode ? valueNode.textContent || '' : '';

  if (type === 's') {
    const index = Number(value);
    return Number.isInteger(index) && sharedStrings[index] !== undefined ? sharedStrings[index] : '';
  }

  if (type === 'str') return value;
  if (type === 'b') return value === '1' ? 'TRUE' : 'FALSE';
  if (type === 'e') return '';
  if (!value) return '';

  const styleIndex = Number(cell.getAttribute('s') || -1);
  const numeric = Number(value);

  // Serial 0 is a real date under the 1904 system but Excel's placeholder
  // "1900-01-00" under the default one, so only the former is converted.
  if (dateStyles[styleIndex] && Number.isFinite(numeric) && (use1904 ? numeric >= 0 : numeric > 0)) {
    return formatSerialDate(numeric, use1904);
  }

  // The stored text is already the canonical decimal, so it is kept verbatim
  // rather than round-tripped through Number and reformatted.
  return value;
}

function readSheetRows(
  xml: string,
  sharedStrings: string[],
  dateStyles: boolean[],
  use1904: boolean
): string[][] {
  const rows: string[][] = [];

  elements(parseXml(xml), 'row').forEach((rowElement, fallbackIndex) => {
    const declared = Number(rowElement.getAttribute('r'));
    const rowIndex = Number.isInteger(declared) && declared > 0 ? declared - 1 : fallbackIndex;
    const values: string[] = [];

    elements(rowElement, 'c').forEach((cell, fallbackColumn) => {
      const reference = cell.getAttribute('r');
      const column = reference ? columnIndex(reference) : fallbackColumn;
      while (values.length < column) values.push('');
      values[column] = readCell(cell, sharedStrings, dateStyles, use1904);
    });

    while (rows.length < rowIndex) rows.push([]);
    rows[rowIndex] = values;
  });

  return rows;
}

/**
 * Drops leading title banners so the header lands on row one. A single-cell row
 * sitting above a wider row is a banner, which spreadsheets have far more often
 * than exported CSVs do. Expects blank rows to already be gone.
 */
function trimLeadingBannerRows(rows: string[][]): string[][] {
  const filled = (row: string[]) => row.filter((cell) => cell.trim()).length;
  let start = 0;

  while (
    start < 3 &&
    start + 1 < rows.length &&
    filled(rows[start]) === 1 &&
    filled(rows[start + 1]) >= 2
  ) {
    start += 1;
  }

  return rows.slice(start);
}

function resolveWorkbookPart(target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  return target.startsWith('xl/') ? target : `xl/${target}`;
}

/** Reads every sheet of an .xlsx workbook, in workbook tab order. */
export async function readExcelWorkbook(buffer: ArrayBuffer): Promise<SheetData[]> {
  const signature = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));

  if (signature[0] === 0xd0 && signature[1] === 0xcf) {
    throw new SpreadsheetError(
      'That is a legacy .xls workbook. Open it in Excel and save as .xlsx, then try again.'
    );
  }

  if (signature[0] !== 0x50 || signature[1] !== 0x4b) {
    throw new SpreadsheetError('That file is not a valid .xlsx workbook.');
  }

  const entries = readZipEntries(buffer);
  const workbookXml = await readZipText(buffer, entries, 'xl/workbook.xml');

  if (!workbookXml) {
    throw new SpreadsheetError('That workbook is missing its sheet index and could not be read.');
  }

  const relationshipsXml = await readZipText(buffer, entries, 'xl/_rels/workbook.xml.rels');
  const targets = new Map<string, string>();

  if (relationshipsXml) {
    for (const relationship of elements(parseXml(relationshipsXml), 'Relationship')) {
      const id = relationship.getAttribute('Id');
      const target = relationship.getAttribute('Target');
      if (id && target) targets.set(id, resolveWorkbookPart(target));
    }
  }

  const sharedStringsName =
    Array.from(entries.keys()).find((name) => name.endsWith('sharedStrings.xml')) ||
    'xl/sharedStrings.xml';

  const [sharedStrings, dateStyles] = await Promise.all([
    readZipText(buffer, entries, sharedStringsName).then(readSharedStrings),
    readZipText(buffer, entries, 'xl/styles.xml').then(readDateStyles),
  ]);

  const workbook = parseXml(workbookXml);
  const use1904 = elements(workbook, 'workbookPr').some((properties) => {
    const flag = properties.getAttribute('date1904');
    return flag === '1' || flag === 'true';
  });

  const sheets: SheetData[] = [];
  const sheetElements = elements(workbook, 'sheet');

  for (let index = 0; index < sheetElements.length; index += 1) {
    const sheet = sheetElements[index];
    const relationshipId =
      sheet.getAttributeNS(RELATIONSHIP_NS, 'id') || sheet.getAttribute('r:id') || '';
    const part = targets.get(relationshipId) || `xl/worksheets/sheet${index + 1}.xml`;
    // eslint-disable-next-line no-await-in-loop
    const sheetXml = await readZipText(buffer, entries, part);

    if (!sheetXml) continue;

    // Blank rows are dropped the way the delimited parser drops them, so stray
    // gaps in a sheet do not arrive at the API as empty products.
    const rows = readSheetRows(sheetXml, sharedStrings, dateStyles, use1904).filter((row) =>
      row.some((cell) => cell.trim())
    );

    sheets.push({
      name: sheet.getAttribute('name') || `Sheet ${index + 1}`,
      rows: padRows(trimLeadingBannerRows(rows)),
    });
  }

  if (sheets.length === 0) {
    throw new SpreadsheetError('That workbook has no readable sheets.');
  }

  return sheets;
}
