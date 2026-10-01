'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { aiComplete, aiErrorMessage } from '@/lib/ai/client'
import { useI18n } from '@/i18n/I18nProvider'

interface SlashCommandMenuProps {
    onInsertBlock: (type: string, content?: string) => void
}

export default function SlashCommandMenu({ onInsertBlock }: SlashCommandMenuProps) {
    const { t } = useI18n()
    const [aiPrompt, setAiPrompt] = useState('')
    const [showAiInput, setShowAiInput] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const aiInputRef = useRef<HTMLInputElement>(null)
    const params = useParams()
    const workspaceId = params?.id as string

    useEffect(() => {
        if (showAiInput) aiInputRef.current?.focus()
    }, [showAiInput])

    const generateContent = async () => {
        if (!aiPrompt.trim() || isGenerating) return
        setIsGenerating(true)
        setError(null)
        try {
            const result = await aiComplete({ workspaceId }, {
                prompt: `Write the following for a document. Return only the text to insert.\n\n${aiPrompt}`,
            })
            onInsertBlock('text', result.trim())
            setAiPrompt('')
            setShowAiInput(false)
        } catch (err) {
            setError(aiErrorMessage(err, t('workspaces.generateError')))
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="absolute bottom-48 left-12 w-64 bg-surface-container-lowest border border-outline-variant/20 rounded-lg shadow-2xl z-20 py-2">

            {/* AI section */}
            <div className="px-3 py-1.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                {t('workspaces.aiLabel')}
            </div>

            {showAiInput ? (
                <div className="px-3 py-2">
                    <div className="flex items-center gap-2 bg-surface-container rounded-lg px-2 py-1.5 border border-outline-variant/30 focus-within:border-secondary transition-colors">
                        <input
                            ref={aiInputRef}
                            type="text"
                            value={aiPrompt}
                            onChange={e => setAiPrompt(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') generateContent()
                                if (e.key === 'Escape') { setShowAiInput(false); setAiPrompt('') }
                            }}
                            placeholder={t('workspaces.describeGeneratePlaceholder')}
                            className="flex-1 bg-transparent text-xs text-on-surface placeholder-on-surface-variant outline-none"
                        />
                        {isGenerating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-secondary flex-shrink-0" />
                        ) : (
                            <button
                                onClick={generateContent}
                                disabled={!aiPrompt.trim()}
                                className="text-secondary disabled:opacity-40"
                            >
                                <span className="material-symbols-outlined text-sm leading-none">send</span>
                            </button>
                        )}
                    </div>
                    {error ? (
                        <p role="alert" className="text-[10px] text-error mt-1">{error}</p>
                    ) : (
                        <p className="text-[9px] text-on-surface-variant mt-1">{t('workspaces.generateHint')}</p>
                    )}
                </div>
            ) : (
                <div
                    className="px-3 py-2 flex items-center hover:bg-surface-container-low cursor-pointer transition-colors group"
                    onClick={() => setShowAiInput(true)}
                >
                    <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center mr-3 group-hover:bg-white">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: 'FILL 1' }}>auto_awesome</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">{t('workspaces.generateWithAi')}</span>
                        <span className="text-[10px] text-on-surface-variant">{t('workspaces.describeWhatYouWant')}</span>
                    </div>
                </div>
            )}

            <div className="border-t border-outline-variant/10 my-2"></div>

            {/* Basic Blocks */}
            <div className="px-3 py-1.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                {t('workspaces.basicBlocksHeader')}
            </div>

            <div
                className="px-3 py-2 flex items-center hover:bg-surface-container-low cursor-pointer transition-colors group"
                onClick={() => onInsertBlock('heading1')}
            >
                <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center mr-3 group-hover:bg-white">
                    <span className="material-symbols-outlined text-sm">title</span>
                </div>
                <span className="text-sm font-medium">{t('workspaces.heading1Block')}</span>
            </div>

            <div
                className="px-3 py-2 flex items-center hover:bg-surface-container-low cursor-pointer transition-colors group bg-surface-container-low"
                onClick={() => onInsertBlock('text')}
            >
                <div className="w-8 h-8 rounded bg-white flex items-center justify-center mr-3">
                    <span className="material-symbols-outlined text-sm">text_fields</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-medium">{t('workspaces.textBlock')}</span>
                    <span className="text-[10px] text-on-surface-variant">{t('workspaces.justStartWriting')}</span>
                </div>
            </div>

            <div
                className="px-3 py-2 flex items-center hover:bg-surface-container-low cursor-pointer transition-colors group"
                onClick={() => onInsertBlock('bullet')}
            >
                <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center mr-3 group-hover:bg-white">
                    <span className="material-symbols-outlined text-sm">list</span>
                </div>
                <span className="text-sm font-medium">{t('workspaces.bulletListBlock')}</span>
            </div>

            <div className="border-t border-outline-variant/10 my-2"></div>

            <div className="px-3 py-1.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                {t('workspaces.mediaHeader')}
            </div>

            <div
                className="px-3 py-2 flex items-center hover:bg-surface-container-low cursor-pointer transition-colors group"
                onClick={() => onInsertBlock('image')}
            >
                <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center mr-3 group-hover:bg-white">
                    <span className="material-symbols-outlined text-sm">image</span>
                </div>
                <span className="text-sm font-medium">{t('workspaces.imageBlock')}</span>
            </div>
        </div>
    )
}
