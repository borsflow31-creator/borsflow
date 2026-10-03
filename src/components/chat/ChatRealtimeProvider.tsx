'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Loader2, WifiOff } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/i18n/I18nProvider'
import { chatSignalChannel } from '@/lib/chatRooms'
import type { ChatSignal } from './useChatSignal'

interface ChatRealtimeProviderProps {
  workspaceId: string
  children: ReactNode
}

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'failed'
type SignalListener = (signal: ChatSignal) => void

interface ChatRealtimeContextValue {
  supabase: SupabaseClient
  /** Fan-out over the single workspace signal subscription. Returns an unsubscribe. */
  subscribeSignal: (listener: SignalListener) => () => void
}

const ChatRealtimeContext = createContext<ChatRealtimeContextValue | null>(null)

export function useChatRealtime() {
  const ctx = useContext(ChatRealtimeContext)
  if (!ctx) throw new Error('useChatRealtime must be used inside ChatRealtimeProvider')
  return ctx
}

// Fetch a fresh token when the cached one has less than this left. Realtime asks
// for the token on every heartbeat, so this is how it gets refreshed.
const REFRESH_MARGIN_MS = 2 * 60 * 1000

class FatalTokenError extends Error {}

/**
 * Owns the Supabase Realtime connection for the chat page. Mounted only on the chat
 * route so we never hold a websocket on unrelated pages, and closed on unmount so
 * navigating away cannot leak one.
 */
export function ChatRealtimeProvider({ workspaceId, children }: ChatRealtimeProviderProps) {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [value, setValue] = useState<ChatRealtimeContextValue | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [error, setError] = useState<string | null>(null)

  // Created in an effect (never during render) so it can't run during SSR. Under React
  // StrictMode this runs create -> close -> create in dev, which is harmless.
  useEffect(() => {
    if (!userId) return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    if (!url || !key) {
      setStatus('failed')
      setError('Realtime is not configured')
      return
    }

    let disposed = false
    let cached: { token: string; expiresAt: number } | null = null

    // The token route tells a dead session (401) from a removed member (403) from a blip (5xx).
    const getToken = async (): Promise<string | null> => {
      if (cached && cached.expiresAt - Date.now() > REFRESH_MARGIN_MS) return cached.token
      const res = await fetch(`/api/workspaces/${workspaceId}/chat/token`, {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (res.status === 401) throw new FatalTokenError('Your session has expired. Sign in again to use chat.')
      if (res.status === 403) throw new FatalTokenError('You are no longer a member of this workspace.')
      // Transient: Realtime keeps the cached token and asks again on the next heartbeat.
      if (!res.ok) throw new Error(`Chat token request failed (${res.status})`)
      cached = (await res.json()) as { token: string; expiresAt: number }
      return cached.token
    }

    const fail = (err: unknown) => {
      if (disposed) return
      setStatus('failed')
      setError(err instanceof Error ? err.message : null)
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      // Not the top-level `accessToken` option: that pins the first token and never refreshes.
      realtime: {
        accessToken: () => getToken().catch(err => {
          if (err instanceof FatalTokenError) fail(err)
          throw err
        }),
      },
    })

    const listeners = new Set<SignalListener>()
    const subscribeSignal = (listener: SignalListener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    }

    void (async () => {
      try {
        await getToken()
        await supabase.realtime.setAuth()
      } catch (err) {
        // A blip here still lets the socket retry; only a fatal answer stops chat.
        if (err instanceof FatalTokenError) return fail(err)
      }
      if (disposed) return

      supabase
        .channel(chatSignalChannel(workspaceId), { config: { private: true } })
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          const data = payload as ChatSignal | undefined
          if (data && typeof data === 'object' && typeof data.type === 'string') listeners.forEach(fn => fn(data))
        })
        .subscribe((state, err) => {
          if (disposed) return
          if (state === 'SUBSCRIBED') {
            setStatus('connected')
            setError(null)
          } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
            setStatus(cur => (cur === 'failed' ? cur : 'reconnecting'))
            if (err) console.warn('[chat] realtime:', err.message)
          }
        })

      setValue({ supabase, subscribeSignal })
    })()

    return () => {
      disposed = true
      setValue(null)
      setStatus('connecting')
      setError(null)
      void supabase.removeAllChannels().finally(() => supabase.realtime.disconnect())
    }
  }, [workspaceId, userId])

  if (!value) {
    if (status === 'failed') {
      return (
        <div className="h-full flex flex-col">
          <ConnectionBanner status={status} error={error} />
        </div>
      )
    }
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
      </div>
    )
  }

  return (
    <ChatRealtimeContext.Provider value={value}>
      <div className="flex flex-col h-full">
        <ConnectionBanner status={status} error={error} />
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </ChatRealtimeContext.Provider>
  )
}

function ConnectionBanner({ status, error }: { status: ConnectionStatus; error: string | null }) {
  const { t } = useI18n()

  if (status === 'failed') {
    return (
      <div role="alert" className="flex items-center gap-2 px-4 py-2 text-xs bg-red-500/10 text-red-600 border-b border-red-500/20 flex-shrink-0">
        <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{t('chat.liveUnavailable')}{error ? ` (${error})` : ''}</span>
      </div>
    )
  }

  if (status === 'reconnecting') {
    return (
      <div role="status" className="flex items-center gap-2 px-4 py-2 text-xs bg-amber-500/10 text-amber-600 border-b border-amber-500/20 flex-shrink-0">
        <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
        <span>{t('chat.reconnecting')}</span>
      </div>
    )
  }

  return null
}
