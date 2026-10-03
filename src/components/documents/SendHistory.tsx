'use client'

/**
 * Who sent a quote or invoice: one row per send (re-sends included) with the
 * member, the recipient, the From it went out as, and when.
 */

import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'

interface SendRecord {
  id: string
  sentAt: string
  sentBy: { id: string; name: string | null; email: string | null } | null
  to: string | null
  from: string | null
  sendFrom: 'platform' | 'workspace'
}

export default function SendHistory({
  kind,
  documentId,
  refreshKey,
}: {
  kind: 'quote' | 'invoice'
  documentId: string
  /** Change it (e.g. to the document's sentAt) to reload after a send. */
  refreshKey?: unknown
}) {
  const { t, formatDateTime } = useI18n()
  const [sends, setSends] = useState<SendRecord[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/${kind}s/${documentId}/sends`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => { if (!cancelled) { setSends(data.sends || []); setFailed(false) } })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [kind, documentId, refreshKey])

  return (
    <div className="bg-surface rounded-lg p-6">
      <h2 className="text-base font-semibold text-on-surface mb-4">{t('documentSender.history.title')}</h2>
      {failed ? (
        <p className="text-sm text-on-surface-variant">{t('documentSender.history.loadFailed')}</p>
      ) : sends === null ? (
        <div className="h-10 animate-pulse rounded-lg bg-surface-container-low" />
      ) : sends.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{t('documentSender.history.empty')}</p>
      ) : (
        <ol className="space-y-4">
          {sends.map((send) => (
            <li key={send.id} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary">
                <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 text-sm">
                <p className="text-on-surface">
                  <span className="font-medium">{send.sentBy?.name || send.sentBy?.email || t('documentSender.history.unknownMember')}</span>
                  {send.to && <> {t('documentSender.history.sentTo')} <span className="break-all">{send.to}</span></>}
                </p>
                <p className="text-xs text-on-surface-variant">{formatDateTime(send.sentAt)}</p>
                {send.from && (
                  <p className="mt-0.5 truncate text-xs text-on-surface-variant" title={send.from}>
                    {t('documentSender.history.from')} {send.from}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
