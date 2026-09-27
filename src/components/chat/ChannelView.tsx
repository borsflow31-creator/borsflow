'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Send, Paperclip, X, Hash } from 'lucide-react'
import {
  ChatMessageEventType,
  RoomStatus,
  type ChatMessageEvent,
  type Message,
  type RoomStatusChange,
} from '@ably/chat'
import { useMessages, usePresence, usePresenceListener, useTyping } from '@ably/chat/react'
import { MessageBubble } from './MessageBubble'
import { getInitials, resolveDisplayName, safeFileUrl } from './chatFormat'
import type { Channel, ChatItem, MessageRow, UserDirectory } from './types'

interface ChannelViewProps {
  workspaceId: string
  channel: Channel
  directory: UserDirectory
}

const PAGE_SIZE = 50
const MAX_CATCH_UP_PAGES = 5
const ARCHIVE_RETRY_DELAYS_MS = [500, 1500, 4000]
const NEAR_BOTTOM_PX = 120
const MAX_VISIBLE_PRESENCE = 5

/* ─── Mapping: archived rows and live messages -> one view model ─────────── */

function rowToItem(row: MessageRow, directory: UserDirectory): ChatItem {
  return {
    key: row.id,
    id: row.id,
    serial: row.ablySerial ?? undefined,
    text: row.content,
    userId: row.userId,
    displayName: resolveDisplayName(row.userId, directory, row.user),
    fileUrl: safeFileUrl(row.fileUrl),
    fileName: row.fileName,
    fileType: row.fileType,
    createdAt: row.createdAt,
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : null)

function messageToItem(message: Message, directory: UserDirectory): ChatItem {
  // metadata/headers are client-controlled: read defensively, never trust the display name.
  const meta = message.metadata as Record<string, unknown>
  const clientMsgId = str(message.headers?.clientMsgId) ?? undefined
  return {
    key: clientMsgId ?? message.serial,
    clientMsgId,
    serial: message.serial,
    // File-only messages carry the file name as text (Ably may reject empty text); hide it.
    text: meta.fileOnly === true ? '' : message.text,
    userId: message.clientId,
    displayName: resolveDisplayName(message.clientId, directory, { name: str(meta.name), email: str(meta.email) }),
    fileUrl: safeFileUrl(meta.fileUrl),
    fileName: str(meta.fileName),
    fileType: str(meta.fileType),
    createdAt: message.timestamp.toISOString(),
  }
}

/**
 * Merge incoming items into the list. An incoming item that matches an existing one by
 * clientMsgId, serial or archive id REPLACES it in place (keeping the original React key so
 * the bubble doesn't remount or re-animate); otherwise it is appended. Result is time-sorted.
 */
function mergeItems(prev: ChatItem[], incoming: ChatItem[]): ChatItem[] {
  const next = prev.slice()
  const byClient = new Map<string, number>()
  const bySerial = new Map<string, number>()
  const byId = new Map<string, number>()
  const index = (item: ChatItem, at: number) => {
    if (item.clientMsgId) byClient.set(item.clientMsgId, at)
    if (item.serial) bySerial.set(item.serial, at)
    if (item.id) byId.set(item.id, at)
  }
  next.forEach(index)

  for (const inc of incoming) {
    const at =
      (inc.clientMsgId !== undefined ? byClient.get(inc.clientMsgId) : undefined) ??
      (inc.serial !== undefined ? bySerial.get(inc.serial) : undefined) ??
      (inc.id !== undefined ? byId.get(inc.id) : undefined)

    if (at === undefined) {
      next.push(inc)
      index(inc, next.length - 1)
      continue
    }

    const cur = next[at]
    const merged: ChatItem = {
      ...cur,
      ...inc,
      key: cur.key,
      clientMsgId: cur.clientMsgId ?? inc.clientMsgId,
      serial: inc.serial ?? cur.serial,
      id: inc.id ?? cur.id,
      pending: inc.pending ?? false,
      // An archived row proves it was saved; otherwise keep whatever we knew.
      archiveFailed: inc.id ? false : inc.archiveFailed ?? cur.archiveFailed,
    }
    next[at] = merged
    index(merged, at)
  }

  return next.sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  )
}

