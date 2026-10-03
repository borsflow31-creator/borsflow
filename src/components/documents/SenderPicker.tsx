'use client'

/**
 * "Send from" choice for quote and invoice emails. Renders nothing unless the
 * workspace has its own email connected (Email Marketing → providers); then the
 * user picks between that address and BorsFlow's. The choice is remembered per
 * workspace in this browser.
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/i18n/I18nProvider'
import { cachedJson } from '@/lib/client-cache'

export type DocumentSender = 'platform' | 'workspace'

const SUPPORTED = new Set(['resend', 'sendgrid', 'ses', 'mailgun', 'postmark', 'brevo'])
const storageKey = (workspaceId: string) => `doc_sender_${workspaceId}`

interface ConnectedSender {
  fromEmail: string
  fromName?: string | null
}

/** The workspace's connected sender (or null) and the user's current choice. */
export function useDocumentSender(workspaceId: string | undefined) {
  // The email goes out under the sending member's name, not the workspace's
  const { data: session } = useSession()
  const senderName = session?.user?.name || session?.user?.email?.split('@')[0] || ''
  const [connected, setConnected] = useState<ConnectedSender | null>(null)
  const [sendFrom, setSendFromState] = useState<DocumentSender>('platform')

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    cachedJson<{ providers?: any[] }>(`/api/email-marketing/providers?workspaceId=${workspaceId}`)
      .then((data) => {
        if (cancelled) return
        const active = (data.providers || []).filter((p) => p.isActive && SUPPORTED.has(p.type))
        const provider = active.find((p) => p.isDefault) || active[0]
        setConnected(provider ? { fromEmail: provider.fromEmail, fromName: provider.fromName } : null)
        if (provider) {
          // Default to the workspace's own address: that's why it was connected
          let saved: string | null = null
          try { saved = localStorage.getItem(storageKey(workspaceId)) } catch {}
          setSendFromState(saved === 'platform' ? 'platform' : 'workspace')
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [workspaceId])

  const setSendFrom = (value: DocumentSender) => {
    setSendFromState(value)
    if (workspaceId) {
      try { localStorage.setItem(storageKey(workspaceId), value) } catch {}
    }
  }

  // Without a connected email there is no choice to send to the API
  return { connected, senderName, sendFrom: connected ? sendFrom : 'platform' as DocumentSender, setSendFrom }
}

export default function SenderPicker({
  connected,
  senderName,
  value,
  onChange,
}: {
  connected: ConnectedSender | null
  senderName: string
  value: DocumentSender
  onChange: (value: DocumentSender) => void
}) {
  const { t } = useI18n()
  if (!connected) return null

  const options: { id: DocumentSender; title: string; detail: string }[] = [
    {
      id: 'workspace',
      title: senderName ? `${senderName} <${connected.fromEmail}>` : connected.fromEmail,
      detail: t('documentSender.sender.workspaceDetail'),
    },
    {
      id: 'platform',
      title: t('documentSender.sender.platformTitle', { name: senderName || t('documentSender.sender.you') }),
      detail: t('documentSender.sender.platformDetail'),
    },
  ]

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-on-surface-variant mb-2">{t('documentSender.sender.label')}</legend>
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
              value === option.id ? 'border-secondary bg-secondary/10' : 'border-outline-variant/30 hover:bg-surface-container-low'
            }`}
          >
            <input
              type="radio"
              name="document-sender"
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              className="mt-1 accent-secondary"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-on-surface">{option.title}</span>
              <span className="block text-xs text-on-surface-variant">{option.detail}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
