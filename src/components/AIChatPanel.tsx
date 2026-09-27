'use client'

import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { X, Send, Loader2 } from 'lucide-react'

interface Message {
    role: 'user' | 'assistant'
    content: string
}

interface AIChatPanelProps {
    isOpen: boolean
    onClose: () => void
    /** Optional page content to pass as context */
    context?: string
    workspaceId?: string | null
}

export default function AIChatPanel({ isOpen, onClose, context, workspaceId }: AIChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => textareaRef.current?.focus(), 300)
        }
    }, [isOpen])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const sendMessage = async () => {
        const trimmed = input.trim()
        if (!trimmed || isStreaming) return

        const userMsg: Message = { role: 'user', content: trimmed }
        const assistantMsg: Message = { role: 'assistant', content: '' }

        setMessages(prev => [...prev, userMsg, assistantMsg])
        setInput('')
        setIsStreaming(true)

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
                    context,
                    workspaceId,
                }),
            })

            if (!res.ok || !res.body) throw new Error('Request failed')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                const chunk = decoder.decode(value)
                setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = {
                        ...updated[updated.length - 1],
                        content: updated[updated.length - 1].content + chunk,
                    }
                    return updated
                })
            }
        } catch {
            setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: 'Sorry, something went wrong. Please try again.',
                }
                return updated
            })
        } finally {
            setIsStreaming(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed right-0 top-0 sm:top-14 bottom-0 w-full sm:w-[440px] sm:right-4 sm:bottom-4 z-[100] flex flex-col bg-surface-container-lowest border-l sm:border border-outline-variant/30 shadow-2xl sm:rounded-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-4 border-b border-outline-variant/30 bg-surface-container-low shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-secondary to-secondary-container flex items-center justify-center shadow-lg shadow-secondary/20">
                                <span
                                    className="material-symbols-outlined text-on-secondary text-sm"
                                    style={{ fontVariationSettings: 'FILL 1' }}
                                >
                                    auto_awesome
                                </span>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-on-surface">AI Assistant</h3>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl hover:bg-surface-container-highest transition-all duration-200 text-on-surface-variant hover:text-on-surface hover:scale-105 active:scale-95"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                        {messages.length === 0 && (
                            <div className="text-center text-on-surface-variant text-sm mt-8 space-y-2">
                                <span
                                    className="material-symbols-outlined text-4xl block"
                                    style={{ fontVariationSettings: 'FILL 1' }}
                                >
                                    auto_awesome
                                </span>
                                <p className="font-medium">How can I help?</p>
                                <p className="text-xs">Ask me anything about your workspace, documents, or tasks.</p>
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
                            >
                                <div
                                    className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                        msg.role === 'user'
                                            ? 'bg-secondary text-on-secondary rounded-br-none'
                                            : 'bg-surface-container-high text-on-surface rounded-bl-none border border-outline-variant/10'
                                    }`}
                                >
                                    {msg.role === 'assistant' ? (
                                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-surface-container-highest prose-pre:border prose-pre:border-outline-variant/20">
                                            <ReactMarkdown>{msg.content || '...'}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <span className="whitespace-pre-wrap leading-relaxed">{msg.content}</span>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isStreaming && messages[messages.length - 1]?.content === '' && (
                            <div className="flex justify-start">
                                <div className="bg-surface-container rounded-2xl rounded-bl-sm px-3 py-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
                                </div>
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div className="px-4 py-4 border-t border-outline-variant/30 bg-surface-container-low shadow-inner">
                        <div className="relative group">
                            <div className="flex items-end gap-2 bg-surface-container-lowest rounded-2xl px-3 py-3 border border-outline-variant shadow-lg shadow-black/5 group-focus-within:border-secondary/50 group-focus-within:ring-4 group-focus-within:ring-secondary/10 transition-all duration-300">
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask anything..."
                                    rows={1}
                                    className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 resize-none outline-none max-h-48 py-1"
                                    style={{ fieldSizing: 'content' } as React.CSSProperties}
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={!input.trim() || isStreaming}
                                    className="p-2 rounded-xl bg-secondary text-on-secondary disabled:opacity-30 hover:opacity-90 hover:scale-105 active:scale-95 transition-all flex-shrink-0 shadow-md shadow-secondary/20"
                                >
                                    {isStreaming ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
