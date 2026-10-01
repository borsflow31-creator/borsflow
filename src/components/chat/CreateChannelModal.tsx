'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Hash, X } from 'lucide-react'
import type { Channel } from './types'
import { useI18n } from '@/i18n/I18nProvider'

export function CreateChannelModal({
  onClose, onCreated, workspaceId,
}: {
  onClose: () => void; onCreated: (c: Channel) => void; workspaceId: string
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useI18n()

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/chat/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || t('chat.createModal.failedError')); return }
      onCreated(data.channel)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
          <h3 className="font-semibold text-on-surface text-sm">{t('chat.createModal.title')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-highest text-on-surface-variant transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1.5">
              {t('chat.createModal.nameLabel')}
            </label>
            <div className="flex items-center gap-2 bg-surface-container rounded-xl border border-outline-variant/30 px-3 py-2.5 focus-within:border-secondary/50 focus-within:ring-2 focus-within:ring-secondary/10 transition-all">
              <Hash className="h-4 w-4 text-on-surface-variant/50 flex-shrink-0" />
              <input
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                placeholder="e.g. general"
                maxLength={50}
                className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide block mb-1.5">
              {t('chat.createModal.descLabel')} <span className="normal-case font-normal">{t('chat.createModal.optional')}</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('chat.createModal.descPlaceholder')}
              maxLength={120}
              className="w-full bg-surface-container rounded-xl border border-outline-variant/30 px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-secondary/50 focus:ring-2 focus:ring-secondary/10 transition-all"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="flex-1 py-2.5 rounded-xl bg-secondary text-on-secondary text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-all"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : t('chat.createModal.create')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
