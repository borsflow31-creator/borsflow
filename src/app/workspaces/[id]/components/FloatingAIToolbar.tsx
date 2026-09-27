'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface FloatingAIToolbarProps {
    selectedText: string
    onResult: (text: string) => void
}

const ACTIONS = [
    { label: 'Fix grammar',  prompt: (t: string) => `Fix the grammar and spelling of this text, return only the corrected text:\n\n${t}` },
    { label: 'Summarize',    prompt: (t: string) => `Summarize this text concisely, return only the summary:\n\n${t}` },
    { label: 'Make shorter', prompt: (t: string) => `Make this text shorter while keeping the key points, return only the result:\n\n${t}` },
    { label: 'Make longer',  prompt: (t: string) => `Expand on this text with more detail, return only the result:\n\n${t}` },
]

export default function FloatingAIToolbar({ selectedText, onResult }: FloatingAIToolbarProps) {
    const [loading, setLoading] = useState<string | null>(null)

    const runAction = async (label: string, prompt: (t: string) => string) => {
        if (!selectedText || loading) return
        setLoading(label)
        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt(selectedText) }],
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
            onResult(result.trim())
        } catch {
            // silently fail — toolbar stays visible for retry
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
                <span className="text-xs font-semibold">AI</span>
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
