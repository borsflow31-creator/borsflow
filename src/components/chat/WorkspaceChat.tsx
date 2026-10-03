'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useAbly } from 'ably/react'
import { ChatRoomProvider } from '@ably/chat/react'
import { Loader2, Hash, Lock, Plus, Trash2, ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { chatRoomName } from '@/lib/chatRooms'
import { useI18n } from '@/i18n/I18nProvider'
import { ChannelView } from './ChannelView'
import { ThreadPanel } from './ThreadPanel'
import { CreateChannelModal, ChannelMembersModal } from './CreateChannelModal'
import { ConfirmDialog } from './ConfirmDialog'
import { chatApi } from './chatApi'
import { formatTime, resolveDisplayName } from './chatFormat'
import { MessageText } from './MessageBubble'
import { useChatSignal } from './useChatSignal'
import type { Channel, ChatPermissions, MessageRow, UserDirectory } from './types'

interface WorkspaceChatProps {
  workspaceId: string
  directory?: UserDirectory
}

const EMPTY_DIRECTORY: UserDirectory = {}
type SearchHit = MessageRow & { channel: { id: string; name: string } }

export function WorkspaceChat({ workspaceId, directory = EMPTY_DIRECTORY }: WorkspaceChatProps) {
  const { data: session } = useSession()
  const myId = session?.user?.id
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const ably = useAbly()
  const api = useMemo(() => chatApi(workspaceId), [workspaceId])

  const [channels, setChannels] = useState<Channel[]>([])
  const [permissions, setPermissions] = useState<ChatPermissions>({ canWrite: false, canModerate: false })
  const [channelsLoading, setChannelsLoading] = useState(true)
  const [channelsError, setChannelsError] = useState<string | null>(null)
  const [channelsOpen, setChannelsOpen] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false) // mobile slide-over
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [membersFor, setMembersFor] = useState<Channel | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Channel | null>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  // URL is the source of truth for what's open, so reloads and shared links land on it
  const activeChannelId = searchParams.get('channel')
  const threadId = searchParams.get('thread')
  const focusMessageId = searchParams.get('message')

  const setUrl = useCallback((next: { channel?: string | null; thread?: string | null; message?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v)
      else params.delete(k)
    }
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  /* ── Channels ── */

  const loadChannels = useCallback(async () => {
    try {
      const data = await api.channels()
      setChannels(data.channels)
      setPermissions({ canWrite: data.canWrite, canModerate: data.canModerate })
      setChannelsError(null)
      return data.channels
    } catch (err) {
      setChannelsError(err instanceof Error ? err.message : t('chat.loadFailed'))
      return null
    } finally {
      setChannelsLoading(false)
    }
  }, [api, t])

  useEffect(() => {
    if (!myId) return
    void loadChannels()
  }, [myId, loadChannels])

  // Pick a channel when none (or a vanished one) is selected
  useEffect(() => {
    if (channelsLoading || channels.length === 0) return
    if (!activeChannelId || !channels.some(c => c.id === activeChannelId)) {
      setUrl({ channel: channels[0].id, thread: null, message: null })
    }
  }, [channelsLoading, channels, activeChannelId, setUrl])

  const activeChannel = channels.find(c => c.id === activeChannelId)

  const selectChannel = (id: string, opts: { message?: string } = {}) => {
    setUrl({ channel: id, thread: null, message: opts.message ?? null })
    setSidebarOpen(false)
    setChannels(prev => prev.map(c => (c.id === id && !opts.message ? { ...c, unreadCount: 0 } : c)))
  }

  const onMarkedRead = useCallback((channelId: string) => {
    setChannels(prev => prev.map(c => (c.id === channelId ? { ...c, unreadCount: 0 } : c)))
  }, [])

  // Realtime: new messages elsewhere bump unread; channel changes refresh the list
  // and the Ably token (so a new/joined private channel's room becomes reachable).
  const activeRef = useRef(activeChannelId)
  activeRef.current = activeChannelId
  useChatSignal(workspaceId, (signal) => {
    if (signal.type === 'channels-changed') {
      void loadChannels().then(() => ably.auth.authorize().catch(() => {}))
      return
    }
    if (signal.type === 'message' && !signal.parentId && signal.userId !== myId && signal.channelId !== activeRef.current) {
      setChannels(prev => prev.map(c => (c.id === signal.channelId ? { ...c, unreadCount: c.unreadCount + 1 } : c)))
    }
  })

  const totalUnread = channels.reduce((n, c) => n + (c.id === activeChannelId ? 0 : c.unreadCount), 0)
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\) /, '')
    document.title = totalUnread > 0 ? `(${totalUnread > 99 ? '99+' : totalUnread}) ${base}` : base
  }, [totalUnread])

  const deleteChannel = async () => {
    const channel = confirmDelete
    if (!channel) return
    await api.deleteChannel(channel.id) // throws -> dialog shows the error, list unchanged
    setConfirmDelete(null)
    const remaining = channels.filter(c => c.id !== channel.id)
    setChannels(remaining)
    if (activeChannelId === channel.id) setUrl({ channel: remaining[0]?.id ?? null, thread: null, message: null })
  }

  /* ── Search ── */

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const q = query.trim()
    if (q.length < 2) { setResults(null); setNextCursor(null); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await api.search(q)
        setResults(data.results)
        setNextCursor(data.nextCursor)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [query, api])

  const loadMoreResults = async () => {
    if (!nextCursor) return
    const data = await api.search(query.trim(), nextCursor).catch(() => null)
    if (data) {
      setResults(prev => [...(prev ?? []), ...data.results])
      setNextCursor(data.nextCursor)
    }
  }

  const openResult = (hit: SearchHit) => {
    if (hit.parentId) {
      setUrl({ channel: hit.channel.id, thread: hit.parentId, message: hit.parentId })
    } else {
      selectChannel(hit.channel.id, { message: hit.id })
    }
    setSidebarOpen(false)
  }

  /* ── Render ── */

  const canManageChannel = (c: Channel) => permissions.canModerate || c.createdById === myId

  const sidebar = (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-outline-variant/20 bg-surface-container-low md:w-60">
      <div className="flex items-center justify-between border-b border-outline-variant/20 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface">{t('chat.title')}</p>
        <button type="button" onClick={() => setSidebarOpen(false)} aria-label={t('common.close')} className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high md:hidden">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container px-2.5 py-1.5 focus-within:border-secondary/50">
          <Search className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('chat.searchPlaceholder')}
            aria-label={t('chat.searchPlaceholder')}
            className="min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant/50"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={t('chat.clearSearch')} className="text-on-surface-variant hover:text-on-surface">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto py-2">
        {results !== null ? (
          <div className="px-2">
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
              {searching ? t('chat.searching') : t('chat.resultsCount', { count: results.length })}
            </p>
            {results.map(hit => (
              <button key={hit.id} type="button" onClick={() => openResult(hit)} className="block w-full rounded-xl px-2.5 py-2 text-left hover:bg-surface-container">
                <span className="flex items-center gap-1 text-[11px] text-on-surface-variant">
                  <Hash className="h-3 w-3" />{hit.channel.name} · {resolveDisplayName(hit.userId, directory, hit.user)} · {formatTime(hit.createdAt)}
                </span>
                <div className="line-clamp-2 text-sm text-on-surface">
                  <MessageText text={hit.content} directory={directory} myId={myId} isOwn={false} />
                </div>
              </button>
            ))}
            {!searching && results.length === 0 && <p className="px-2 py-3 text-xs text-on-surface-variant">{t('chat.noResults')}</p>}
            {nextCursor && (
              <button type="button" onClick={() => void loadMoreResults()} className="mt-1 w-full rounded-lg py-1.5 text-xs font-medium text-secondary hover:bg-surface-container">
                {t('chat.moreResults')}
              </button>
            )}
          </div>
        ) : (
          <div className="px-2">
            <div className="flex items-center gap-1 px-2 py-1">
              <button
                type="button"
                onClick={() => setChannelsOpen(v => !v)}
                aria-expanded={channelsOpen}
                className="flex flex-1 items-center gap-1 text-on-surface-variant hover:text-on-surface"
              >
                {channelsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span className="text-[11px] font-semibold uppercase tracking-wider">{t('chat.channels')}</span>
              </button>
              {permissions.canWrite && (
                <button type="button" onClick={() => setShowCreateModal(true)} aria-label={t('chat.addChannel')} title={t('chat.addChannel')} className="rounded-md p-0.5 text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {channelsOpen && (
              <div className="mt-1 space-y-0.5">
                {channelsLoading ? (
                  <Loader2 className="mx-3 my-2 h-4 w-4 animate-spin text-on-surface-variant" />
                ) : channelsError ? (
                  <div className="px-3 py-2 text-xs text-red-500">
                    {channelsError}{' '}
                    <button type="button" onClick={() => void loadChannels()} className="font-semibold underline">{t('chat.retry')}</button>
                  </div>
                ) : channels.length === 0 ? (
                  permissions.canWrite && (
                    <button type="button" onClick={() => setShowCreateModal(true)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container">
                      <Plus className="h-3.5 w-3.5" />
                      {t('chat.addAChannel')}
                    </button>
                  )
                ) : (
                  channels.map(ch => {
                    const active = activeChannelId === ch.id
                    const unread = active ? 0 : ch.unreadCount
                    return (
                      <div key={ch.id} className={`group flex items-center rounded-xl transition-colors ${active ? 'bg-secondary/10 text-secondary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}>
                        <button
                          type="button"
                          onClick={() => selectChannel(ch.id)}
                          aria-current={active ? 'page' : undefined}
                          className={`flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-sm ${active || unread ? 'font-semibold' : ''} ${unread && !active ? 'text-on-surface' : ''}`}
                        >
                          {ch.isPrivate ? <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" /> : <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                          <span className="flex-1 truncate">{ch.name}</span>
                          {unread > 0 && (
                            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold leading-none text-on-secondary" aria-label={t('chat.unreadCount', { count: unread })}>
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </button>
                        {canManageChannel(ch) && permissions.canWrite && (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(ch)}
                            aria-label={t('chat.deleteChannelNamed', { name: ch.name })}
                            title={t('chat.deleteChannel')}
                            className="mr-1 shrink-0 rounded-md p-1 opacity-100 transition-all hover:bg-red-500/10 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {permissions.canWrite && (
        <div className="shrink-0 border-t border-outline-variant/20 p-2">
          <button type="button" onClick={() => setShowCreateModal(true)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-secondary">
            <Plus className="h-3.5 w-3.5" />
            {t('chat.newChannel')}
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Channel list: fixed column on desktop, slide-over on phones */}
      <div className="hidden md:flex">{sidebar}</div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="flex">{sidebar}</div>
          <button type="button" aria-label={t('common.close')} onClick={() => setSidebarOpen(false)} className="flex-1 bg-black/40" />
        </div>
      )}

      <div className="flex min-w-0 flex-1">
        {activeChannel ? (
          // One Ably room per channel; the key remounts room and view together on switch.
          <ChatRoomProvider key={activeChannel.id} name={chatRoomName(workspaceId, activeChannel.id)}>
            <ChannelView
              workspaceId={workspaceId}
              channel={activeChannel}
              directory={directory}
              permissions={permissions}
              focusMessageId={focusMessageId}
              activeThreadId={threadId}
              onOpenThread={(parentId) => setUrl({ thread: parentId })}
              onMarkedRead={onMarkedRead}
              onOpenSidebar={() => setSidebarOpen(true)}
              onManageMembers={activeChannel.isPrivate ? () => setMembersFor(activeChannel) : undefined}
            />
            {threadId && (
              <ThreadPanel
                key={threadId}
                workspaceId={workspaceId}
                channel={activeChannel}
                parentId={threadId}
                directory={directory}
                permissions={permissions}
                onClose={() => setUrl({ thread: null })}
              />
            )}
          </ChatRoomProvider>
        ) : (
          <div className="flex flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-3 border-b border-outline-variant/20 bg-surface-container-low px-3 py-3 shadow-sm sm:px-5">
              <button type="button" onClick={() => setSidebarOpen(true)} aria-label={t('chat.showChannels')} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high md:hidden">
                <Hash className="h-5 w-5" />
              </button>
              <p className="text-sm text-on-surface-variant">{t('chat.selectChannel')}</p>
            </div>
            {!channelsLoading && channels.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center text-on-surface-variant">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container-high">
                  <Hash className="h-8 w-8 opacity-30" />
                </div>
                <p className="text-sm font-medium">{t('chat.noChannels')}</p>
                {permissions.canWrite && (
                  <button type="button" onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-on-secondary transition-opacity hover:opacity-90">
                    <Plus className="h-4 w-4" />
                    {t('chat.createFirst')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateChannelModal
          workspaceId={workspaceId}
          directory={directory}
          myId={myId}
          onClose={() => setShowCreateModal(false)}
          onCreated={(ch) => {
            setChannels(prev => (prev.some(c => c.id === ch.id) ? prev : [...prev, ch]))
            setShowCreateModal(false)
            // The new room must be in our Ably token before we can attach to it
            void ably.auth.authorize().catch(() => {}).finally(() => selectChannel(ch.id))
          }}
        />
      )}

      {membersFor && (
        <ChannelMembersModal
          workspaceId={workspaceId}
          channel={membersFor}
          directory={directory}
          canManage={canManageChannel(membersFor) && permissions.canWrite}
          onClose={() => setMembersFor(null)}
          onSaved={(memberIds) => {
            setChannels(prev => prev.map(c => (c.id === membersFor.id ? { ...c, memberIds } : c)))
            setMembersFor(null)
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={t('chat.deleteChannelTitle', { name: confirmDelete.name })}
          body={t('chat.deleteChannelBody')}
          confirmLabel={t('chat.deleteChannel')}
          danger
          onConfirm={deleteChannel}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
