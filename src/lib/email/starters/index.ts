import { simpleToHtml } from '@/lib/email-editor-mode'
import { REAL_ESTATE_STARTERS, type StarterSource, type StarterLocale } from './real-estate'

/**
 * The starter templates offered in the gallery.
 *
 * They replaced a set about blog digests, e-commerce and password resets, which
 * an estate agency had to delete a paragraph at a time before it could send
 * anything. These are the letters an agency actually writes, in French and in
 * English.
 *
 * Every one is built by `simpleToHtml`, which is the editor's own format: that
 * is what makes "start from a template" and "edit it like Gmail" the same
 * sentence. A starter built as a 600px table, as the old ones were, opens in the
 * editor as something it cannot own.
 */

export type StarterTemplateType = 'marketing' | 'transactional' | 'automation'
export type StarterTemplateLayout = 'editorial' | 'promotion' | 'confirmation'

export interface EmailStarterTemplate {
  id: string
  name: string
  tagline: string
  description: string
  category: string
  type: StarterTemplateType
  layout: StarterTemplateLayout
  subject: string
  accent: string
  mood: string
  /** Optional: a starter without one gets a typographic card in the gallery. */
  previewImage?: string
  variables: string[]
  tags: string[]
  metrics: {
    industry: string
    useCase: string
    layout: string
  }
  highlights: string[]
  htmlContent: string
  textContent: string
}

/** A paragraph in the editor's own markup. */
const paragraph = (text: string) => `<p style="margin:0 0 12px;">${text}</p>`

/** A short list of facts — what a property email is mostly made of. */
const bullets = (items: string[]) =>
  `<ul style="margin:0 0 12px;padding-left:20px;">${items.map(item => `<li>${item}</li>`).join('')}</ul>`

function buildHtml(body: StarterBody): string {
  const parts = body.map(block =>
    typeof block === 'string' ? paragraph(block) : bullets(block.list)
  )
  return simpleToHtml(parts.join(''), { unsubscribe: true })
}

function buildText(body: StarterBody): string {
  return body
    .map(block => (typeof block === 'string' ? block : block.list.map(item => `- ${item}`).join('\n')))
    .join('\n\n')
}

export type StarterBody = Array<string | { list: string[] }>

function present(source: StarterSource, locale: StarterLocale): EmailStarterTemplate {
  const content = source.content[locale]
  return {
    id: source.id,
    name: content.name,
    tagline: content.tagline,
    description: content.description,
    category: content.category,
    type: source.type,
    layout: source.layout,
    subject: content.subject,
    accent: source.accent,
    mood: content.mood,
    variables: source.variables,
    tags: source.tags,
    metrics: content.metrics,
    highlights: content.highlights,
    htmlContent: buildHtml(content.body),
    textContent: buildText(content.body),
  }
}

/** The locales the starters are written in; anything else reads the English set. */
export const STARTER_LOCALES: StarterLocale[] = ['en', 'fr']

export function isStarterLocale(locale: string): locale is StarterLocale {
  return (STARTER_LOCALES as string[]).includes(locale)
}

/** Starters in the given language, falling back to English. */
export function emailStarterTemplates(locale: string): EmailStarterTemplate[] {
  const language: StarterLocale = isStarterLocale(locale) ? locale : 'en'
  return REAL_ESTATE_STARTERS.map(source => present(source, language))
}

/** Category chips for the gallery, in the same language. */
export function starterTemplateCategories(locale: string): string[] {
  const seen = new Set<string>()
  for (const template of emailStarterTemplates(locale)) seen.add(template.category)
  return ['All', ...Array.from(seen)]
}
