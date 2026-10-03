'use client'

import { useMemo, useRef, useState } from 'react'
import { Loader2, Paperclip, Send, X, Lock } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import { MAX_UPLOAD_BYTES, getInitials } from './chatFormat'
import type { UserDirectory } from './types'

const MAX_LENGTH = 4000
const MAX_SUGGESTIONS = 6

export interface ComposerSendInput {
  /** Text with mentions encoded as <@userId> tokens */
  content: string
  file: File | null
}

/**
 * Message box shared by channels and threads. Typing "@" suggests members;
 * picked mentions show as "@Name" while typing and are sent as <@id> tokens so
 * they resolve exactly (and notify the right person).
 */
export function MessageComposer({
  placeholder,
  directory,
  mentionableIds,
  readOnly = false,
  autoFocus = false,
  compact = false,
  onSend,
  onTyping,
}: {
  placeholder: string
  directory: UserDirectory
  /** Restrict suggestions (private channels); defaults to everyone in the directory */
  mentionableIds?: string[]
  readOnly?: boolean
  autoFocus?: boolean
  compact?: boolean
  /** Throw to keep the draft and show the error */
  onSend: (input: ComposerSendInput) => Promise<void>
  onTyping?: (hasText: boolean) => void
}) {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // "@Name" -> userId for mentions picked from the list
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null)
  const [highlight, setHighlight] = useState(0)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const people = useMemo(() => {
    const ids = mentionableIds ?? Object.keys(directory)
    return ids
      .filter(id => directory[id])
      .map(id => ({ id, label: directory[id].name || directory[id].email, email: directory[id].email }))
  }, [directory, mentionableIds])

  const suggestions = useMemo(() => {
    if (!mention) return []
    const q = mention.query.toLowerCase()
    return people.filter(p => p.label.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS)
  }, [mention, people])

  if (readOnly) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-3 text-xs text-on-surface-variant">
        <Lock className="h-3.5 w-3.5" />
        {t('chat.readOnly')}
      </div>
    )
  }

  const resize = () => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  const updateMentionQuery = (value: string, caret: number) => {
    // An "@" at the start or after whitespace, followed by up to 30 non-space chars
    const m = /(?:^|\s)@([^\s@]{0,30})$/.exec(value.slice(0, caret))
    if (m) {
      setMention({ query: m[1], start: caret - m[1].length - 1 })
      setHighlight(0)
    } else {
      setMention(null)
    }
  }

  const onChange = (value: string, caret: number) => {
    setInput(value)
    setError(null)
    updateMentionQuery(value, caret)
    onTyping?.(!!value)
  }

  const pickMention = (person: { id: string; label: string }) => {
    if (!mention) return
    const el = textRef.current
    const caret = el?.selectionStart ?? input.length
    const tag = `@${person.label}`
    const next = `${input.slice(0, mention.start)}${tag} ${input.slice(caret)}`
    setInput(next)
    setPicked(prev => ({ ...prev, [tag]: person.id }))
    setMention(null)
    requestAnimationFrame(() => {
      const pos = mention.start + tag.length + 1
      el?.focus()
      el?.setSelectionRange(pos, pos)
      resize()
    })
  }

  const encodeMentions = (text: string) => {
    // Longest names first so "@Ann Lee" wins over "@Ann"
    const tags = Object.keys(picked).sort((a, b) => b.length - a.length)
    let out = text
    for (const tag of tags) {
      if (out.includes(tag)) out = out.split(tag).join(`<@${picked[tag]}>`)
    }
    return out
  }

  const chooseFile = (f: File | undefined) => {
    if (!f) return
    if (f.size > MAX_UPLOAD_BYTES) {
      setError(t('chat.fileTooLarge'))
      return
    }
    setFile(f)
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
    setError(null)
  }

  const clearFile = () => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
  }

  const send = async () => {
    const trimmed = input.trim()
    if ((!trimmed && !file) || sending) return
    setSending(true)
    setError(null)
    const draft = { input, file, preview, picked }
    // Clear right away so the next message can be typed while this one sends
    setInput('')
    setFile(null)
    setPreview(null)
    setPicked({})
    setMention(null)
    onTyping?.(false)
    requestAnimationFrame(resize)
    try {
      await onSend({ content: encodeMentions(trimmed), file: draft.file })
      if (draft.preview) URL.revokeObjectURL(draft.preview)
    } catch (err) {
      // Put the draft back so nothing typed is lost
      setInput(cur => cur || draft.input)
      setFile(cur => cur ?? draft.file)
      setPreview(cur => cur ?? draft.preview)
      setPicked(cur => ({ ...draft.picked, ...cur }))
      setError(err instanceof Error && err.message ? err.message : t('chat.sendFailed'))
    } finally {
      setSending(false)
      textRef.current?.focus()
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => (h + 1) % suggestions.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => (h - 1 + suggestions.length) % suggestions.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickMention(suggestions[highlight]); return }
      if (e.key === 'Escape') { e.preventDefault(); setMention(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="relative">
      {/* Mention suggestions */}
      {mention && suggestions.length > 0 && (
        <ul role="listbox" aria-label={t('chat.mentionSuggestions')} className="absolute bottom-full left-0 right-0 z-20 mb-2 max-h-60 overflow-y-auto rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-1 shadow-xl">
          {suggestions.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pickMention(p) }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${i === highlight ? 'bg-secondary/10 text-on-surface' : 'text-on-surface-variant'}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-[10px] font-bold text-secondary">{getInitials(p.label)}</span>
                <span className="truncate font-medium">{p.label}</span>
                {p.label !== p.email && <span className="truncate text-xs text-on-surface-variant/70">{p.email}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Attached file */}
      {file && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-outline-variant/20 bg-surface-container px-3 py-2">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high">
              <Paperclip className="h-4 w-4 text-on-surface-variant" />
            </div>
          )}
          <span className="flex-1 truncate text-sm text-on-surface">{file.name}</span>
          <button type="button" onClick={clearFile} aria-label={t('chat.removeAttachment')} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-highest">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && <p role="alert" className="mb-2 text-xs text-red-500">{error}</p>}

      <div className="flex items-end gap-2 rounded-2xl border border-outline-variant/30 bg-surface-container px-3 py-2.5 transition-all focus-within:border-secondary/50 focus-within:ring-2 focus-within:ring-secondary/10">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={sending}
          aria-label={t('chat.attachFile')}
          title={t('chat.attachFile')}
          className="mb-0.5 shrink-0 rounded-xl p-1.5 text-on-surface-variant transition-all hover:bg-secondary/10 hover:text-secondary disabled:opacity-40"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
          onChange={(e) => { chooseFile(e.target.files?.[0]); e.target.value = '' }}
        />
        <textarea
          ref={textRef}
          value={input}
          autoFocus={autoFocus}
          onChange={(e) => { onChange(e.target.value, e.target.selectionStart); resize() }}
          onKeyDown={onKeyDown}
          onPaste={(e) => {
            const pasted = Array.from(e.clipboardData.files)[0]
            if (pasted) { e.preventDefault(); chooseFile(pasted) }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          rows={1}
          maxLength={MAX_LENGTH}
          className="custom-scrollbar max-h-40 min-h-[22px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-on-surface outline-none placeholder:text-on-surface-variant/40"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={(!input.trim() && !file) || sending}
          aria-label={t('chat.send')}
          title={t('chat.send')}
          className="mb-0.5 shrink-0 rounded-xl bg-secondary p-1.5 text-on-secondary shadow-sm shadow-secondary/20 transition-all hover:opacity-90 active:scale-95 disabled:opacity-30"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      {!compact && (
        <p className="mt-1.5 hidden text-center text-[10px] text-on-surface-variant/50 sm:block">{t('chat.composerHint')}</p>
      )}
    </div>
  )
}
