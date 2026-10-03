'use client'

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowDown, Hash, Loader2, Lock, Menu, Pin, Users, X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import { MessageBubble, MessageText } from './MessageBubble'
import { MessageComposer, type ComposerSendInput } from './MessageComposer'
import { ConfirmDialog } from './ConfirmDialog'
import { chatApi, newClientMsgId, sendWithAttachment } from './chatApi'
import { dayKey, dayLabel, formatTime, getInitials, resolveDisplayName, rowToItem, safeFileUrl } from './chatFormat'
import { useChatSignal } from './useChatSignal'
import { useChannelRoom } from './useChannelRoom'
import type { Channel, ChatItem, ChatPermissions, MessageRow, RoomMessageEvent, UserDirectory } from './types'

const NEAR_BOTTOM_PX = 120
const LOAD_OLDER_AT_PX = 80
const MAX_VISIBLE_PRESENCE = 5
const MARK_READ_DELAY_MS = 800

/* ─── Merging rows, live messages and optimistic bubbles into one list ────── */

/**
 * An incoming item that matches an existing one by clientMsgId or database id
 * REPLACES it in place (keeping its React key so the bubble doesn't
 * remount); otherwise it is added. Result is sorted by time, then id.
 */
export function mergeItems(prev: ChatItem[], incoming: ChatItem[]): ChatItem[] {
  const next = prev.slice()
  const find = (inc: ChatItem) =>
    next.findIndex(
      cur =>
        (inc.clientMsgId && cur.clientMsgId === inc.clientMsgId) ||
        (inc.id && cur.id === inc.id),
    )
  for (const inc of incoming) {
    const at = find(inc)
    if (at === -1) {
      next.push(inc)
      continue
    }
    const cur = next[at]
    next[at] = {
      ...cur,
      ...inc,
      key: cur.key,
      clientMsgId: cur.clientMsgId ?? inc.clientMsgId,
      id: inc.id ?? cur.id,
      pending: inc.pending ?? false,
      // A live echo can't know reactions/replies; keep what the API told us.
      reactions: inc.reactions ?? cur.reactions,
      replyCount: inc.replyCount ?? cur.replyCount,
      pinnedAt: inc.pinnedAt !== undefined ? inc.pinnedAt : cur.pinnedAt,
    }
  }
  return next.sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || ((a.id ?? a.key) < (b.id ?? b.key) ? -1 : 1),
  )
}

const cursorOf = (item: ChatItem) => `${item.createdAt}|${item.id}`

/* ─── Component ─────────────────────────────────────────────────────────── */

