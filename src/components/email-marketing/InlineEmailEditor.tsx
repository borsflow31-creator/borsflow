'use client'

/**
 * InlineEmailEditor
 *
 * Click-to-edit for HTML the block builder can't parse (imported or custom
 * templates). The email renders as-is in a same-origin iframe; text becomes
 * editable in place and links/images get a small popover, so the layout is
 * never rebuilt and the original design survives.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { MousePointerClick, X } from 'lucide-react'

interface InlineEmailEditorProps {
  /** HTML to load; changing it re-renders the editor (e.g. after HTML-tab edits) */
  html: string
  onChange: (html: string) => void
}

type Target =
  | { kind: 'link'; el: HTMLAnchorElement; href: string }
  | { kind: 'image'; el: HTMLImageElement; src: string; alt: string }

const EDITABLE_ATTR = 'data-bf-edit'
const TEXT_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'LI', 'A', 'TD', 'TH', 'DIV', 'STRONG', 'EM', 'B', 'I'])

function hasDirectText(el: Element) {
  return Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim())
}

/** Serialise the edited document without any of the editor's helper markup. */
function serialize(doc: Document): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-bf-helper]').forEach((n) => n.remove())
  clone.querySelectorAll(`[${EDITABLE_ATTR}]`).forEach((n) => {
    n.removeAttribute(EDITABLE_ATTR)
    n.removeAttribute('contenteditable')
  })
  const doctype = doc.doctype ? new XMLSerializer().serializeToString(doc.doctype) + '\n' : ''
  return doctype + clone.outerHTML
}

