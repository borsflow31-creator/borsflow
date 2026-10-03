'use client'

/**
 * SimpleEmailEditor
 *
 * Gmail-style compose: a subject line and a rich-text body (bold, italic,
 * underline, links, lists) with merge-field insertion. Produces minimal HTML
 * via simpleToHtml so the email reads like a personal message.
 */

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { Bold, Italic, Underline, Link2, List, ListOrdered, RemoveFormatting, Braces } from 'lucide-react'
import { htmlToSimple, simpleToHtml } from '@/lib/email-editor-mode'

interface SimpleEmailEditorProps {
  /** Saved HTML to start from; only read on mount */
  initialHtml: string
  subject: string
  onSubjectChange: (subject: string) => void
  onChange: (html: string) => void
  variables?: string[]
  subjectError?: boolean
}

const BASE_FIELDS = ['first_name', 'last_name', 'company', 'company_name']

export default function SimpleEmailEditor({
  initialHtml,
  subject,
  onSubjectChange,
  onChange,
  variables = [],
  subjectError,
}: SimpleEmailEditorProps) {
  const { t } = useI18n()
  const bodyRef = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)
  const [initial] = useState(() => htmlToSimple(initialHtml))
  const [unsubscribe, setUnsubscribe] = useState(initial.unsubscribe)
  const [isEmpty, setIsEmpty] = useState(!initial.bodyHtml)
  const [fieldsOpen, setFieldsOpen] = useState(false)

  const fields = Array.from(new Set([...BASE_FIELDS, ...variables]))

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.innerHTML = initial.bodyHtml
  }, [initial])

  const emit = (nextUnsubscribe = unsubscribe) => {
    const body = bodyRef.current
    if (!body) return
    const text = (body.textContent || '').trim()
    setIsEmpty(!text && !body.querySelector('img, li'))
    onChange(text || body.querySelector('li') ? simpleToHtml(body.innerHTML, { unsubscribe: nextUnsubscribe }) : '')
  }

  // Toolbar buttons steal focus; remember the caret so commands land in the body
  const rememberSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount && bodyRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }
  const restoreSelection = () => {
    bodyRef.current?.focus()
    const sel = window.getSelection()
    if (sel && savedRange.current) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
  }

  const exec = (command: string, value?: string) => {
    restoreSelection()
    document.execCommand(command, false, value)
    rememberSelection()
    emit()
  }

  const addLink = () => {
    rememberSelection()
    const url = window.prompt(t('emailMarketing.simpleEditor.linkPrompt'), 'https://')
    if (!url || url === 'https://') return
    const sel = window.getSelection()
    restoreSelection()
    if (sel && sel.isCollapsed) {
      // No text selected: insert the URL itself as the link text
      document.execCommand('insertHTML', false, `<a href="${url.replace(/"/g, '&quot;')}">${url.replace(/</g, '&lt;')}</a>`)
    } else {
      document.execCommand('createLink', false, url)
    }
    emit()
  }

  const insertField = (field: string) => {
    setFieldsOpen(false)
    restoreSelection()
    document.execCommand('insertText', false, `{{${field}}}`)
    rememberSelection()
    emit()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // Plain text only, so formatting from Word/web pages doesn't leak in
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    const html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\r?\n/g, '<br>')
    document.execCommand('insertHTML', false, html)
    emit()
  }

  const tools: { icon: React.ElementType; label: string; onClick: () => void }[] = [
    { icon: Bold, label: t('emailMarketing.simpleEditor.bold'), onClick: () => exec('bold') },
    { icon: Italic, label: t('emailMarketing.simpleEditor.italic'), onClick: () => exec('italic') },
    { icon: Underline, label: t('emailMarketing.simpleEditor.underline'), onClick: () => exec('underline') },
    { icon: Link2, label: t('emailMarketing.simpleEditor.link'), onClick: addLink },
    { icon: List, label: t('emailMarketing.simpleEditor.bulletList'), onClick: () => exec('insertUnorderedList') },
    { icon: ListOrdered, label: t('emailMarketing.simpleEditor.numberedList'), onClick: () => exec('insertOrderedList') },
    { icon: RemoveFormatting, label: t('emailMarketing.simpleEditor.clearFormatting'), onClick: () => exec('removeFormat') },
  ]

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
        {/* Subject */}
        <div className="flex items-center gap-3 border-b border-outline-variant/20 px-5 py-3">
          <label htmlFor="simple-subject" className="text-sm text-on-surface-variant">{t('emailMarketing.simpleEditor.subject')}</label>
          <input
            id="simple-subject"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder={t('emailMarketing.templateModal.subjectPlaceholder')}
            className={`min-w-0 flex-1 bg-transparent text-base text-on-surface focus:outline-none ${subjectError ? 'placeholder:text-red-400' : ''}`}
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-outline-variant/20 px-3 py-1.5">
          {tools.map(({ icon: Icon, label, onClick }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClick}
              className="rounded-md p-2 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <div className="mx-1 h-5 w-px bg-outline-variant/30" />
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); rememberSelection() }}
              onClick={() => setFieldsOpen((v) => !v)}
              aria-expanded={fieldsOpen}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
            >
              <Braces className="h-4 w-4" />
              {t('emailMarketing.simpleEditor.insertField')}
            </button>
            {fieldsOpen && (
              <div className="absolute left-0 top-full z-10 mt-1 min-w-48 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest py-1 shadow-lg">
                {fields.map((field) => (
                  <button
                    key={field}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertField(field)}
                    className="block w-full px-3 py-1.5 text-left font-mono text-xs text-on-surface transition hover:bg-surface-container-high"
                  >
                    {`{{${field}}}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="relative">
          {isEmpty && (
            <div className="pointer-events-none absolute left-5 top-4 whitespace-pre-line text-base text-on-surface-variant/60">
              {t('emailMarketing.simpleEditor.bodyPlaceholder')}
            </div>
          )}
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={t('emailMarketing.simpleEditor.body')}
            onInput={() => emit()}
            onKeyUp={rememberSelection}
            onMouseUp={rememberSelection}
            onBlur={rememberSelection}
            onPaste={handlePaste}
            className="min-h-[360px] px-5 py-4 text-base leading-relaxed text-on-surface focus:outline-none [&_a]:text-secondary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
          />
        </div>

        {/* Footer */}
        <label className="flex cursor-pointer items-center gap-2 border-t border-outline-variant/20 px-5 py-3 text-sm text-on-surface-variant">
          <input
            type="checkbox"
            checked={unsubscribe}
            onChange={(e) => { setUnsubscribe(e.target.checked); emit(e.target.checked) }}
            className="h-4 w-4 accent-secondary"
          />
          {t('emailMarketing.simpleEditor.unsubscribeToggle')}
        </label>
      </div>
    </div>
  )
}
