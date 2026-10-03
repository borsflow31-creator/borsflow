'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Loader2, X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import { MessageBubble } from './MessageBubble'
import { MessageComposer, type ComposerSendInput } from './MessageComposer'
import { ConfirmDialog } from './ConfirmDialog'
import { chatApi, newClientMsgId, sendWithAttachment } from './chatApi'
import { resolveDisplayName, rowToItem } from './chatFormat'
import { mergeItems } from './ChannelView'
import { useChatSignal } from './useChatSignal'
import type { Channel, ChatItem, ChatPermissions, UserDirectory } from './types'

/**
 * Replies to one message, beside the channel (full screen on phones). Replies
 * aren't published to the room, so this panel follows the workspace signal and
 * refetches when a reply or change for its thread arrives.
 */
export function ThreadPanel({
  workspaceId, channel, parentId, directory, permissions, onClose,
}: {
  workspaceId: string
  channel: Channel
  parentId: string
  directory: UserDirectory
  permissions: ChatPermissions
  onClose: () => void
}) {
  const { t } = useI18n()
  const { data: session } = useSession()
  const myId = session?.user?.id
  const api = useMemo(() => chatApi(workspaceId), [workspaceId])

  const [parent, setParent] = useState<ChatItem | null>(null)
  const [replies, setReplies] = useState<ChatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ChatItem | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const directoryRef = useRef(directory)
  directoryRef.current = directory

  const load = useCallback(async (scroll = false) => {
    try {
      const data = await api.messages(channel.id, { parentId })
      if (data.parent) setParent(rowToItem(data.parent, directoryRef.current))
      setReplies(prev => mergeItems(prev.filter(r => r.pending), data.messages.map(r => rowToItem(r, directoryRef.current))))
      setError(null)
      if (scroll) requestAnimationFrame(() => bottomRef.current?.scrollIntoView())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('chat.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [api, channel.id, parentId, t])

  useEffect(() => {
    setLoading(true)
    setParent(null)
    setReplies([])
    void load(true)
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useChatSignal(workspaceId, (signal) => {
    if (signal.type === 'channels-changed' || signal.channelId !== channel.id) return
    const mine = signal.parentId === parentId || signal.messageId === parentId
    if (mine) void load(signal.type === 'message')
  })

  const send = async ({ content, file }: ComposerSendInput) => {
    if (!myId) return
    const clientMsgId = newClientMsgId()
    setReplies(prev => mergeItems(prev, [{
      key: clientMsgId, clientMsgId, text: content, userId: myId,
      displayName: resolveDisplayName(myId, directory, session?.user ?? undefined),
      fileUrl: null, fileName: file?.name ?? null, fileType: file?.type ?? null,
      createdAt: new Date().toISOString(), pending: true,
    }]))
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))
    try {
      const row = await sendWithAttachment(api, { channelId: channel.id, content, file, parentId, clientMsgId })
      setReplies(prev => mergeItems(prev, [{ ...rowToItem(row, directoryRef.current), clientMsgId }]))
    } catch (err) {
      setReplies(prev => prev.filter(r => r.clientMsgId !== clientMsgId))
      throw err
    }
  }

  const update = (item: ChatItem) => {
    if (item.id === parentId) setParent(item)
    else setReplies(prev => mergeItems(prev, [item]))
  }

  const actionsFor = (item: ChatItem) => ({
    onReact: async (emoji: string) => {
      if (!item.id) return
      try { update(rowToItem((await api.react(item.id, emoji)).message, directoryRef.current)) } catch { void load() }
    },
    onEdit: async (text: string) => {
      if (!item.id) return
      update(rowToItem((await api.edit(item.id, text)).message, directoryRef.current))
    },
    onDelete: () => setConfirmDelete(item),
  })

  return (
    <aside
      aria-label={t('chat.thread')}
      className="fixed inset-0 z-40 flex flex-col bg-background md:static md:inset-auto md:z-auto md:w-[22rem] md:shrink-0 md:border-l md:border-outline-variant/20 lg:w-96"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-outline-variant/20 bg-surface-container-low px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-on-surface">{t('chat.thread')}</h3>
          <p className="truncate text-[11px] text-on-surface-variant">#{channel.name}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {loading && <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-on-surface-variant" />}
        {error && <p className="px-2 py-4 text-center text-xs text-red-500">{error}</p>}
        {parent && (
          <>
            <MessageBubble
              message={parent}
              isOwn={parent.userId === myId}
              showHeader
              directory={directory}
              myId={myId}
              canWrite={permissions.canWrite}
              canModerate={permissions.canModerate}
              actions={actionsFor(parent)}
            />
            <div className="my-3 flex items-center gap-3">
              <span className="text-[11px] font-semibold text-on-surface-variant">
                {t('chat.replyCount', { count: replies.filter(r => !r.pending).length })}
              </span>
              <div className="h-px flex-1 bg-outline-variant/20" />
            </div>
          </>
        )}
        <div className="space-y-2">
          {replies.map((reply, i) => (
            <MessageBubble
              key={reply.key}
              message={reply}
              isOwn={reply.userId === myId}
              showHeader={replies[i - 1]?.userId !== reply.userId}
              directory={directory}
              myId={myId}
              canWrite={permissions.canWrite}
              canModerate={permissions.canModerate}
              actions={actionsFor(reply)}
            />
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-outline-variant/20 bg-surface-container-low px-3 py-3">
        <MessageComposer
          placeholder={t('chat.replyPlaceholder')}
          directory={directory}
          mentionableIds={channel.isPrivate ? channel.memberIds : undefined}
          readOnly={!permissions.canWrite || !!parent?.deletedAt}
          autoFocus
          compact
          onSend={send}
        />
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t('chat.deleteMessageTitle')}
          body={t('chat.deleteMessageBody')}
          confirmLabel={t('chat.deleteMessage')}
          danger
          onConfirm={async () => {
            if (!confirmDelete.id) return
            update(rowToItem((await api.remove(confirmDelete.id)).message, directoryRef.current))
            setConfirmDelete(null)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </aside>
  )
}
