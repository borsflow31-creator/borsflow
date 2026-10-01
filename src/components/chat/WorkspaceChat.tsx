'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AnimatePresence } from 'framer-motion'
import { ChatRoomProvider } from '@ably/chat/react'
import { Loader2, Hash, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { chatRoomName } from '@/lib/chatRooms'
import { ChannelView } from './ChannelView'
import { CreateChannelModal } from './CreateChannelModal'
import type { Channel, UserDirectory } from './types'
import { useI18n } from '@/i18n/I18nProvider'

interface WorkspaceChatProps {
  workspaceId: string
  isOwner: boolean
  directory?: UserDirectory
}

const EMPTY_DIRECTORY: UserDirectory = {}

export function WorkspaceChat({ workspaceId, isOwner, directory = EMPTY_DIRECTORY }: WorkspaceChatProps) {
  const { data: session } = useSession()
  const { t } = useI18n()

  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [channelsOpen, setChannelsOpen] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [channelsLoading, setChannelsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Load channels
  useEffect(() => {
    if (!session?.user?.id) return
    fetch(`/api/workspaces/${workspaceId}/chat/channels`)
      .then((r) => r.json())
      .then((data) => {
        const chs: Channel[] = data.channels ?? []
        setChannels(chs)
        if (chs.length && !activeChannelId) setActiveChannelId(chs[0].id)
      })
      .finally(() => setChannelsLoading(false))
  }, [workspaceId, session]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteChannel = async (channelId: string) => {
    if (!confirm('Delete this channel and all its messages?')) return
    setDeletingId(channelId)
    await fetch(`/api/workspaces/${workspaceId}/chat/channels/${channelId}`, { method: 'DELETE' })
    setChannels((prev) => prev.filter((c) => c.id !== channelId))
    if (activeChannelId === channelId) {
      const remaining = channels.filter((c) => c.id !== channelId)
      setActiveChannelId(remaining[0]?.id ?? null)
    }
    setDeletingId(null)
  }

  const activeChannel = channels.find((c) => c.id === activeChannelId)

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* ── Channel Sidebar ─────────────────────────────── */}
      <div className="w-56 flex-shrink-0 flex flex-col border-r border-outline-variant/20 bg-surface-container-low">
        {/* Sidebar header */}
        <div className="px-4 py-4 border-b border-outline-variant/20">
          <p className="text-xs font-bold text-on-surface uppercase tracking-widest">{t('chat.title')}</p>
        </div>

        {/* Channels list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
          <div className="px-2">
            {/* Section toggle */}
            <button
              onClick={() => setChannelsOpen((v) => !v)}
              className="w-full flex items-center gap-1 px-2 py-1 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors group"
            >
              {channelsOpen
                ? <ChevronDown className="h-3 w-3 flex-shrink-0" />
                : <ChevronRight className="h-3 w-3 flex-shrink-0" />}
              <span className="text-[11px] font-semibold uppercase tracking-wider flex-1 text-left">{t('chat.channels')}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setShowCreateModal(true) }}
                className="p-0.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-surface-container-highest transition-all"
                title={t('chat.addChannel')}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </button>

            {channelsOpen && (
              <div className="mt-1 space-y-0.5">
                {channelsLoading ? (
                  <div className="px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
                  </div>
                ) : channels.length === 0 ? (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container text-xs transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('chat.addAChannel')}
                  </button>
                ) : (
                  channels.map((ch) => (
                    <div
                      key={ch.id}
                      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-xl cursor-pointer transition-colors ${
                        activeChannelId === ch.id
                          ? 'bg-secondary/10 text-secondary font-semibold'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`}
                      onClick={() => setActiveChannelId(ch.id)}
                    >
                      <Hash className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                      <span className="text-sm truncate flex-1">{ch.name}</span>
                      {(isOwner || ch.createdById === session?.user?.id) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteChannel(ch.id) }}
                          disabled={deletingId === ch.id}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-red-500/10 hover:text-red-500 transition-all flex-shrink-0"
                          title={t('chat.deleteChannel')}
                        >
                          {deletingId === ch.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Trash2 className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Add channel footer button */}
        <div className="p-2 border-t border-outline-variant/20 flex-shrink-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-secondary text-xs font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Channel
          </button>
        </div>
      </div>

      {/* ── Main Chat Area ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeChannel ? (
          // One Ably room per channel. The key remounts the room and the view together on switch.
          <ChatRoomProvider key={activeChannel.id} name={chatRoomName(workspaceId, activeChannel.id)}>
            <ChannelView
              workspaceId={workspaceId}
              channel={activeChannel}
              directory={directory}
            />
          </ChatRoomProvider>
        ) : (
          <>
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-outline-variant/20 bg-surface-container-low shadow-sm flex-shrink-0">
              <p className="text-sm text-on-surface-variant">{t('chat.selectChannel')}</p>
            </div>
            {!channelsLoading && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-on-surface-variant">
                <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center">
                  <Hash className="h-8 w-8 opacity-30" />
                </div>
                <p className="text-sm font-medium">{t('chat.noChannels')}</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-4 w-4" />
                  {t('chat.createFirst')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Channel Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateChannelModal
            workspaceId={workspaceId}
            onClose={() => setShowCreateModal(false)}
            onCreated={(ch) => {
              setChannels((prev) => [...prev, ch])
              setActiveChannelId(ch.id)
              setShowCreateModal(false)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
