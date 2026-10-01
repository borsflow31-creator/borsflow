'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { X, Send, Loader2, Check, AlertCircle, ExternalLink } from 'lucide-react'
import { errorFrom } from '@/lib/products'
import { readAgentStream } from '@/lib/ai/client'
import { useI18n } from '@/i18n/I18nProvider'

interface ToolStatus {
    id: string
    label: string
    done: boolean
    ok: boolean
    link?: { label: string; url: string }
}

interface Message {
    role: 'user' | 'assistant'
    content: string
    tools?: ToolStatus[]
    /** Credits the reply cost, once known. */
    credits?: number
    error?: string
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
    const { t } = useI18n()
    const abortRef = useRef<AbortController | null>(null)
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

    // Closing the panel stops a reply in progress; the server bills only what
    // was generated.
    useEffect(() => {
        if (!isOpen) abortRef.current?.abort()
    }, [isOpen])

    const updateLast = (update: (message: Message) => Message) => {
        setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = update(updated[updated.length - 1])
            return updated
        })
    }

    const sendMessage = async () => {
        const trimmed = input.trim()
        if (!trimmed || isStreaming) return

        if (!workspaceId) {
            setMessages(prev => [
                ...prev,
                { role: 'user', content: trimmed },
                { role: 'assistant', content: '', error: 'Open a workspace to use the assistant.' },
            ])
            setInput('')
            return
        }

        const userMsg: Message = { role: 'user', content: trimmed }
        const assistantMsg: Message = { role: 'assistant', content: '', tools: [] }

        setMessages(prev => [...prev, userMsg, assistantMsg])
        setInput('')
        setIsStreaming(true)

        const abort = new AbortController()
        abortRef.current = abort

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: abort.signal,
                body: JSON.stringify({
                    // Failed replies carry no content and are left out of the history.
                    messages: [...messages, userMsg]
                        .filter(m => m.content.trim())
                        .map(m => ({ role: m.role, content: m.content })),
                    context,
                    workspaceId,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                }),
            })

            if (!res.ok || !res.body) {
                const error = await errorFrom(res, 'Sorry, something went wrong. Please try again.')
                updateLast(m => ({ ...m, error }))
                return
            }

            await readAgentStream(res, event => {
                switch (event.t) {
                    case 'text':
                        updateLast(m => ({ ...m, content: m.content + event.v }))
                        break
                    case 'tool':
                        updateLast(m => ({
                            ...m,
                            tools: [...(m.tools ?? []), { id: event.id, label: event.label, done: false, ok: false }],
                        }))
                        break
                    case 'tool_done':
                        updateLast(m => ({
                            ...m,
                            tools: (m.tools ?? []).map(t =>
                                t.id === event.id ? { ...t, done: true, ok: event.ok, link: event.link } : t
                            ),
                        }))
                        break
                    case 'error':
                        updateLast(m => ({ ...m, error: event.message }))
                        break
                    case 'done':
                        updateLast(m => ({ ...m, credits: event.credits }))
                        break
                }
            })
        } catch {
            if (!abort.signal.aborted) {
                updateLast(m => ({ ...m, error: 'Sorry, something went wrong. Please try again.' }))
            }
        } finally {
            abortRef.current = null
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
                                <p className="font-medium">{t('ai.chat.heading')}</p>
                                <p className="text-xs">{t('ai.chat.subheading')}</p>
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
                                        <div className="space-y-2">
                                            {msg.tools && msg.tools.length > 0 && (
                                                <ul className="flex flex-wrap gap-1.5">
                                                    {msg.tools.map(tool => (
                                                        <li
                                                            key={tool.id}
                                                            className="inline-flex items-center gap-1 rounded-full bg-surface-container-highest px-2 py-0.5 text-[11px] text-on-surface-variant"
                                                        >
                                                            {!tool.done ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : tool.ok ? (
                                                                <Check className="h-3 w-3 text-secondary" />
                                                            ) : (
                                                                <AlertCircle className="h-3 w-3 text-error" />
                                                            )}
                                                            {tool.label}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            {(msg.content || (!msg.error && !msg.tools?.length)) && (
                                                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-surface-container-highest prose-pre:border prose-pre:border-outline-variant/20">
                                                    <ReactMarkdown
                                                        components={{
                                                            a: ({ href, children }) =>
                                                                href?.startsWith('/') ? (
                                                                    <Link href={href} onClick={onClose}>{children}</Link>
                                                                ) : (
                                                                    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                                                                ),
                                                        }}
                                                    >
                                                        {msg.content || '...'}
                                                    </ReactMarkdown>
                                                </div>
                                            )}
                                            {msg.tools?.some(t => t.link) && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {msg.tools.filter(t => t.link).map(tool => (
                                                        <Link
                                                            key={tool.id}
                                                            href={tool.link!.url}
                                                            onClick={onClose}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/30 px-2 py-1 text-xs font-medium text-secondary hover:bg-surface-container-highest"
                                                        >
                                                            <ExternalLink className="h-3 w-3" />
                                                            {tool.link!.label}
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                            {msg.error && (
                                                <p role="alert" className="flex items-start gap-1.5 text-xs text-error">
                                                    <AlertCircle className="h-3.5 w-3.5 mt-px flex-shrink-0" />
                                                    {msg.error}
                                                </p>
                                            )}
                                            {msg.credits !== undefined && msg.credits > 0 && (
                                                <p className="text-[11px] text-on-surface-variant/70">
                                                    {msg.credits} AI credit{msg.credits === 1 ? '' : 's'}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="whitespace-pre-wrap leading-relaxed">{msg.content}</span>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isStreaming && messages[messages.length - 1]?.content === '' && !messages[messages.length - 1]?.tools?.length && (
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
                                    placeholder={t('ai.chat.placeholder')}
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
