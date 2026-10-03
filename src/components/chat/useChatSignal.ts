'use client'

import { useEffect, useRef } from 'react'
import { useChatRealtime } from './ChatRealtimeProvider'

export type ChatSignal =
  | { type: 'message'; channelId: string; messageId: string; userId: string; parentId: string | null }
  | { type: 'message-changed'; channelId: string; messageId: string; parentId: string | null }
  | { type: 'channels-changed' }

/**
 * Listens to the workspace's server-only signal topic (unread bumps,
 * reactions, pins, thread replies, channel list changes). Signals carry ids
 * only; handlers refetch from the API.
 */
export function useChatSignal(_workspaceId: string, handler: (signal: ChatSignal) => void) {
  const { subscribeSignal } = useChatRealtime()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => subscribeSignal(signal => handlerRef.current(signal)), [subscribeSignal])
}
