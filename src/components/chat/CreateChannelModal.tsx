'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Hash, Lock, X, Check, Search } from 'lucide-react'
import type { Channel, UserDirectory } from './types'
import { chatApi } from './chatApi'
import { getInitials } from './chatFormat'
import { useI18n } from '@/i18n/I18nProvider'

/** Checkbox list of workspace members, with a filter box. */
export function MemberPicker({
  directory, selected, onChange, lockedIds = [],
}: {
  directory: UserDirectory
  selected: string[]
  onChange: (ids: string[]) => void
  /** Always selected and can't be unticked (e.g. the channel creator) */
  lockedIds?: string[]
}) {
  const { t } = useI18n()
  const [filter, setFilter] = useState('')
  const people = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return Object.entries(directory)
      .map(([id, p]) => ({ id, label: p.name || p.email, email: p.email }))
      .filter(p => !q || p.label.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [directory, filter])

  const toggle = (id: string) => {
    if (lockedIds.includes(id)) return
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  return (
    <div className="rounded-xl border border-outline-variant/30">
      <div className="flex items-center gap-2 border-b border-outline-variant/20 px-3 py-2">
        <Search className="h-3.5 w-3.5 text-on-surface-variant" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('chat.filterMembers')}
          aria-label={t('chat.filterMembers')}
          className="flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant/50"
        />
      </div>
      <ul className="max-h-52 overflow-y-auto p-1">
        {people.map(p => {
          const checked = selected.includes(p.id) || lockedIds.includes(p.id)
          return (
            <li key={p.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={lockedIds.includes(p.id)}
                onClick={() => toggle(p.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-container-high disabled:cursor-default"
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-secondary bg-secondary text-on-secondary' : 'border-outline-variant'}`}>
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-[10px] font-bold text-secondary">{getInitials(p.label)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-on-surface">{p.label}</span>
                  {p.label !== p.email && <span className="block truncate text-[11px] text-on-surface-variant">{p.email}</span>}
                </span>
              </button>
            </li>
          )
        })}
        {people.length === 0 && <li className="px-3 py-3 text-center text-xs text-on-surface-variant">{t('chat.noMembersMatch')}</li>}
      </ul>
    </div>
  )
}

export function CreateChannelModal({
  onClose, onCreated, workspaceId, directory, myId,
}: {
  onClose: () => void
  onCreated: (c: Channel) => void
  workspaceId: string
  directory: UserDirectory
  myId?: string
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const { channel } = await chatApi(workspaceId).createChannel({
        name: name.trim(),
        description: description.trim(),
        isPrivate,
        memberIds: isPrivate ? memberIds : undefined,
      })
      onCreated(channel)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('chat.createModal.failedError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-channel-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface-container-lowest shadow-2xl sm:mx-4 sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-outline-variant/20 px-5 py-4">
          <h3 id="create-channel-title" className="text-sm font-semibold text-on-surface">{t('chat.createModal.title')}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="channel-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('chat.createModal.nameLabel')}
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2.5 transition-all focus-within:border-secondary/50 focus-within:ring-2 focus-within:ring-secondary/10">
              {isPrivate ? <Lock className="h-4 w-4 shrink-0 text-on-surface-variant/50" /> : <Hash className="h-4 w-4 shrink-0 text-on-surface-variant/50" />}
              <input
                id="channel-name"
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                placeholder={t('chat.createModal.namePlaceholder')}
                maxLength={80}
                className="flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant/40"
              />
            </div>
          </div>
          <div>
            <label htmlFor="channel-desc" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('chat.createModal.descLabel')} <span className="font-normal normal-case">{t('chat.createModal.optional')}</span>
            </label>
            <input
              id="channel-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('chat.createModal.descPlaceholder')}
              maxLength={500}
              className="w-full rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2.5 text-sm text-on-surface outline-none transition-all placeholder:text-on-surface-variant/40 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/10"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/30 px-3 py-2.5">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="mt-0.5 h-4 w-4 accent-secondary" />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-on-surface"><Lock className="h-3.5 w-3.5" />{t('chat.createModal.private')}</span>
              <span className="block text-xs text-on-surface-variant">{t('chat.createModal.privateHint')}</span>
            </span>
          </label>

          {isPrivate && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{t('chat.members')}</p>
              <MemberPicker directory={directory} selected={memberIds} onChange={setMemberIds} lockedIds={myId ? [myId] : []} />
            </div>
          )}

          {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-outline-variant/30 py-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={!name.trim() || loading} className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-medium text-on-secondary transition-all hover:opacity-90 disabled:opacity-40">
              {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t('chat.createModal.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** Manage a private channel's members (creator / owner / admins). */
export function ChannelMembersModal({
  workspaceId, channel, directory, canManage, onClose, onSaved,
}: {
  workspaceId: string
  channel: Channel
  directory: UserDirectory
  canManage: boolean
  onClose: () => void
  onSaved: (memberIds: string[]) => void
}) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<string[]>(channel.memberIds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const { memberIds } = await chatApi(workspaceId).setMembers(channel.id, selected)
      onSaved(memberIds)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('chat.genericError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="members-title" onClick={(e) => e.stopPropagation()} className="w-full rounded-t-2xl bg-surface-container-lowest shadow-2xl sm:mx-4 sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant/20 px-5 py-4">
          <h3 id="members-title" className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
            <Lock className="h-3.5 w-3.5" /> {t('chat.membersOf', { name: channel.name })}
          </h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-highest">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {canManage ? (
            <MemberPicker directory={directory} selected={selected} onChange={setSelected} lockedIds={[channel.createdById]} />
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {channel.memberIds.map(id => (
                <li key={id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-on-surface">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/20 text-[10px] font-bold text-secondary">{getInitials(directory[id]?.name || directory[id]?.email || '?')}</span>
                  {directory[id]?.name || directory[id]?.email || t('chat.unknownMember')}
                </li>
              ))}
            </ul>
          )}
          {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
          {canManage && (
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-outline-variant/30 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container">
                {t('common.cancel')}
              </button>
              <button type="button" onClick={() => void save()} disabled={saving} className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-medium text-on-secondary hover:opacity-90 disabled:opacity-40">
                {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t('common.save')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
