'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface SlashCommandMenuProps {
    onInsertBlock: (type: string, content?: string) => void
}

export default function SlashCommandMenu({ onInsertBlock }: SlashCommandMenuProps) {
    const [aiPrompt, setAiPrompt] = useState('')
    const [showAiInput, setShowAiInput] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const aiInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (showAiInput) aiInputRef.current?.focus()
    }, [showAiInput])

    const generateContent = async () => {
        if (!aiPrompt.trim() || isGenerating) return
        setIsGenerating(true)
        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: aiPrompt }],
                }),
            })
            if (!res.ok || !res.body) throw new Error('Request failed')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let result = ''
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                result += decoder.decode(value)
            }
            onInsertBlock('text', result.trim())
            setAiPrompt('')
            setShowAiInput(false)
        } catch {
            // silently fail
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="absolute bottom-48 left-12 w-64 bg-surface-container-lowest border border-outline-variant/20 rounded-lg shadow-2xl z-20 py-2">

            {/* AI section */}
            <div className="px-3 py-1.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                AI
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
                            placeholder="Describe what to generate…"
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
                    <p className="text-[9px] text-on-surface-variant mt-1">Enter to generate · Esc to cancel</p>
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
                        <span className="text-sm font-medium">Generate with AI</span>
                        <span className="text-[10px] text-on-surface-variant">Describe what you want</span>
                    </div>
                </div>
            )}

            <div className="border-t border-outline-variant/10 my-2"></div>

            {/* Basic Blocks */}
            <div className="px-3 py-1.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                Basic Blocks
            </div>

            <div
                className="px-3 py-2 flex items-center hover:bg-surface-container-low cursor-pointer transition-colors group"
                onClick={() => onInsertBlock('heading1')}
            >
                <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center mr-3 group-hover:bg-white">
                    <span className="material-symbols-outlined text-sm">title</span>
                </div>
                <span className="text-sm font-medium">Heading 1</span>
            </div>

            <div
                className="px-3 py-2 flex items-center hover:bg-surface-container-low cursor-pointer transition-colors group bg-surface-container-low"
                onClick={() => onInsertBlock('text')}
            >
                <div className="w-8 h-8 rounded bg-white flex items-center justify-center mr-3">
                    <span className="material-symbols-outlined text-sm">text_fields</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-medium">Text</span>
                    <span className="text-[10px] text-on-surface-variant">Just start writing</span>
                </div>
            </div>

            <div
                className="px-3 py-2 flex items-center hover:bg-surface-container-low cursor-pointer transition-colors group"
                onClick={() => onInsertBlock('bullet')}
            >
                <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center mr-3 group-hover:bg-white">
                    <span className="material-symbols-outlined text-sm">list</span>
                </div>
                <span className="text-sm font-medium">Bullet List</span>
            </div>

            <div className="border-t border-outline-variant/10 my-2"></div>

            <div className="px-3 py-1.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                Media
            </div>

            <div
                className="px-3 py-2 flex items-center hover:bg-surface-container-low cursor-pointer transition-colors group"
                onClick={() => onInsertBlock('image')}
            >
                <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center mr-3 group-hover:bg-white">
                    <span className="material-symbols-outlined text-sm">image</span>
                </div>
                <span className="text-sm font-medium">Image</span>
            </div>
        </div>
    )
}
