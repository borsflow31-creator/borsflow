'use client'

import { useState, useEffect } from 'react'
import { X, Users, Lock, Eye, Pencil, Loader2 } from 'lucide-react'

interface Member {
    userId: string
    name: string | null
    email: string
    role: string
}

interface AccessRecord {
    userId: string
    level: string
}

interface PageAccessModalProps {
    pageId: string
    workspaceId: string
    pageTitle: string
    isOpen: boolean
    onClose: () => void
}

export default function PageAccessModal({
    pageId,
    workspaceId,
    pageTitle,
    isOpen,
    onClose,
}: PageAccessModalProps) {
    const [members, setMembers] = useState<Member[]>([])
    const [accesses, setAccesses] = useState<Record<string, string>>({})
    const [cascade, setCascade] = useState(false)
    const [saving, setSaving] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!isOpen) return
        setLoading(true)

        Promise.all([
            fetch(`/api/workspaces/${workspaceId}`).then((r) => r.json()),
            fetch(`/api/pages/${pageId}/access`).then((r) => r.json()),
        ])
            .then(([workspaceData, accessData]) => {
                const rawMembers = workspaceData.workspace?.members || []
                const memberList: Member[] = rawMembers
                    .filter((m: any) => !['owner', 'admin'].includes(m.role))
                    .map((m: any) => ({
                        userId: m.userId,
                        name: m.user?.name ?? null,
                        email: m.user?.email ?? '',
                        role: m.role,
                    }))
                setMembers(memberList)

                const accessMap: Record<string, string> = {}
                for (const a of accessData.accesses || []) {
                    accessMap[a.userId] = a.level
                }
                setAccesses(accessMap)
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [isOpen, pageId, workspaceId])

    async function setAccess(userId: string, level: string) {
        setSaving(userId)
        try {
            const res = await fetch(`/api/pages/${pageId}/access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, level, cascade }),
            })
            if (res.ok) {
                setAccesses((prev) => ({ ...prev, [userId]: level }))
            }
        } finally {
            setSaving(null)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        <div>
                            <p className="text-sm font-semibold text-on-surface">Share with members</p>
                            <p className="text-xs text-on-surface-variant truncate max-w-xs">{pageTitle || 'Untitled'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 max-h-80 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" />
                        </div>
                    ) : members.length === 0 ? (
                        <p className="text-sm text-on-surface-variant text-center py-8">No invited members yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {members.map((member) => {
                                const level = accesses[member.userId] || 'NONE'
                                const isSaving = saving === member.userId
                                return (
                                    <div
                                        key={member.userId}
                                        className="flex items-center gap-3 py-2"
                                    >
                                        {/* Avatar */}
                                        <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-semibold text-on-secondary-container">
                                                {(member.name || member.email).charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-on-surface truncate">
                                                {member.name || member.email}
                                            </p>
                                            <p className="text-xs text-on-surface-variant truncate">{member.email}</p>
                                        </div>
                                        {/* Access selector */}
                                        {isSaving ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-on-surface-variant" />
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setAccess(member.userId, 'NONE')}
                                                    title="No access"
                                                    className={`p-1.5 rounded-lg transition-colors ${
                                                        level === 'NONE'
                                                            ? 'bg-surface-container-high text-on-surface'
                                                            : 'text-on-surface-variant hover:bg-surface-container-high'
                                                    }`}
                                                >
                                                    <Lock className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setAccess(member.userId, 'VIEW')}
                                                    title="View"
                                                    className={`p-1.5 rounded-lg transition-colors ${
                                                        level === 'VIEW'
                                                            ? 'bg-primary/10 text-primary'
                                                            : 'text-on-surface-variant hover:bg-surface-container-high'
                                                    }`}
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setAccess(member.userId, 'EDIT')}
                                                    title="Edit"
                                                    className={`p-1.5 rounded-lg transition-colors ${
                                                        level === 'EDIT'
                                                            ? 'bg-primary/10 text-primary'
                                                            : 'text-on-surface-variant hover:bg-surface-container-high'
                                                    }`}
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-outline-variant/20 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={cascade}
                            onChange={(e) => setCascade(e.target.checked)}
                            className="rounded border-outline-variant"
                        />
                        <span className="text-xs text-on-surface-variant">Apply to child pages</span>
                    </label>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 text-sm font-medium bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-opacity"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}
