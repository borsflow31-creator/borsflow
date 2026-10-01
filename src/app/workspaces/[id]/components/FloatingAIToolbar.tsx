'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { aiComplete, aiErrorMessage } from '@/lib/ai/client'
import { useI18n } from '@/i18n/I18nProvider'

interface FloatingAIToolbarProps {
    selectedText: string
    onResult: (text: string) => void
}

export default function FloatingAIToolbar({ selectedText, onResult }: FloatingAIToolbarProps) {
    const { t } = useI18n()
    const [loading, setLoading] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const params = useParams()
    const workspaceId = params?.id as string

    const ACTIONS = [
        { label: t('workspaces.fixGrammar'), prompt: 'Fix the grammar and spelling of this text. Return only the corrected text.' },
        { label: t('workspaces.summarize'), prompt: 'Summarize this text concisely. Return only the summary.' },
        { label: t('workspaces.makeShorter'), prompt: 'Make this text shorter while keeping the key points. Return only the result.' },
        { label: t('workspaces.makeLonger'), prompt: 'Expand on this text with more detail. Return only the result.' },
    ]

    const runAction = async (label: string, prompt: string) => {
        if (!selectedText || loading) return
        setLoading(label)
        setError(null)
        try {
            const result = await aiComplete({ workspaceId }, { prompt, text: selectedText })
            onResult(result.trim())
        } catch (err) {
            // The toolbar stays visible for a retry.
            setError(aiErrorMessage(err, t('workspaces.aiActionError')))
        } finally {
            setLoading(null)
        }
    }

    return (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 flex items-center bg-on-surface text-surface py-2 px-4 rounded-full shadow-xl space-x-4 border border-outline-variant/10 z-40">
            <div className="flex items-center space-x-1 border-r border-surface/20 pr-4">
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: 'FILL 1' }}>
                    auto_awesome
                </span>
                <span className="text-xs font-semibold">{t('workspaces.aiLabel')}</span>
            </div>
            <div className="flex items-center space-x-1">
                {ACTIONS.map(({ label, prompt }) => (
                    <button
                        key={label}
                        onClick={() => runAction(label, prompt)}
                        disabled={!!loading || !selectedText}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-full hover:bg-surface/20 disabled:opacity-50 transition-colors"
                    >
                        {loading === label && <Loader2 className="h-3 w-3 animate-spin" />}
                        {label}
                    </button>
                ))}
            </div>
            {error && (
                <span role="alert" className="max-w-[16rem] truncate text-xs text-error-container" title={error}>
                    {error}
                </span>
            )}
            <div className="flex items-center space-x-3 text-surface/80 border-l border-surface/20 pl-4">
                <span className="material-symbols-outlined text-sm cursor-pointer hover:text-white">format_bold</span>
                <span className="material-symbols-outlined text-sm cursor-pointer hover:text-white">format_italic</span>
                <span className="material-symbols-outlined text-sm cursor-pointer hover:text-white">format_underlined</span>
                <span className="material-symbols-outlined text-sm cursor-pointer hover:text-white">link</span>
                <span className="material-symbols-outlined text-sm cursor-pointer hover:text-white">comment</span>
            </div>
        </div>
    )
}