const newClientMsgId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function typingLabel(names: string[]) {
  if (names.length === 0) return ''
  if (names.length === 1) return `${names[0]} is typing…`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
  return 'Several people are typing…'
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function ChannelView({ workspaceId, channel, directory }: ChannelViewProps) {
  const { data: session } = useSession()
  const channelId = channel.id
  const myId = session?.user?.id
  const myName = (session?.user as { name?: string | null } | undefined)?.name ?? null
  const myEmail = (session?.user as { email?: string | null } | undefined)?.email ?? ''

  const [items, setItems] = useState<ChatItem[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sendError, setSendError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nearBottomRef = useRef(true)
  const lastKnownRef = useRef<string | null>(null)
  // The message listener must be stable, so it reads the directory through a ref.
  const directoryRef = useRef(directory)
  directoryRef.current = directory

  /* ── History: archive is the source of truth for anything older than this session ── */

  // Fetch everything newer than the last confirmed message (or the newest page if we have
  // none). Used for the initial load, on room attach, and after a discontinuity, so messages
  // published while we were not listening are recovered from the archive. Merging (never
  // replacing) keeps any live messages that arrived first.
  const catchUp = useCallback(async () => {
    let cursor = lastKnownRef.current
    for (let page = 0; page < MAX_CATCH_UP_PAGES; page++) {
      const qs = new URLSearchParams({ channelId, limit: String(PAGE_SIZE) })
      if (cursor) qs.set('after', cursor)
      let rows: MessageRow[]
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/chat/messages?${qs}`)
        if (!res.ok) return
        rows = (await res.json()).messages ?? []
      } catch {
        return
      }
      if (rows.length) setItems((prev) => mergeItems(prev, rows.map((r) => rowToItem(r, directoryRef.current))))
      if (!cursor || rows.length < PAGE_SIZE) return
      cursor = rows[rows.length - 1].createdAt
    }
  }, [workspaceId, channelId])

  useEffect(() => {
    if (!myId) return
    let cancelled = false
    setLoading(true)
    catchUp().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [myId, catchUp])

  // Track the newest confirmed message so catch-up knows where to resume.
  useEffect(() => {
    let latest: string | null = null
    for (const it of items) {
      if (!it.pending && (latest === null || Date.parse(it.createdAt) > Date.parse(latest))) latest = it.createdAt
    }
    lastKnownRef.current = latest
  }, [items])

  /* ── Live: Ably Chat ── */

  const handleMessage = useCallback((event: ChatMessageEvent) => {
    // Edit/delete are not supported yet (the archive would drift), so only handle new messages.
    if (event.type !== ChatMessageEventType.Created) return
    const item = messageToItem(event.message, directoryRef.current)
    setItems((prev) => mergeItems(prev, [item]))
  }, [])

  const handleRoomStatus = useCallback(
    (change: RoomStatusChange) => {
      // Covers the gap between the archive fetch and the room attaching, and any reattach.
      if (change.current === RoomStatus.Attached) void catchUp()
    },
    [catchUp],
  )

  const { sendMessage: publishMessage } = useMessages({
    listener: handleMessage,
    onRoomStatusChange: handleRoomStatus,
    onDiscontinuity: () => void catchUp(),
  })

  const { currentlyTyping, keystroke, stop } = useTyping()
  usePresence({ initialData: { name: myName, email: myEmail } })
  const { presenceData } = usePresenceListener()

  const typingNames = useMemo(
    () =>
      Array.from(currentlyTyping)
        .filter((id) => id !== myId)
        .map((id) => directory[id]?.name ?? directory[id]?.email ?? 'Someone'),
    [currentlyTyping, myId, directory],
  )

  // One entry per user: the same person in two tabs is two presence members.
  const online = useMemo(() => {
    const seen = new Set<string>()
    const out: { id: string; name: string }[] = []
    for (const member of presenceData) {
      if (seen.has(member.clientId)) continue
      seen.add(member.clientId)
      const data = (member.data ?? {}) as Record<string, unknown>
      out.push({
        id: member.clientId,
        name: resolveDisplayName(member.clientId, directory, { name: str(data.name), email: str(data.email) }),
      })
    }
    return out
  }, [presenceData, directory])

  /* ── Scrolling: don't yank someone who is reading history ── */

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  useEffect(() => {
    const last = items[items.length - 1]
    if (nearBottomRef.current || last?.userId === myId) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [items, myId])

  /* ── Sending ── */

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setPendingPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
    e.target.value = ''
  }

  // Delivery to other clients already happened over Ably; this makes it permanent. Retried
  // because a failure here means the message disappears from history on reload.
  const archive = async (sent: Message, payload: { content: string; fileUrl: string | null; fileName: string | null; fileType: string | null }) => {
    for (let attempt = 0; attempt <= ARCHIVE_RETRY_DELAYS_MS.length; attempt++) {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/chat/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            channelId,
            ablySerial: sent.serial,
            createdAt: sent.timestamp.toISOString(),
          }),
        })
        if (res.ok) {
          const { message } = (await res.json()) as { message: MessageRow }
          setItems((prev) => mergeItems(prev, [rowToItem(message, directoryRef.current)]))
          return
        }
        // 4xx (other than rate limiting) will not succeed on retry.
        if (res.status >= 400 && res.status < 500 && res.status !== 429) break
      } catch {
        /* network error: retry */
      }
      if (attempt < ARCHIVE_RETRY_DELAYS_MS.length) await sleep(ARCHIVE_RETRY_DELAYS_MS[attempt])
    }
    setItems((prev) => mergeItems(prev, [{ ...messageToItem(sent, directoryRef.current), archiveFailed: true }]))
  }

  const sendMessage = async () => {
    const trimmed = input.trim()
    if ((!trimmed && !pendingFile) || sending || !myId) return
    setSending(true)
    setSendError(null)

    let fileUrl: string | null = null
    let fileName: string | null = null
    let fileType: string | null = null

    if (pendingFile) {
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('file', pendingFile)
        const uploadRes = await fetch(`/api/workspaces/${workspaceId}/chat/upload`, { method: 'POST', body: fd })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed')
        fileUrl = uploadData.fileUrl
        fileName = uploadData.fileName
        fileType = uploadData.fileType
      } catch (err) {
        setSendError(err instanceof Error ? err.message : 'Could not upload the file')
        setSending(false)
        setUploading(false)
        return
      }
      setUploading(false)
    }

    // Optimistic bubble, keyed by clientMsgId. The Ably echo carries the same id in its
    // headers, so it patches this item in place instead of appending a duplicate.
    const clientMsgId = newClientMsgId()
    const optimistic: ChatItem = {
      key: clientMsgId,
      clientMsgId,
      text: trimmed,
      userId: myId,
      displayName: resolveDisplayName(myId, directory, { name: myName, email: myEmail }),
      fileUrl: safeFileUrl(fileUrl),
      fileName,
      fileType,
      createdAt: new Date().toISOString(),
      pending: true,
    }
    nearBottomRef.current = true
    setItems((prev) => mergeItems(prev, [optimistic]))
    setInput('')
    setPendingFile(null)
    setPendingPreview(null)
    void stop().catch(() => {})
    // Allow the next message while this one is in flight.
    setSending(false)

    try {
      const sent = await publishMessage({
        // Ably may reject empty text, so file-only messages carry the file name (hidden in the UI).
        text: trimmed || fileName || 'Attachment',
        headers: { clientMsgId },
        metadata: { fileUrl, fileName, fileType, fileOnly: !trimmed && !!fileUrl, name: myName, email: myEmail },
      })
      setItems((prev) => mergeItems(prev, [{ ...messageToItem(sent, directoryRef.current), clientMsgId }]))
      void archive(sent, { content: trimmed, fileUrl, fileName, fileType })
    } catch (err) {
      setItems((prev) => prev.filter((it) => it.clientMsgId !== clientMsgId))
      setInput((cur) => cur || trimmed)
      setSendError(err instanceof Error && err.message ? `Message not sent: ${err.message}` : 'Message not sent. Check your connection and try again.')
    }
  }

  const onInputChange = (value: string) => {
    setInput(value)
    if (value) void keystroke().catch(() => {}) // rejects until the room is attached
    else void stop().catch(() => {})
  }

  return (
    <>
      {/* Channel header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-outline-variant/20 bg-surface-container-low shadow-sm flex-shrink-0">
        <div className="w-8 h-8 rounded-xl bg-secondary/10 flex items-center justify-center">
          <Hash className="h-4 w-4 text-secondary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-on-surface">{channel.name}</h2>
          {channel.description && (
            <p className="text-[11px] text-on-surface-variant truncate">{channel.description}</p>
          )}
        </div>
        {online.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0" title={online.map((u) => u.name).join(', ')}>
            <div className="flex -space-x-1.5">
              {online.slice(0, MAX_VISIBLE_PRESENCE).map((u) => (
                <div
                  key={u.id}
                  className="w-6 h-6 rounded-full bg-secondary/20 ring-2 ring-surface-container-low flex items-center justify-center text-[9px] font-bold text-secondary"
                >
                  {getInitials(u.name)}
                </div>
              ))}
            </div>
            <span className="flex items-center gap-1 text-[11px] text-on-surface-variant">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {online.length} online
              {online.length > MAX_VISIBLE_PRESENCE && ` (+${online.length - MAX_VISIBLE_PRESENCE})`}
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-5 py-4 space-y-1 custom-scrollbar">
        {loading && items.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-on-surface-variant">
            <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center">
              <Hash className="h-6 w-6 opacity-30" />
            </div>
            <p className="text-sm font-medium">No messages in #{channel.name}</p>
            <p className="text-xs opacity-60">Be the first to send a message!</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {items.map((msg, i) => {
            const prev = items[i - 1]
            const isOwn = msg.userId === myId
            const sameUser = prev?.userId === msg.userId
            return (
              <motion.div
                key={msg.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: msg.pending ? 0.6 : 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={sameUser ? 'mt-0.5' : 'mt-4'}
              >
                <MessageBubble message={msg} isOwn={isOwn} showAvatar={!sameUser} showName={!sameUser} />
              </motion.div>
            )
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator (height reserved so the composer doesn't jump) */}
      <div className="h-5 px-5 flex-shrink-0 text-[11px] text-on-surface-variant" aria-live="polite">
        {typingLabel(typingNames)}
      </div>

      {/* Pending file preview */}
      <AnimatePresence>
        {pendingFile && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-5 py-2.5 border-t border-outline-variant/20 bg-surface-container-low flex items-center gap-3 flex-shrink-0 overflow-hidden"
          >
            {pendingPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pendingPreview} alt="preview" className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-on-surface-variant text-lg">attach_file</span>
              </div>
            )}
            <span className="text-sm text-on-surface truncate flex-1">{pendingFile.name}</span>
            <button
              onClick={() => { setPendingFile(null); setPendingPreview(null) }}
              className="p-1.5 rounded-lg hover:bg-surface-container-highest text-on-surface-variant transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-5 py-3.5 border-t border-outline-variant/20 bg-surface-container-low flex-shrink-0">
        {sendError && (
          <p role="alert" className="text-xs text-red-500 mb-2">{sendError}</p>
        )}
        <div className="flex items-end gap-2 bg-surface-container rounded-2xl border border-outline-variant/30 px-3 py-2.5 focus-within:border-secondary/50 focus-within:ring-2 focus-within:ring-secondary/10 transition-all duration-200">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading}
            className="p-1.5 rounded-xl text-on-surface-variant hover:text-secondary hover:bg-secondary/10 transition-all flex-shrink-0 mb-0.5 disabled:opacity-40"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input ref={fileInputRef} type="file" className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
            onChange={handleFileChange} />
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() } }}
            placeholder={`Message #${channel.name}…`}
            rows={1}
            maxLength={4000}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-on-surface placeholder:text-on-surface-variant/40 min-h-[22px] max-h-32 leading-relaxed custom-scrollbar"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`
            }}
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={(!input.trim() && !pendingFile) || sending || uploading}
            className="p-1.5 rounded-xl bg-secondary text-on-secondary disabled:opacity-30 hover:opacity-90 active:scale-95 transition-all flex-shrink-0 mb-0.5 shadow-sm shadow-secondary/20"
          >
            {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-[10px] text-on-surface-variant/35 text-center mt-1.5">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </>
  )
}
