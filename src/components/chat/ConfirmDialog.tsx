'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'

/** Small in-app confirmation, used instead of window.confirm(). */
export function ConfirmDialog({
  title, body, confirmLabel, danger = false, onConfirm, onCancel,
}: {
  title: string
  body?: string
  confirmLabel: string
  danger?: boolean
  /** May throw: the message is shown and the dialog stays open. */
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('chat.genericError'))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => !busy && onCancel()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="chat-confirm-title"
        className="w-full max-w-sm rounded-2xl bg-surface-container-lowest p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="chat-confirm-title" className="text-sm font-semibold text-on-surface">{title}</h3>
        {body && <p className="mt-2 text-sm text-on-surface-variant">{body}</p>}
        {error && <p role="alert" className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-outline-variant/30 px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60 ${
              danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-secondary text-on-secondary hover:opacity-90'
            }`}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
