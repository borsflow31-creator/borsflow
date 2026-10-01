/**
 * Redirect-target validation for the `?callbackUrl=` parameter.
 *
 * An emailed workspace invitation routes the recipient through /login,
 * /register and /verify-email before it can be accepted, and each hop carries
 * the invitation path forward in a query parameter. That parameter is
 * attacker-controllable, so it is only ever honoured when it is a path on this
 * origin: a value starting with a single "/" — never "//host", which the
 * browser reads as protocol-relative and would follow off-site.
 */

/**
 * Return `raw` when it is a safe same-origin path, otherwise `fallback`.
 *
 * Pass `null` as the fallback when the caller wants to distinguish "no
 * callbackUrl" from "go to the default page".
 */
export function safeCallbackUrl<T extends string | null>(
  raw: string | null | undefined,
  fallback: T
): string | T {
  if (typeof raw !== 'string') return fallback;
  if (!raw.startsWith('/')) return fallback;
  // "//evil.com" and "/\evil.com" are both read as protocol-relative by
  // browsers, so neither counts as a local path.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  return raw;
}

/** The app's own origin, no trailing slash. Same env var `src/lib/documents/share.ts` uses. */
export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/** Turns an in-app path (e.g. from a Notification's `href`) into an absolute URL for email links. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${appBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
}
