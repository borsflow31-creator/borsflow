/**
 * HTML escaping for server-rendered markup.
 *
 * Quote and invoice email bodies and PDF documents are built by string
 * interpolation, and most of what goes into them — client name, notes, terms, line
 * item descriptions — is user input that is later rendered in a third party's mail
 * client. Every interpolated value passes through here.
 */

/** Escape a value for use in HTML text or a quoted attribute. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape user text that should keep its line breaks in HTML output.
 *
 * Notes and terms are multi-line textareas; without this they collapse onto one line.
 */
export function escapeHtmlMultiline(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br />');
}

/**
 * Only `http(s)` URLs survive. Anything else — `javascript:`, `data:`, a relative
 * path, a malformed string — returns null so the caller can omit the link rather
 * than emit an attacker-controlled `href`.
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}
