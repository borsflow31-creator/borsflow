/** "3 minutes ago", "yesterday", "2 weeks ago"; older than ~a month shows the date. */
export function relativeTime(iso: string | Date, locale: string) {
  const time = typeof iso === 'string' ? Date.parse(iso) : iso.getTime();
  const diff = (time - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return new Date(time).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}