export default function InlineEmailEditor({ html, onChange }: InlineEmailEditorProps) {
  const { t } = useI18n()
  const frameRef = useRef<HTMLIFrameElement>(null)
  // HTML we emitted ourselves: don't reload the iframe for our own edits
  const lastEmitted = useRef<string | null>(null)
  const [srcDoc, setSrcDoc] = useState(html)
  const [target, setTarget] = useState<Target | null>(null)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (html !== lastEmitted.current) setSrcDoc(html)
  }, [html])

  const emit = useCallback((transform?: (html: string) => string) => {
    const doc = frameRef.current?.contentDocument
    if (!doc) return
    const serialized = serialize(doc)
    const next = transform ? transform(serialized) : serialized
    lastEmitted.current = next
    onChange(next)
  }, [onChange])

  const setup = useCallback(() => {
    const frame = frameRef.current
    const doc = frame?.contentDocument
    if (!frame || !doc?.body) return

    const style = doc.createElement('style')
    style.setAttribute('data-bf-helper', '')
    // The iframe can't see the app's CSS variables; pass the accent token in
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim() || '74 75 215'
    style.textContent = `
      [${EDITABLE_ATTR}]{outline:1px dashed transparent;outline-offset:2px;cursor:text}
      [${EDITABLE_ATTR}]:hover{outline-color:rgb(${accent} / .55)}
      [${EDITABLE_ATTR}]:focus{outline:2px solid rgb(${accent} / .8)}
      a,img{cursor:pointer}
      img:hover{outline:2px dashed rgb(${accent} / .55);outline-offset:2px}`
    doc.head?.appendChild(style)

    // Make each innermost element that holds text editable
    doc.body.querySelectorAll('*').forEach((el) => {
      if (!TEXT_TAGS.has(el.tagName) || !hasDirectText(el)) return
      if (el.parentElement?.closest(`[${EDITABLE_ATTR}]`)) return
      el.setAttribute(EDITABLE_ATTR, '')
      el.setAttribute('contenteditable', 'true')
    })

    doc.addEventListener('input', () => emit())
    doc.addEventListener('click', (e) => {
      const el = e.target as Element
      const img = el.closest('img')
      const link = el.closest('a')
      if (!img && !link) { setTarget(null); return }
      // Editable link text still opens the URL popover, but never navigates
      e.preventDefault()
      const rect = (img || link)!.getBoundingClientRect()
      const frameRect = frame.getBoundingClientRect()
      setPopoverPos({
        top: frameRect.top + rect.bottom + 6,
        left: Math.min(frameRect.left + rect.left, window.innerWidth - 340),
      })
      if (img) setTarget({ kind: 'image', el: img, src: img.getAttribute('src') || '', alt: img.getAttribute('alt') || '' })
      else setTarget({ kind: 'link', el: link!, href: link!.getAttribute('href') || '' })
    })

    // Fit the iframe to its content so the page scrolls, not the frame
    frame.style.height = `${Math.max(doc.documentElement.scrollHeight, 600)}px`
  }, [emit])

  const applyTarget = () => {
    if (!target) return
    if (target.kind === 'link') {
      target.el.setAttribute('href', target.href)
      setTarget(null)
      emit()
      return
    }
    const oldSrc = target.el.getAttribute('src') || ''
    target.el.setAttribute('src', target.src)
    target.el.setAttribute('alt', target.alt)
    setTarget(null)
    // Outlook-only copies of an image live inside conditional comments, which
    // aren't elements; swap the old URL there too so every client gets the new one.
    emit(oldSrc && oldSrc !== target.src ? (html) => {
      const amp = (v: string) => v.replace(/&/g, '&amp;')
      return html
        .split(`src="${oldSrc}"`).join(`src="${target.src}"`)
        .split(`src="${amp(oldSrc)}"`).join(`src="${amp(target.src)}"`)
    } : undefined)
  }

  const inputCls = 'w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50'

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-outline-variant/20 bg-surface-container-low px-4 py-2 text-xs text-on-surface-variant">
        <MousePointerClick className="h-3.5 w-3.5" />
        {t('emailMarketing.inlineEditor.hint')}
      </div>
      <div className="flex-1 overflow-auto bg-background p-4" onScroll={() => setTarget(null)}>
        <iframe
          ref={frameRef}
          srcDoc={srcDoc}
          onLoad={setup}
          sandbox="allow-same-origin"
          title={t('misc.templatePreview')}
          className="mx-auto block rounded-xl bg-white shadow-md"
          style={{ width: 680, maxWidth: '100%', minHeight: 600, border: 'none' }}
        />
      </div>

      {target && (
        <div
          className="fixed z-[60] w-80 space-y-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-xl"
          style={{ top: popoverPos.top, left: Math.max(popoverPos.left, 8) }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-on-surface">
              {target.kind === 'link' ? t('emailMarketing.inlineEditor.editLink') : t('emailMarketing.inlineEditor.editImage')}
            </span>
            <button type="button" onClick={() => setTarget(null)} aria-label={t('common.close')}
              className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container-high">
              <X className="h-4 w-4" />
            </button>
          </div>
          {target.kind === 'link' ? (
            <label className="block text-xs font-medium text-on-surface-variant">
              {t('emailMarketing.inlineEditor.linkUrl')}
              <input autoFocus value={target.href} onChange={(e) => setTarget({ ...target, href: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && applyTarget()} className={`${inputCls} mt-1`} />
            </label>
          ) : (
            <>
              <label className="block text-xs font-medium text-on-surface-variant">
                {t('emailMarketing.inlineEditor.imageUrl')}
                <input autoFocus value={target.src} onChange={(e) => setTarget({ ...target, src: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && applyTarget()} className={`${inputCls} mt-1`} />
              </label>
              <label className="block text-xs font-medium text-on-surface-variant">
                {t('emailMarketing.inlineEditor.imageAlt')}
                <input value={target.alt} onChange={(e) => setTarget({ ...target, alt: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && applyTarget()} className={`${inputCls} mt-1`} />
              </label>
            </>
          )}
          <button type="button" onClick={applyTarget}
            className="w-full rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-on-secondary transition hover:opacity-90">
            {t('emailMarketing.inlineEditor.apply')}
          </button>
        </div>
      )}
    </div>
  )
}
