/**
 * Plain text from a page's stored content, for the AI assistant to read.
 *
 * `Page.content` is the editor's `{ type: 'doc', blocks: [{ type, content: { text } }] }`.
 * Pages created before the block editor may hold a nested `{ type, content: [...] }`
 * tree instead, so both shapes are walked.
 */

const BLOCK_PREFIX: Record<string, string> = {
  heading1: '# ',
  heading2: '## ',
  heading3: '### ',
  bullet: '- ',
  numbered: '1. ',
  quote: '> ',
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
}

function blockLine(block: any): string {
  const content = typeof block?.content === 'string' ? safeParse(block.content) : block?.content
  const raw = typeof content?.text === 'string'
    ? content.text
    : [content?.toggleTitle, content?.toggleContent].filter((v) => typeof v === 'string').join(': ')
  const text = stripHtml(raw).trim()
  if (!text) return ''
  if (block?.type === 'todo') return `${content?.checked ? '[x]' : '[ ]'} ${text}`
  return (BLOCK_PREFIX[block?.type] ?? '') + text
}

function walkTree(node: any, out: string[]) {
  if (!node || typeof node !== 'object') return
  if (typeof node.text === 'string') out.push(node.text)
  if (Array.isArray(node.content)) {
    const before = out.length
    for (const child of node.content) walkTree(child, out)
    // Break lines between block-level nodes so paragraphs don't run together.
    if (out.length > before && node.type && node.type !== 'text') out.push('\n')
  }
}

function safeParse(value: string): any {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/** Text of a list of blocks (Page.content blocks or Block rows), in order. */
export function blocksToText(blocks: Array<{ type?: string; content?: unknown; order?: number }>): string {
  return [...blocks]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(blockLine)
    .filter(Boolean)
    .join('\n')
}

/** Plain text of a `Page.content` JSON string. Empty string when unreadable. */
export function pageContentToText(content: string | null | undefined): string {
  if (!content) return ''
  const doc = safeParse(content)
  if (!doc) return ''
  if (Array.isArray(doc.blocks)) return blocksToText(doc.blocks)

  const out: string[] = []
  walkTree(doc, out)
  return out.join('').replace(/\n{3,}/g, '\n\n').trim()
}

/** Cut `text` to `max` characters, marking the cut. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}… [truncated]`
}

/** A short excerpt of `text` around the first match of `query`, or its start. */
export function snippetAround(text: string, query: string, radius = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  const at = query ? clean.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (at === -1) return truncate(clean, radius * 2)
  const start = Math.max(0, at - radius)
  const end = Math.min(clean.length, at + query.length + radius)
  return `${start > 0 ? '…' : ''}${clean.slice(start, end)}${end < clean.length ? '…' : ''}`
}

/**
 * Editor blocks from simple Markdown-ish text written by the assistant:
 * `#`/`##`/`###` headings, `-`/`*` bullets, `1.` numbered items, `[ ]` todos,
 * everything else a paragraph.
 */
export function textToBlocks(text: string): Array<{ type: string; text: string }> {
  const blocks: Array<{ type: string; text: string }> = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    let match: RegExpMatchArray | null
    if ((match = line.match(/^(#{1,3})\s+(.*)$/))) {
      blocks.push({ type: `heading${match[1].length}`, text: match[2] })
    } else if ((match = line.match(/^[-*]\s+\[[ xX]?\]\s+(.*)$/))) {
      blocks.push({ type: 'todo', text: match[1] })
    } else if ((match = line.match(/^[-*]\s+(.*)$/))) {
      blocks.push({ type: 'bullet', text: match[1] })
    } else if ((match = line.match(/^\d+[.)]\s+(.*)$/))) {
      blocks.push({ type: 'numbered', text: match[1] })
    } else {
      blocks.push({ type: 'text', text: line })
    }
  }
  return blocks
}
