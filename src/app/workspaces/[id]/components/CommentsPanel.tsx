'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useI18n } from '@/i18n/I18nProvider'

interface Comment {
    id: string
    content: string
    createdAt: string
    user: {
        id: string
        name: string | null
        email: string
    }
    replies?: Comment[]
}

export default function CommentsPanel() {
    const { t } = useI18n()
    const params = useParams()
    const [comments, setComments] = useState<Comment[]>([])
    const [newComment, setNewComment] = useState('')
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        fetchComments()
    }, [params.id])

    const fetchComments = async () => {
        try {
            const response = await fetch(`/api/workspaces/${params.id}/comments`)
            const data = await response.json()
            if (response.ok) {
                setComments(data.comments || [])
            }
        } catch (error) {
            console.error('Error fetching comments:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newComment.trim()) return

        try {
            const response = await fetch(`/api/workspaces/${params.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: newComment,
                    pageId: null, // Workspace-level comment
                    blockId: null,
                }),
            })

            const data = await response.json()
            if (response.ok) {
                setComments([data.comment, ...comments])
                setNewComment('')
            }
        } catch (error) {
            console.error('Error adding comment:', error)
        }
    }

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

        if (seconds < 60) return t('workspaces.justNow')
        if (seconds < 3600) return t('workspaces.minutesAgo', { count: Math.floor(seconds / 60) })
        if (seconds < 86400) return t('workspaces.hoursAgo', { count: Math.floor(seconds / 3600) })
        return t('workspaces.daysAgo', { count: Math.floor(seconds / 86400) })
    }

    return (
        <aside className="w-80 border-l border-slate-100 hidden xl:flex flex-col bg-slate-50 p-6 space-y-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">{t('workspaces.commentsHeading')}</h3>
                <span className="material-symbols-outlined text-sm text-on-surface-variant cursor-pointer">filter_list</span>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12 text-on-surface-variant">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
                </div>
            ) : comments.length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant">
                    <p className="text-sm">{t('workspaces.noCommentsYet')}</p>
                    <p className="text-xs mt-2">{t('workspaces.beFirstToComment')}</p>
                </div>
            ) : (
                comments.map((comment) => (
                    <div
                        key={comment.id}
                        className={`bg-white p-4 rounded-lg shadow-sm border ${
                            comment.replies && comment.replies.length > 0
                                ? 'border-l-4 border-secondary shadow-md'
                                : 'border-outline-variant/10'
                        } space-y-3`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-white text-xs font-bold">
                                    {comment.user.name?.charAt(0).toUpperCase() || comment.user.email.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs font-bold text-on-surface">
                                    {comment.user.name || comment.user.email}
                                </span>
                            </div>
                            <span className="text-[10px] text-on-surface-variant">
                                {formatTimeAgo(comment.createdAt)}
                            </span>
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            {comment.content}
                        </p>
                        <div className="flex items-center space-x-3">
                            <button className="text-[10px] font-bold text-secondary uppercase tracking-tight">
                                {t('workspaces.reply')}
                            </button>
                            <button className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tight">
                                {t('workspaces.resolve')}
                            </button>
                        </div>

                        {/* Replies */}
                        {comment.replies && comment.replies.length > 0 && (
                            <div className="pl-4 border-l-2 border-surface-container-high py-2 mt-2 space-y-3">
                                {comment.replies.map((reply) => (
                                    <div key={reply.id} className="space-y-2">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant text-[10px] font-bold">
                                                {reply.user.name?.charAt(0).toUpperCase() || reply.user.email.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-[10px] font-bold">
                                                {reply.user.name || reply.user.email}
                                            </span>
                                            <span className="text-[10px] text-on-surface-variant">
                                                {formatTimeAgo(reply.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-on-surface leading-relaxed pl-7">
                                            {reply.content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))
            )}

            <div className="mt-auto pt-6 border-t border-slate-200">
                <form onSubmit={handleAddComment} className="relative">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="w-full bg-white border border-outline-variant/30 rounded-lg p-3 text-xs focus:ring-1 focus:ring-secondary focus:border-secondary outline-none resize-none"
                        placeholder={t('workspaces.addCommentPlaceholder')}
                        rows={3}
                    />
                    <button
                        type="submit"
                        className="absolute bottom-2 right-2 text-secondary hover:opacity-80 transition-opacity"
                    >
                        <span className="material-symbols-outlined text-lg">send</span>
                    </button>
                </form>
            </div>
        </aside>
    )
}
