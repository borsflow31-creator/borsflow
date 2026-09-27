'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown, Link2, Check, FileText, FileDown, FileCode, Globe, Lock, Users } from 'lucide-react'
import { blocksToMarkdown, blocksToDocx, downloadBlob, triggerPrint } from '@/lib/pageExport'
import PageAccessModal from './PageAccessModal'

interface Block {
    id: string
    type: string
    content: any
    order: number
}

interface ExportShareToolbarProps {
    title: string
    blocks: Block[]
    pageId: string
    workspaceId?: string
    isPublic?: boolean
    isAdmin?: boolean
}

export default function ExportShareToolbar({ title, blocks, pageId, workspaceId, isPublic: initialIsPublic = false, isAdmin = false }: ExportShareToolbarProps) {
    const [exportOpen, setExportOpen] = useState(false)
    const [accessModalOpen, setAccessModalOpen] = useState(false)
    const [isPublic, setIsPublic] = useState(initialIsPublic)
    const [shareOpen, setShareOpen] = useState(false)
    const [shareState, setShareState] = useState<'idle' | 'copied' | 'toggling'>('idle')
    const [exporting, setExporting] = useState<string | null>(null)
    const exportDropdownRef = useRef<HTMLDivElement>(null)
    const shareDropdownRef = useRef<HTMLDivElement>(null)

    // Sync if parent re-renders with updated isPublic
    useEffect(() => {
        setIsPublic(initialIsPublic)
    }, [initialIsPublic])

    // Close export dropdown on outside click
    useEffect(() => {
        if (!exportOpen) return
        function handleMouseDown(e: MouseEvent) {
            if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
                setExportOpen(false)
            }
        }
        document.addEventListener('mousedown', handleMouseDown)
        return () => document.removeEventListener('mousedown', handleMouseDown)
    }, [exportOpen])

    // Close share dropdown on outside click
    useEffect(() => {
        if (!shareOpen) return
        function handleMouseDown(e: MouseEvent) {
            if (shareDropdownRef.current && !shareDropdownRef.current.contains(e.target as Node)) {
                setShareOpen(false)
            }
        }
        document.addEventListener('mousedown', handleMouseDown)
        return () => document.removeEventListener('mousedown', handleMouseDown)
    }, [shareOpen])

    async function handleExport(format: 'pdf' | 'docx' | 'markdown') {
        setExportOpen(false)
        setExporting(format)
        try {
            const safeTitle = title || 'Untitled'
            if (format === 'markdown') {
                const md = blocksToMarkdown(safeTitle, blocks)
                downloadBlob(md, `${safeTitle}.md`, 'text/markdown')
            } else if (format === 'docx') {
                const blob = await blocksToDocx(safeTitle, blocks)
                downloadBlob(blob, `${safeTitle}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            } else if (format === 'pdf') {
                triggerPrint()
            }
        } finally {
            setExporting(null)
        }
    }

    async function togglePublic() {
        setShareState('toggling')
        try {
            const next = !isPublic
            const res = await fetch(`/api/pages/${pageId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublic: next }),
            })
            if (res.ok) {
                setIsPublic(next)
            }
        } finally {
            setShareState('idle')
        }
    }

    async function copyShareLink() {
        const url = `${window.location.origin}/share/${pageId}`
        try {
            await navigator.clipboard.writeText(url)
            setShareState('copied')
            setTimeout(() => setShareState('idle'), 2000)
        } catch {
            // Fallback for environments where clipboard API is unavailable
            const ta = document.createElement('textarea')
            ta.value = url
            document.body.appendChild(ta)
            ta.select()
            document.execCommand('copy')
            document.body.removeChild(ta)
            setShareState('copied')
            setTimeout(() => setShareState('idle'), 2000)
        }
    }

    return (
        <div className="flex items-center justify-end gap-2 mb-6">
            {/* Share with members — admin only */}
            {isAdmin && workspaceId && (
                <>
                    <button
                        onClick={() => setAccessModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-on-surface-variant hover:text-on-surface bg-surface-container-low hover:bg-surface-container rounded-lg border border-outline-variant/40 transition-colors"
                    >
                        <Users className="h-3.5 w-3.5" />
                        <span>Members</span>
                    </button>
                    <PageAccessModal
                        pageId={pageId}
                        workspaceId={workspaceId}
                        pageTitle={title}
                        isOpen={accessModalOpen}
                        onClose={() => setAccessModalOpen(false)}
                    />
                </>
            )}

            {/* Export dropdown */}
            <div className="relative" ref={exportDropdownRef}>
                <button
                    onClick={() => setExportOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-on-surface-variant hover:text-on-surface bg-surface-container-low hover:bg-surface-container rounded-lg border border-outline-variant/40 transition-colors"
                >
                    {exporting ? (
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-outline-variant border-t-secondary" />
                    ) : (
                        <Download className="h-3.5 w-3.5" />
                    )}
                    <span>Export</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>

                {exportOpen && (
                    <div className="absolute top-full right-0 mt-1 w-44 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden">
                        <button
                            onClick={() => handleExport('pdf')}
                            className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                        >
                            <FileText className="h-4 w-4 text-red-500" />
                            PDF
                        </button>
                        <button
                            onClick={() => handleExport('docx')}
                            className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                        >
                            <FileDown className="h-4 w-4 text-blue-500" />
                            Word (.docx)
                        </button>
                        <button
                            onClick={() => handleExport('markdown')}
                            className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                        >
                            <FileCode className="h-4 w-4 text-green-500" />
                            Markdown
                        </button>
                    </div>
                )}
            </div>

            {/* Share dropdown */}
            <div className="relative" ref={shareDropdownRef}>
                <button
                    onClick={() => setShareOpen((v) => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        isPublic
                            ? 'bg-blue-50 dark:bg-secondary/10 text-blue-600 dark:text-secondary border-blue-200 dark:border-secondary/30 hover:bg-blue-100 dark:hover:bg-secondary/20'
                            : 'text-on-surface-variant hover:text-on-surface bg-surface-container-low hover:bg-surface-container border-outline-variant/40'
                    }`}
                >
                    {isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    <span>{isPublic ? 'Shared' : 'Share'}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>

                {shareOpen && (
                    <div className="absolute top-full right-0 mt-1 w-72 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-xl z-50 p-4">
                        {/* Toggle */}
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-sm font-medium text-on-surface">Public access</p>
                                <p className="text-xs text-on-surface-variant mt-0.5">
                                    {isPublic ? 'Anyone with the link can view' : 'Only workspace members can view'}
                                </p>
                            </div>
                            <button
                                onClick={togglePublic}
                                disabled={shareState === 'toggling'}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                    isPublic ? 'bg-blue-600 dark:bg-secondary' : 'bg-gray-200 dark:bg-surface-container-high'
                                }`}
                            >
                                {shareState === 'toggling' ? (
                                    <span className="absolute inset-0 flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                                    </span>
                                ) : (
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
                                )}
                            </button>
                        </div>

                        {/* Copy link — only shown when public */}
                        {isPublic && (
                            <>
                                <div className="h-px bg-outline-variant/20 mb-3" />
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 px-3 py-1.5 bg-surface-container-low rounded-lg text-xs text-on-surface-variant truncate font-mono">
                                        {typeof window !== 'undefined' ? `${window.location.origin}/share/${pageId}` : `/share/${pageId}`}
                                    </div>
                                    <button
                                        onClick={copyShareLink}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 dark:bg-secondary text-white dark:text-on-secondary rounded-lg text-xs font-medium hover:bg-blue-700 dark:hover:bg-secondary/90 transition-colors whitespace-nowrap"
                                    >
                                        {shareState === 'copied' ? (
                                            <><Check className="h-3 w-3" /> Copied!</>
                                        ) : (
                                            <><Link2 className="h-3 w-3" /> Copy link</>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
