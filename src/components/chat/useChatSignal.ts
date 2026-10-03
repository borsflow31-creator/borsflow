'use client'

import { useEffect, useRef } from 'react'
import { useAbly } from 'ably/react'
import type * as Ably from 'ably'
import { chatSignalChannel } from '@/lib/chatRooms'

export type ChatSignal =
  | { type: 'message'; channelId: string; messageId: string; userId: string; parentId: string | null }
  | { type: 'message-changed'; channelId: string; messageId: string; parentId: string | null }
  | { type: 'channels-changed' }

/**
 * Subscribes to the workspace's server-only signal channel (unread bumps,
 * reactions, pins, thread replies, channel list changes). Signals carry ids
 * only; handlers refetch from the API, so a forged signal can't inject content.
 */
export function useChatSignal(workspaceId: string, handler: (signal: ChatSignal) => void) {
  const ably = useAbly()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const channel = ably.channels.get(chatSignalChannel(workspaceId))
    const listener = (msg: Ably.InboundMessage) => {
      const data = msg.data as ChatSignal | undefined
      if (data && typeof data === 'object' && typeof data.type === 'string') handlerRef.current(data)
    }
    void channel.subscribe(listener).catch(() => {})
    return () => {
      channel.unsubscribe(listener)
    }
  }, [ably, workspaceId])
}
