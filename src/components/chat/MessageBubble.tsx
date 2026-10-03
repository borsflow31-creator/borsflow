'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, MessageSquare, MoreHorizontal, Pencil, Pin, PinOff, SmilePlus, Trash2, Copy, Loader2, AlertCircle } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import { QUICK_REACTIONS, formatFullDate, formatTime, getFileIcon, getInitials, parseMessageText, plainText } from './chatFormat'
import type { ChatItem, UserDirectory } from './types'

export interface MessageActions {
  onReact: (emoji: string) => void
  onReply?: () => void
  onEdit: (text: string) => Promise<void>
  onDelete: () => void
  onPin?: (pinned: boolean) => void
}

function FilePreview({ message, isOwn }: { message: ChatItem; isOwn: boolean }) {
  if (!message.fileUrl) return null
  if (message.fileType?.startsWith('image/')) {
    return (
      <a href={message.fileUrl} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={message.fileUrl}
          alt={message.fileName ?? ''}
          loading="lazy"
          className="mb-2 max-h-60 max-w-full cursor-pointer rounded-xl object-cover transition-opacity hover:opacity-90"
        />
      </a>
    )
  }
  return (
    <a
      href={message.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`group mb-2 flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${
        isOwn ? 'bg-white/15 hover:bg-white/25' : 'bg-surface-container-highest hover:bg-outline-variant/20'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{getFileIcon(message.fileType)}</span>
      <span className="max-w-[200px] truncate text-xs font-medium">{message.fileName}</span>
      <Download className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
    </a>
  )
}

/** Message text with clickable links and highlighted @mentions; never rendered as HTML. */
export function MessageText({ text, directory, myId, isOwn }: { text: string; directory: UserDirectory; myId?: string; isOwn: boolean }) {
  return (
    <p className="whitespace-pre-wrap break-words leading-relaxed">
      {parseMessageText(text).map((part, i) => {
        if (part.kind === 'text') return <span key={i}>{part.value}</span>
        if (part.kind === 'link') {
          return (
            <a key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 hover:opacity-80 break-all">
              {part.value}
            </a>
          )
        }
        const person = directory[part.userId]
        const label = `@${person?.name ?? person?.email ?? 'unknown'}`
        const me = part.userId === myId
        return (
          <span
            key={i}
            className={`rounded px-0.5 font-semibold ${
              isOwn ? 'bg-white/20' : me ? 'bg-amber-400/25 text-on-surface' : 'bg-secondary/15 text-secondary'
            }`}
          >
            {label}
          </span>
        )
      })}
    </p>
  )
}

export function MessageBubble({
  message, isOwn, showHeader, directory, myId, canWrite, canModerate, actions, highlighted = false,
}: {
  message: ChatItem
  isOwn: boolean
  showHeader: boolean
  directory: UserDirectory
  myId?: string
  canWrite: boolean
  canModerate: boolean
  actions: MessageActions
  highlighted?: boolean
}) {
  const { t } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.text)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  // On touch screens there's no hover: a tap on the bubble shows the actions
  const [touchActions, setTouchActions] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen && !emojiOpen && !touchActions) return
    const close = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setEmojiOpen(false)
        setTouchActions(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [menuOpen, emojiOpen, touchActions])

  const deleted = !!message.deletedAt
  const saved = !!message.id && !message.pending
  const interactive = saved && !deleted && canWrite
  const reactions = Object.entries(message.reactions ?? {}).filter(([, users]) => users.length > 0)

  const saveEdit = async () => {
    const text = draft.trim()
    if (!text && !message.fileUrl) return
    if (text === message.text) { setEditing(false); return }
    setSaving(true)
    setEditError(null)
    try {
      await actions.onEdit(text)
      setEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('chat.genericError'))
    } finally {
      setSaving(false)
    }
  }

  const reactionTitle = (emoji: string, users: string[]) =>
    `${emoji} ${users.map(id => (id === myId ? t('chat.you') : directory[id]?.name ?? directory[id]?.email ?? '?')).join(', ')}`

  return (
    <div
      ref={rootRef}
      className={`group relative flex items-end gap-2 rounded-xl px-1 py-0.5 transition-colors ${isOwn ? 'flex-row-reverse' : ''} ${
        highlighted ? 'bg-amber-400/15' : ''
      }`}
    >
      <div className="h-7 w-7 shrink-0">
        {showHeader && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary/20 text-[10px] font-bold text-secondary" aria-hidden>
            {getInitials(message.displayName)}
          </div>
        )}
      </div>

      <div className={`flex max-w-[85%] flex-col gap-0.5 sm:max-w-[72%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {showHeader && (
          <span className={`flex items-baseline gap-2 px-1 text-[11px] ${isOwn ? 'flex-row-reverse' : ''}`}>
            {!isOwn && <span className="font-semibold text-on-surface-variant">{message.displayName}</span>}
            <time dateTime={message.createdAt} title={formatFullDate(message.createdAt)} className="text-on-surface-variant/60">
              {formatTime(message.createdAt)}
            </time>
          </span>
        )}

        {message.pinnedAt && !deleted && (
          <span className="flex items-center gap-1 px-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            <Pin className="h-3 w-3" /> {t('chat.pinned')}
          </span>
        )}

        <div
          onClick={() => interactive && setTouchActions(v => !v)}
          className={`px-4 py-2.5 text-sm shadow-sm ${
            deleted
              ? 'rounded-2xl border border-dashed border-outline-variant/40 bg-transparent italic text-on-surface-variant'
              : isOwn
                ? 'rounded-2xl rounded-br-sm bg-secondary text-on-secondary'
                : 'rounded-2xl rounded-bl-sm border border-outline-variant/10 bg-surface-container-high text-on-surface'
          } ${message.pending ? 'opacity-60' : ''}`}
        >
          {deleted ? (
            <span>{t('chat.messageDeleted')}</span>
          ) : editing ? (
            <div className="min-w-[220px] space-y-2" onClick={(e) => e.stopPropagation()}>
              <textarea
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void saveEdit() }
                  if (e.key === 'Escape') { setEditing(false); setDraft(message.text) }
                }}
                rows={Math.min(6, Math.max(1, draft.split('\n').length))}
                maxLength={4000}
                aria-label={t('chat.editMessage')}
                className="w-full resize-none rounded-lg bg-black/10 px-2 py-1.5 text-sm outline-none"
              />
              {editError && <p className="text-xs text-red-200">{editError}</p>}
              <div className="flex justify-end gap-2 text-xs">
                <button type="button" onClick={() => { setEditing(false); setDraft(message.text) }} className="rounded-lg px-2 py-1 hover:bg-black/10">
                  {t('common.cancel')}
                </button>
                <button type="button" onClick={() => void saveEdit()} disabled={saving} className="flex items-center gap-1 rounded-lg bg-black/15 px-2 py-1 font-semibold hover:bg-black/25">
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  {t('common.save')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <FilePreview message={message} isOwn={isOwn} />
              {message.text && <MessageText text={message.text} directory={directory} myId={myId} isOwn={isOwn} />}
            </>
          )}
        </div>

        {/* Under the bubble: edited marker, failure, reactions, thread link */}
        {(message.editedAt && !deleted) || message.failed ? (
          <span className="flex items-center gap-1 px-1 text-[10px] text-on-surface-variant/60">
            {message.failed && <><AlertCircle className="h-3 w-3 text-red-500" /><span className="text-red-500">{t('chat.notSent')}</span></>}
            {message.editedAt && !deleted && <span title={formatFullDate(message.editedAt)}>{t('chat.edited')}</span>}
          </span>
        ) : null}

        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 ${isOwn ? 'justify-end' : ''}`}>
            {reactions.map(([emoji, users]) => {
              const mine = !!myId && users.includes(myId)
              return (
                <button
                  key={emoji}
                  type="button"
                  disabled={!interactive}
                  onClick={() => actions.onReact(emoji)}
                  title={reactionTitle(emoji, users)}
                  aria-pressed={mine}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                    mine
                      ? 'border-secondary/50 bg-secondary/15 text-secondary'
                      : 'border-outline-variant/30 bg-surface-container text-on-surface-variant hover:border-secondary/40'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="font-medium tabular-nums">{users.length}</span>
                </button>
              )
            })}
          </div>
        )}

        {!!message.replyCount && actions.onReply && !deleted && (
          <button type="button" onClick={actions.onReply} className="flex items-center gap-1 px-1 text-[11px] font-semibold text-secondary hover:underline">
            <MessageSquare className="h-3 w-3" />
            {t('chat.replyCount', { count: message.replyCount })}
          </button>
        )}
        {!!message.replyCount && deleted && (
          <span className="px-1 text-[11px] text-on-surface-variant/60">{t('chat.replyCount', { count: message.replyCount })}</span>
        )}
      </div>

      {/* Actions: hover on desktop, tap on touch */}
      {interactive && !editing && (
        <div
          className={`absolute -top-3 z-10 flex items-center gap-0.5 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-0.5 shadow-md transition-opacity ${
            isOwn ? 'left-2' : 'right-2'
          } ${menuOpen || emojiOpen || touchActions ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100'}`}
        >
          {QUICK_REACTIONS.slice(0, 3).map(emoji => (
            <button key={emoji} type="button" onClick={() => actions.onReact(emoji)} aria-label={t('chat.reactWith', { emoji })} className="rounded-lg px-1.5 py-1 text-sm hover:bg-surface-container-high">
              {emoji}
            </button>
          ))}
          <div className="relative">
            <button type="button" onClick={() => { setEmojiOpen(v => !v); setMenuOpen(false) }} aria-label={t('chat.addReaction')} title={t('chat.addReaction')} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high">
              <SmilePlus className="h-4 w-4" />
            </button>
            {emojiOpen && (
              <div className={`absolute top-full z-20 mt-1 grid w-max grid-cols-5 gap-0.5 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-1 shadow-xl ${isOwn ? 'left-0' : 'right-0'}`}>
                {QUICK_REACTIONS.map(emoji => (
                  <button key={emoji} type="button" onClick={() => { actions.onReact(emoji); setEmojiOpen(false) }} aria-label={t('chat.reactWith', { emoji })} className="rounded-lg p-1.5 text-base hover:bg-surface-container-high">
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          {actions.onReply && (
            <button type="button" onClick={actions.onReply} aria-label={t('chat.replyInThread')} title={t('chat.replyInThread')} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high">
              <MessageSquare className="h-4 w-4" />
            </button>
          )}
          <div className="relative">
            <button type="button" onClick={() => { setMenuOpen(v => !v); setEmojiOpen(false) }} aria-label={t('chat.moreActions')} title={t('chat.moreActions')} aria-expanded={menuOpen} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div role="menu" className={`absolute top-full z-20 mt-1 w-44 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-1 shadow-xl ${isOwn ? 'left-0' : 'right-0'}`}>
                {isOwn && (
                  <MenuItem icon={Pencil} label={t('chat.editMessage')} onClick={() => { setDraft(message.text); setEditing(true); setMenuOpen(false); setTouchActions(false) }} />
                )}
                {actions.onPin && (
                  <MenuItem
                    icon={message.pinnedAt ? PinOff : Pin}
                    label={message.pinnedAt ? t('chat.unpin') : t('chat.pin')}
                    onClick={() => { actions.onPin!(!message.pinnedAt); setMenuOpen(false) }}
                  />
                )}
                {message.text && (
                  <MenuItem icon={Copy} label={t('chat.copyText')} onClick={() => { void navigator.clipboard?.writeText(plainText(message.text, directory)); setMenuOpen(false) }} />
                )}
                {(isOwn || canModerate) && (
                  <MenuItem icon={Trash2} label={t('chat.deleteMessage')} danger onClick={() => { actions.onDelete(); setMenuOpen(false); setTouchActions(false) }} />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger = false }: { icon: typeof Pin; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${
        danger ? 'text-red-600 hover:bg-red-500/10 dark:text-red-400' : 'text-on-surface hover:bg-surface-container-high'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}
