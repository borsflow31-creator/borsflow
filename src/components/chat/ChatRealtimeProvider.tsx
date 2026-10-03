'use client'

import { useEffect, useState, type ReactNode } from 'react'
import * as Ably from 'ably'
import { AblyProvider } from 'ably/react'
import { ChatClient, ConnectionStatus } from '@ably/chat'
import { ChatClientProvider, useChatConnection } from '@ably/chat/react'
import { Loader2, WifiOff } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/i18n/I18nProvider'

interface ChatRealtimeProviderProps {
  workspaceId: string
  children: ReactNode
}

interface Clients {
  realtime: Ably.Realtime
  chat: ChatClient
}

/**
 * Owns the Ably connection for the chat page. Mounted only on the chat route so we never
 * hold a websocket on unrelated pages, and closed on unmount so navigating away cannot
 * leak one.
 */
export function ChatRealtimeProvider({ workspaceId, children }: ChatRealtimeProviderProps) {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [clients, setClients] = useState<Clients | null>(null)

  // Created in an effect (never during render) so it can't run during SSR. Under React
  // StrictMode this runs create -> close -> create in dev, which is harmless.
  useEffect(() => {
    if (!userId) return

    const realtime = new Ably.Realtime({
      clientId: userId,
      // authCallback rather than authUrl: authUrl doesn't reliably send the next-auth cookie,
      // and here we can tell a dead session (401) from a removed member (403) from a blip (5xx).
      authCallback: async (_tokenParams, callback) => {
        try {
          const res = await fetch(`/api/workspaces/${workspaceId}/chat/token`, {
            credentials: 'same-origin',
            cache: 'no-store',
          })
          if (res.status === 401) {
            callback(new Ably.ErrorInfo('Your session has expired. Sign in again to use chat.', 40101, 401), null)
            return
          }
          if (res.status === 403) {
            callback(new Ably.ErrorInfo('You are no longer a member of this workspace.', 40160, 403), null)
            return
          }
          if (!res.ok) {
            // Plain string error: transient, so the SDK retries instead of failing permanently.
            callback(`Chat token request failed (${res.status})`, null)
            return
          }
          callback(null, (await res.json()) as Ably.TokenRequest)
        } catch (err) {
          callback(err instanceof Error ? err.message : 'Chat token request failed', null)
        }
      },
    })
    const chat = new ChatClient(realtime)
    setClients({ realtime, chat })

    return () => {
      setClients(null)
      realtime.close()
    }
  }, [workspaceId, userId])

  if (!clients) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
      </div>
    )
  }

  return (
    <AblyProvider client={clients.realtime}>
      <ChatClientProvider client={clients.chat}>
        <div className="flex flex-col h-full">
          <ConnectionBanner />
          <div className="flex-1 min-h-0">{children}</div>
        </div>
      </ChatClientProvider>
    </AblyProvider>
  )
}

function ConnectionBanner() {
  const { currentStatus, error } = useChatConnection()
  const { t } = useI18n()

  if (currentStatus === ConnectionStatus.Failed) {
    return (
      <div role="alert" className="flex items-center gap-2 px-4 py-2 text-xs bg-red-500/10 text-red-600 border-b border-red-500/20 flex-shrink-0">
        <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{t('chat.liveUnavailable')}{error?.message ? ` (${error.message})` : ''}</span>
      </div>
    )
  }

  if (currentStatus === ConnectionStatus.Disconnected || currentStatus === ConnectionStatus.Suspended) {
    return (
      <div role="status" className="flex items-center gap-2 px-4 py-2 text-xs bg-amber-500/10 text-amber-600 border-b border-amber-500/20 flex-shrink-0">
        <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
        <span>{t('chat.reconnecting')}</span>
      </div>
    )
  }

  return null
}
