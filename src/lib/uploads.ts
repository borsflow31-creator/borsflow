// Upload validation shared by chat attachments and CRM prospect files.
// Server-side use only for contentMatchesType (it reads bytes); the type list
// and size limit are also safe to use in the browser for early checks.

/** Allowed MIME types and the extension we store them under (never the client's). */
export const UPLOAD_FILE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
}

/** Extra formats that make sense for CRM documents (proposals, scans, contracts). */
export const CRM_EXTRA_FILE_TYPES: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'image/heic': 'heic',
}

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * The browser-declared MIME type is just a claim; check the first bytes match
 * the stored extension so a renamed executable or HTML page can't ride in as a
 * "PDF" or "image".
 */
export function contentMatchesType(bytes: Uint8Array, ext: string): boolean {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b)
  const isZip = starts(0x50, 0x4b, 0x03, 0x04) || starts(0x50, 0x4b, 0x05, 0x06)
  switch (ext) {
    case 'jpg': return starts(0xff, 0xd8, 0xff)
    case 'png': return starts(0x89, 0x50, 0x4e, 0x47)
    case 'gif': return starts(0x47, 0x49, 0x46, 0x38)
    case 'webp': return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    case 'heic': {
      // ISO-BMFF: "ftyp" at offset 4, then a HEIF brand
      const ftyp = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
      const brand = String.fromCharCode(...Array.from(bytes.slice(8, 12)))
      return ftyp && ['heic', 'heix', 'mif1', 'msf1', 'hevc', 'heim', 'heis'].includes(brand)
    }
    case 'pdf': return starts(0x25, 0x50, 0x44, 0x46)
    case 'zip':
    case 'docx':
    case 'xlsx':
    case 'pptx':
    case 'odt':
    case 'ods': return isZip
    case 'doc':
    case 'xls': return starts(0xd0, 0xcf, 0x11, 0xe0)
    case 'txt':
    case 'csv': return !bytes.slice(0, 8192).includes(0) // text has no NUL bytes
    default: return false
  }
}