export function ChannelView({
  workspaceId,
  channel,
  directory,
  permissions,
  focusMessageId,
  activeThreadId,
  onOpenThread,
  onMarkedRead,
  onOpenSidebar,
  onManageMembers,
}: {
  workspaceId: string
  channel: Channel
  directory: UserDirectory
  permissions: ChatPermissions
  /** Jump to this message (search result / link) */
  focusMessageId?: string | null
  activeThreadId?: string | null
  onOpenThread: (parentId: string) => void
  onMarkedRead: (channelId: string) => void
  /** Mobile: open the channel list */
  onOpenSidebar: () => void
  onManageMembers?: () => void
}) {
  const { t } = useI18n()
  const { data: session } = useSession()
  const myId = session?.user?.id
  const channelId = channel.id
  const api = useMemo(() => chatApi(workspaceId), [workspaceId])

  const [items, setItems] = useState<ChatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hasOlder, setHasOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  // Set after jumping to an old message: newer messages exist below and live
  // messages must not be appended until the user returns to the latest.
  const [detached, setDetached] = useState(false)
  const [showJump, setShowJump] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [pinnedOpen, setPinnedOpen] = useState(false)
  const [pinned, setPinned] = useState<MessageRow[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ChatItem | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const detachedRef = useRef(false)
  detachedRef.current = detached
  const itemsRef = useRef<ChatItem[]>([])
  itemsRef.current = items
  const directoryRef = useRef(directory)
  directoryRef.current = directory
  // Scroll-back keeps the reader's place: remember the height before prepending
  const prependAnchor = useRef<{ height: number; top: number } | null>(null)
  const scrollToBottomNext = useRef<'instant' | 'smooth' | null>(null)

  const toItems = useCallback((rows: MessageRow[]) => rows.map(r => rowToItem(r, directoryRef.current)), [])

  /* ── Read markers ── */

  const markReadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const markRead = useCallback(() => {
    if (markReadTimer.current) clearTimeout(markReadTimer.current)
    markReadTimer.current = setTimeout(() => {
      if (document.visibilityState !== 'visible') return
      api.markRead(channelId).then(() => onMarkedRead(channelId)).catch(() => {})
    }, MARK_READ_DELAY_MS)
  }, [api, channelId, onMarkedRead])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && nearBottomRef.current) markRead() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      if (markReadTimer.current) clearTimeout(markReadTimer.current)
    }
  }, [markRead])

  /* ── Loading ── */

  const loadLatest = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await api.messages(channelId)
      setItems(toItems(data.messages))
      setHasOlder(!!data.hasMore)
      setDetached(false)
      scrollToBottomNext.current = 'instant'
      markRead()
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('chat.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [api, channelId, toItems, markRead, t])

  const loadAround = useCallback(async (messageId: string) => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await api.messages(channelId, { around: messageId })
      setItems(toItems(data.messages))
      setHasOlder(!!data.hasMore)
      setDetached(!!data.hasNewer)
      setHighlightId(messageId)
      requestAnimationFrame(() => {
        document.getElementById(`msg-${messageId}`)?.scrollIntoView({ block: 'center' })
      })
      setTimeout(() => setHighlightId(cur => (cur === messageId ? null : cur)), 3000)
    } catch {
      // The message may have been deleted: fall back to the latest messages
      await loadLatest()
    } finally {
      setLoading(false)
    }
  }, [api, channelId, toItems, loadLatest])

  // Everything newer than the newest saved message we have. Runs on room
  // (re)attach and discontinuities, so messages missed while offline appear.
  const catchingUp = useRef(false)
  const catchUp = useCallback(async () => {
    if (detachedRef.current || catchingUp.current) return
    catchingUp.current = true
    try {
      for (;;) {
        const saved = itemsRef.current.filter(i => i.id && !i.pending)
        const last = saved[saved.length - 1]
        if (!last) return
        const data = await api.messages(channelId, { after: cursorOf(last) })
        if (data.messages.length) setItems(prev => mergeItems(prev, toItems(data.messages)))
        if (!data.hasMore) return
        // Let the state update land before computing the next cursor
        await new Promise(r => setTimeout(r, 0))
        itemsRef.current = mergeItems(itemsRef.current, toItems(data.messages))
      }
    } catch {
      /* next attach/discontinuity retries */
    } finally {
      catchingUp.current = false
    }
  }, [api, channelId, toItems])

  useEffect(() => {
    if (!myId) return
    setItems([])
    setPinned(null)
    setPinnedOpen(false)
    if (focusMessageId) void loadAround(focusMessageId)
    else void loadLatest()
    // Only on channel switch / explicit focus changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, channelId, focusMessageId])

  const loadOlder = useCallback(async () => {
    const first = itemsRef.current.find(i => i.id)
    if (!first || loadingOlder || !hasOlder) return
    setLoadingOlder(true)
    try {
      const data = await api.messages(channelId, { before: cursorOf(first) })
      const el = scrollRef.current
      if (el) prependAnchor.current = { height: el.scrollHeight, top: el.scrollTop }
      setItems(prev => mergeItems(prev, toItems(data.messages)))
      setHasOlder(!!data.hasMore)
    } catch {
      /* the user can scroll up again to retry */
    } finally {
      setLoadingOlder(false)
    }
  }, [api, channelId, hasOlder, loadingOlder, toItems])

  /* ── Scrolling ── */

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (prependAnchor.current) {
      const { height, top } = prependAnchor.current
      el.scrollTop = el.scrollHeight - height + top
      prependAnchor.current = null
      return
    }
    if (scrollToBottomNext.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: scrollToBottomNext.current === 'smooth' ? 'smooth' : 'auto' })
      scrollToBottomNext.current = null
    }
  }, [items])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
    nearBottomRef.current = near
    if (near) {
      setShowJump(false)
      if (!detached) markRead()
    }
    if (el.scrollTop < LOAD_OLDER_AT_PX) void loadOlder()
  }

  const jumpToLatest = () => {
    if (detached) void loadLatest()
    else scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    setShowJump(false)
  }

  /** New messages arrived: follow them if the reader is at the bottom, otherwise offer a jump. */
  const onNewArrivals = useCallback((fromMe: boolean) => {
    if (fromMe || nearBottomRef.current) {
      scrollToBottomNext.current = 'smooth'
      if (!fromMe) markRead()
    } else {
      setShowJump(true)
    }
  }, [markRead])

  /* ── Live: the channel's Realtime topic ── */

  const handleMessage = useCallback((event: RoomMessageEvent) => {
    if (detachedRef.current) return
    const item = { ...rowToItem(event.message, directoryRef.current), clientMsgId: event.clientMsgId }
    if (event.kind === 'created') {
      const known = itemsRef.current.some(i => (item.clientMsgId && i.clientMsgId === item.clientMsgId) || i.id === item.id)
      setItems(prev => mergeItems(prev, [item]))
      if (!known) onNewArrivals(item.userId === myId)
    } else if (itemsRef.current.some(i => i.id === item.id)) {
      // Edits and deletes carry the full saved message, so they replace in place.
      setItems(prev => mergeItems(prev, [item]))
    }
  }, [myId, onNewArrivals])

  const { onlineUserIds, typingUserIds, keystroke, stopTyping } = useChannelRoom(workspaceId, channelId, myId, {
    onMessage: handleMessage,
    onSubscribed: () => void catchUp(),
  })

  const typingNames = useMemo(
    () => typingUserIds.filter(id => id !== myId).map(id => directory[id]?.name ?? directory[id]?.email ?? t('chat.someone')),
    [typingUserIds, myId, directory, t],
  )
  const typingText =
    typingNames.length === 0 ? ''
      : typingNames.length === 1 ? t('chat.typingOne', { name: typingNames[0] })
        : typingNames.length === 2 ? t('chat.typingTwo', { first: typingNames[0], second: typingNames[1] })
          : t('chat.typingMany')

  // Presence is keyed by user id (two tabs = one entry); names from the trusted directory.
  const online = useMemo(
    () => onlineUserIds.map(id => ({ id, name: resolveDisplayName(id, directory) })),
    [onlineUserIds, directory],
  )

  /* ── Workspace signals: reactions, pins, edits, thread replies, missed messages ── */

  const refreshMessages = useCallback(async (ids: string[]) => {
    const data = await api.messages(channelId, { ids: ids.join(',') }).catch(() => null)
    if (data?.messages.length) setItems(prev => mergeItems(prev, toItems(data.messages)))
  }, [api, channelId, toItems])

  useChatSignal(workspaceId, (signal) => {
    if (signal.type === 'channels-changed' || signal.channelId !== channelId) return
    if (signal.type === 'message') {
      if (signal.parentId) {
        if (itemsRef.current.some(i => i.id === signal.parentId)) void refreshMessages([signal.parentId])
      } else if (!itemsRef.current.some(i => i.id === signal.messageId)) {
        // Normally the room delivers it; this covers a failed realtime publish.
        setTimeout(() => {
          if (!itemsRef.current.some(i => i.id === signal.messageId)) void catchUp()
        }, 1500)
      }
    } else if (signal.type === 'message-changed') {
      const target = signal.parentId ?? signal.messageId
      if (itemsRef.current.some(i => i.id === target)) void refreshMessages([target])
      if (pinnedOpen) void loadPinned()
    }
  })

  /* ── Pinned ── */

  const loadPinned = useCallback(async () => {
    const data = await api.messages(channelId, { pinned: '1' }).catch(() => null)
    setPinned(data?.messages ?? [])
  }, [api, channelId])

  /* ── Actions ── */

  const fail = (err: unknown) => {
    setActionError(err instanceof Error ? err.message : t('chat.genericError'))
    setTimeout(() => setActionError(null), 5000)
  }

  const send = async ({ content, file }: ComposerSendInput) => {
    if (!myId) return
    const clientMsgId = newClientMsgId()
    if (detached) await loadLatest()
    const optimistic: ChatItem = {
      key: clientMsgId,
      clientMsgId,
      text: content,
      userId: myId,
      displayName: resolveDisplayName(myId, directory, session?.user ?? undefined),
      fileUrl: null,
      fileName: file?.name ?? null,
      fileType: file?.type ?? null,
      createdAt: new Date().toISOString(),
      pending: true,
    }
    scrollToBottomNext.current = 'smooth'
    setItems(prev => mergeItems(prev, [optimistic]))
    stopTyping()
    try {
      const row = await sendWithAttachment(api, { channelId, content, file, clientMsgId })
      setItems(prev => mergeItems(prev, [{ ...rowToItem(row, directoryRef.current), clientMsgId }]))
    } catch (err) {
      setItems(prev => prev.filter(i => i.clientMsgId !== clientMsgId))
      throw err
    }
  }

  const react = async (item: ChatItem, emoji: string) => {
    if (!item.id || !myId) return
    // Optimistic toggle
    setItems(prev => prev.map(i => {
      if (i.id !== item.id) return i
      const users = i.reactions?.[emoji] ?? []
      const nextUsers = users.includes(myId) ? users.filter(u => u !== myId) : [...users, myId]
      return { ...i, reactions: { ...i.reactions, [emoji]: nextUsers } }
    }))
    try {
      const { message } = await api.react(item.id, emoji)
      setItems(prev => mergeItems(prev, [rowToItem(message, directoryRef.current)]))
    } catch (err) {
      void refreshMessages([item.id])
      fail(err)
    }
  }

  const edit = async (item: ChatItem, text: string) => {
    if (!item.id) return
    const { message } = await api.edit(item.id, text)
    setItems(prev => mergeItems(prev, [rowToItem(message, directoryRef.current)]))
  }

  const pin = async (item: ChatItem, value: boolean) => {
    if (!item.id) return
    try {
      const { message } = await api.pin(item.id, value)
      setItems(prev => mergeItems(prev, [rowToItem(message, directoryRef.current)]))
      if (pinnedOpen) void loadPinned()
    } catch (err) {
      fail(err)
    }
  }

  const removeConfirmed = async () => {
    const item = confirmDelete
    if (!item?.id) return
    const { message } = await api.remove(item.id)
    setItems(prev => mergeItems(prev, [rowToItem(message, directoryRef.current)]))
    setConfirmDelete(null)
  }

  const onTyping = (hasText: boolean) => {
    if (!permissions.canWrite) return
    if (hasText) keystroke()
    else stopTyping()
  }

  /* ── Render ── */

  const labels = { today: t('chat.today'), yesterday: t('chat.yesterday') }
  const mentionable = channel.isPrivate ? channel.memberIds : undefined

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-outline-variant/20 bg-surface-container-low px-3 py-3 shadow-sm sm:gap-3 sm:px-5">
        <button type="button" onClick={onOpenSidebar} aria-label={t('chat.showChannels')} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high md:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden h-8 w-8 items-center justify-center rounded-xl bg-secondary/10 sm:flex">
          {channel.isPrivate ? <Lock className="h-4 w-4 text-secondary" /> : <Hash className="h-4 w-4 text-secondary" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1 truncate text-sm font-semibold text-on-surface">
            <span className="sm:hidden">{channel.isPrivate ? <Lock className="inline h-3.5 w-3.5" /> : '#'}</span>
            {channel.name}
          </h2>
          {channel.description && <p className="truncate text-[11px] text-on-surface-variant">{channel.description}</p>}
        </div>

        {online.length > 0 && (
          <div className="hidden shrink-0 items-center gap-2 sm:flex" title={online.map(u => u.name).join(', ')}>
            <div className="flex -space-x-1.5">
              {online.slice(0, MAX_VISIBLE_PRESENCE).map(u => (
                <div key={u.id} className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/20 text-[9px] font-bold text-secondary ring-2 ring-surface-container-low">
                  {getInitials(u.name)}
                </div>
              ))}
            </div>
            <span className="flex items-center gap-1 text-[11px] text-on-surface-variant">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {t('chat.onlineCount', { count: online.length })}
            </span>
          </div>
        )}

        {channel.isPrivate && onManageMembers && (
          <button type="button" onClick={onManageMembers} aria-label={t('chat.members')} title={t('chat.members')} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-on-surface-variant hover:bg-surface-container-high">
            <Users className="h-4 w-4" />
            <span className="tabular-nums">{channel.memberIds.length}</span>
          </button>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => { setPinnedOpen(v => !v); if (!pinnedOpen) void loadPinned() }}
            aria-label={t('chat.pinnedMessages')}
            title={t('chat.pinnedMessages')}
            aria-expanded={pinnedOpen}
            className={`rounded-lg p-1.5 hover:bg-surface-container-high ${pinnedOpen ? 'text-secondary' : 'text-on-surface-variant'}`}
          >
            <Pin className="h-4 w-4" />
          </button>
          {pinnedOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-2xl">
              <div className="flex items-center justify-between border-b border-outline-variant/20 px-4 py-2.5">
                <span className="text-sm font-semibold text-on-surface">{t('chat.pinnedMessages')}</span>
                <button type="button" onClick={() => setPinnedOpen(false)} aria-label={t('common.close')} className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {pinned === null ? (
                  <Loader2 className="mx-auto my-4 h-5 w-5 animate-spin text-on-surface-variant" />
                ) : pinned.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-on-surface-variant">{t('chat.noPinned')}</p>
                ) : (
                  pinned.map(row => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => { setPinnedOpen(false); void loadAround(row.id) }}
                      className="block w-full rounded-xl px-3 py-2 text-left hover:bg-surface-container-high"
                    >
                      <span className="text-[11px] font-semibold text-on-surface-variant">
                        {resolveDisplayName(row.userId, directory, row.user)} · {formatTime(row.createdAt)}
                      </span>
                      <div className="line-clamp-3 text-sm text-on-surface">
                        {row.content ? <MessageText text={row.content} directory={directory} myId={myId} isOwn={false} /> : row.fileName}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {actionError && (
        <div role="alert" className="shrink-0 border-b border-red-500/20 bg-red-500/10 px-5 py-2 text-xs text-red-600 dark:text-red-400">{actionError}</div>
      )}

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={handleScroll} className="custom-scrollbar h-full overflow-y-auto px-3 py-4 sm:px-5">
          {loadingOlder && <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-on-surface-variant" />}
          {!loading && !hasOlder && items.length > 0 && (
            <div className="mb-6 px-1 text-xs text-on-surface-variant">
              <p className="text-sm font-semibold text-on-surface">{t('chat.channelStart', { name: channel.name })}</p>
              {channel.description && <p className="mt-0.5">{channel.description}</p>}
            </div>
          )}
          {loading && items.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
            </div>
          )}
          {loadError && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-on-surface-variant">
              <p>{loadError}</p>
              <button type="button" onClick={() => void loadLatest()} className="rounded-xl border border-outline-variant/30 px-4 py-2 text-xs font-medium hover:bg-surface-container">
                {t('chat.retry')}
              </button>
            </div>
          )}
          {!loading && !loadError && items.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-on-surface-variant">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-high">
                <Hash className="h-6 w-6 opacity-30" />
              </div>
              <p className="text-sm font-medium">{t('chat.emptyChannel', { name: channel.name })}</p>
              {permissions.canWrite && <p className="text-xs opacity-60">{t('chat.beFirst')}</p>}
            </div>
          )}

          {items.map((msg, i) => {
            const prev = items[i - 1]
            const newDay = !prev || dayKey(prev.createdAt) !== dayKey(msg.createdAt)
            // Same author within 5 minutes reads as one group
            const grouped = !newDay && prev?.userId === msg.userId && !prev.deletedAt &&
              Date.parse(msg.createdAt) - Date.parse(prev.createdAt) < 5 * 60 * 1000
            return (
              <Fragment key={msg.key}>
                {newDay && (
                  <div className="my-4 flex items-center gap-3" role="separator">
                    <div className="h-px flex-1 bg-outline-variant/20" />
                    <span className="text-[11px] font-semibold text-on-surface-variant">{dayLabel(msg.createdAt, labels)}</span>
                    <div className="h-px flex-1 bg-outline-variant/20" />
                  </div>
                )}
                <div id={msg.id ? `msg-${msg.id}` : undefined} className={grouped ? 'mt-0.5' : 'mt-3'}>
                  <MessageBubble
                    message={msg}
                    isOwn={msg.userId === myId}
                    showHeader={!grouped}
                    directory={directory}
                    myId={myId}
                    canWrite={permissions.canWrite}
                    canModerate={permissions.canModerate}
                    highlighted={highlightId === msg.id || (!!activeThreadId && activeThreadId === msg.id)}
                    actions={{
                      onReact: (emoji) => void react(msg, emoji),
                      onReply: msg.id ? () => onOpenThread(msg.id!) : undefined,
                      onEdit: (text) => edit(msg, text),
                      onDelete: () => setConfirmDelete(msg),
                      onPin: (value) => void pin(msg, value),
                    }}
                  />
                </div>
              </Fragment>
            )
          })}
        </div>

        {(showJump || detached) && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-on-secondary shadow-lg hover:opacity-90"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            {detached ? t('chat.jumpToLatest') : t('chat.newMessages')}
          </button>
        )}
      </div>

      {/* Typing indicator (height reserved so the composer doesn't jump) */}
      <div className="h-5 shrink-0 truncate px-5 text-[11px] text-on-surface-variant" aria-live="polite">
        {typingText}
      </div>

      <div className="shrink-0 border-t border-outline-variant/20 bg-surface-container-low px-3 py-3 sm:px-5">
        <MessageComposer
          placeholder={t('chat.messagePlaceholder', { name: channel.name })}
          directory={directory}
          mentionableIds={mentionable}
          readOnly={!permissions.canWrite}
          onSend={send}
          onTyping={onTyping}
        />
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t('chat.deleteMessageTitle')}
          body={t('chat.deleteMessageBody')}
          confirmLabel={t('chat.deleteMessage')}
          danger
          onConfirm={removeConfirmed}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
