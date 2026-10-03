/**
 * Which editor owns a template's HTML, and conversions for the Simple
 * (Gmail-style) editor. The owner is recorded as a <meta name="bf-editor">
 * tag so no schema change is needed; Gmail and other clients ignore it.
 */

export type EditorMode = 'simple' | 'blocks' | 'inline'

const SIMPLE_MARKER = '<meta name="bf-editor" content="simple"/>'
const BLOCKS_MARKER_RE = /<meta name="bf-editor" content="blocks"\s*\/?>/i
const SIMPLE_MARKER_RE = /<meta name="bf-editor" content="simple"\s*\/?>/i
// blocksToHtml output from before the marker existed
const LEGACY_BLOCKS_RE = /<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system/

/** null = no content yet, so the user picks an editor first. */
export function detectEditorMode(html: string | null | undefined): EditorMode | null {
  if (!html || !html.trim()) return null
  if (SIMPLE_MARKER_RE.test(html)) return 'simple'
  if (BLOCKS_MARKER_RE.test(html) || LEGACY_BLOCKS_RE.test(html)) return 'blocks'
  return 'inline'
}

const BODY_START = '<div id="bf-simple-body"'
const BODY_END = '<!--/bf-simple-body-->'

/** Wraps Simple-editor body HTML in a minimal, personal-looking email. */
export function simpleToHtml(bodyHtml: string, { unsubscribe }: { unsubscribe: boolean }): string {
  const footer = unsubscribe
    ? `<div id="bf-simple-footer" style="margin-top:32px;font-size:12px;color:#9ca3af;"><a href="{{unsubscribe_url}}" style="color:#9ca3af;">Unsubscribe</a></div>`
    : ''
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>${SIMPLE_MARKER}<meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;padding:16px;background:#ffffff;"><div style="max-width:600px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#222222;text-align:left;">${BODY_START} style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#222222;">${bodyHtml}</div>${BODY_END}${footer}</div></body></html>`
}

/** Reads the Simple-editor body and footer setting back out of saved HTML. */
export function htmlToSimple(html: string): { bodyHtml: string; unsubscribe: boolean } {
  const start = html.indexOf(BODY_START)
  const end = html.indexOf(BODY_END)
  if (start === -1 || end === -1) return { bodyHtml: '', unsubscribe: true }
  const open = html.indexOf('>', start) + 1
  // The body div's own closing tag sits right before the end marker
  const inner = html.slice(open, end).replace(/<\/div>\s*$/, '')
  return { bodyHtml: inner, unsubscribe: html.includes('id="bf-simple-footer"') }
}

/** Plain-text alternative for any HTML email. */
export function htmlToPlainText(html: string): string {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('style, script, head, title').forEach((n) => n.remove())
  // Keep link targets, which plain-text readers can't otherwise reach
  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || ''
    const text = (a.textContent || '').trim()
    if (href && !href.startsWith('#') && href !== text) a.textContent = `${text} (${href})`
  })
  doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
  doc.querySelectorAll('li').forEach((li) => li.prepend('- '))
  doc.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, tr').forEach((el) => el.append('\n'))
  return (doc.body?.textContent || '')
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Simple body → text usable in a block-editor text block. Text blocks render
 * inline HTML inside a <p>, so lists and paragraphs become line breaks.
 */
export function simpleBodyToBlockText(bodyHtml: string): string {
  return bodyHtml
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/?(ul|ol)[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<(p|div|h[1-6])[^>]*>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Any HTML → paragraphs for the Simple editor (used when switching from Designed). */
export function htmlToSimpleBody(html: string): string {
  const text = htmlToPlainText(html.replace(/<tr><td style="padding:20px 28px;background:#f9fafb;[\s\S]*?<\/tr>/, ''))
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return text
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 12px;">${escape(para).replace(/\n/g, '<br>')}</p>`)
    .join('')
}
