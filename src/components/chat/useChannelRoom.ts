'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { chatRoomTopic } from '@/lib/chatRooms'
import { useChatRealtime } from './ChatRealtimeProvider'
import type { RoomMessageEvent } from './types'

/** Send at most one "typing" broadcast per this interval while the user keeps typing. */
const TYPING_SEND_EVERY_MS = 2000
/** Forget someone's typing state if no refresh arrives within this time. */
const TYPING_EXPIRE_MS = 4000

interface ChannelRoomOptions {
  /** Server-published message created/updated/deleted in this channel. */
  onMessage: (event: RoomMessageEvent) => void
  /** Joined (or re-joined after a drop): time to catch up on anything missed. */
  onSubscribed: () => void
}

/**
 * One chat channel's private Realtime topic: live messages (published only by the
 * server), typing indicators and presence. Presence is keyed by user id, so a user
 * with two tabs open counts once.
 */
export function useChannelRoom(
  workspaceId: string,
  channelId: string,
  myId: string | undefined,
  { onMessage, onSubscribed }: ChannelRoomOptions,
) {
  const { supabase } = useChatRealtime()
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([])
  const [typingUserIds, setTypingUserIds] = useState<string[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastTypingSent = useRef(0)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const onSubscribedRef = useRef(onSubscribed)
  onSubscribedRef.current = onSubscribed

  useEffect(() => {
    if (!myId) return
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>()
    const setTyping = (userId: string, typing: boolean) => {
      clearTimeout(typingTimers.get(userId))
      typingTimers.delete(userId)
      if (typing) typingTimers.set(userId, setTimeout(() => setTyping(userId, false), TYPING_EXPIRE_MS))
      setTypingUserIds(Array.from(typingTimers.keys()))
    }

    const channel = supabase.channel(chatRoomTopic(workspaceId, channelId), {
      config: { private: true, broadcast: { self: false }, presence: { key: myId } },
    })
    channel
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        const event = payload as RoomMessageEvent | undefined
        if (!event?.message || typeof event.message.id !== 'string' || event.message.channelId !== channelId) return
        // A message's author has stopped typing, whatever their last typing event said
        setTyping(event.message.userId, false)
        onMessageRef.current(event)
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const { userId, typing } = (payload ?? {}) as { userId?: unknown; typing?: unknown }
        if (typeof userId === 'string' && userId !== myId) setTyping(userId, typing === true)
      })
      .on('presence', { event: 'sync' }, () => {
        setOnlineUserIds(Object.keys(channel.presenceState()))
      })
      .subscribe(status => {
        if (status !== 'SUBSCRIBED') return
        void channel.track({}).catch(() => {})
        onSubscribedRef.current()
      })
    channelRef.current = channel

    return () => {
      channelRef.current = null
      lastTypingSent.current = 0
      typingTimers.forEach(clearTimeout)
      setTypingUserIds([])
      setOnlineUserIds([])
      void supabase.removeChannel(channel)
    }
  }, [supabase, workspaceId, channelId, myId])

  const sendTyping = useCallback((typing: boolean) => {
    const channel = channelRef.current
    // Only over the socket: before the join completes there is nobody to tell.
    if (!channel || channel.state !== 'joined' || !myId) return
    void channel.send({ type: 'broadcast', event: 'typing', payload: { userId: myId, typing } }).catch(() => {})
  }, [myId])

  const keystroke = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingSent.current < TYPING_SEND_EVERY_MS) return
    lastTypingSent.current = now
    sendTyping(true)
  }, [sendTyping])

  const stopTyping = useCallback(() => {
    if (!lastTypingSent.current) return
    lastTypingSent.current = 0
    sendTyping(false)
  }, [sendTyping])

  return { onlineUserIds, typingUserIds, keystroke, stopTyping }
}
