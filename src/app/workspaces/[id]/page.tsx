'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import TopNavigationBar from './components/TopNavigationBar'
import FloatingAIToolbar from './components/FloatingAIToolbar'
import CommentsPanel from './components/CommentsPanel'
import { Search, Plus, FileText, ChevronRight, ChevronDown, Layout } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/i18n/I18nProvider'

interface Page {
    id: string
    title: string
    icon: string | null
    children: Page[]
    parentId: string | null
}

interface WorkspaceMember {
    id: string
    role: string
    user: {
        id: string
        name: string | null
        email: string
    }
}

interface Workspace {
    id: string
    name: string
    description: string | null
    icon: string | null
    pages: Page[]
    members?: WorkspaceMember[]
}

interface TreeNodeProps {
    page: Page
    level: number
    expandedPages: Set<string>
    toggleExpand: (pageId: string) => void
    searchQuery: string
    activePageId: string | null
}

function TreeNode({ page, level, expandedPages, toggleExpand, searchQuery, activePageId }: TreeNodeProps) {
    const hasChildren = page.children && page.children.length > 0
    const isExpanded = expandedPages.has(page.id)
    const isActive = activePageId === page.id

    return (
        <div className="select-none">
            <div
                className={`flex items-center gap-2 px-3 py-2 rounded transition-colors cursor-pointer
                    ${isActive
                        ? 'bg-surface-container-highest text-secondary border-l-2 border-secondary'
                        : 'text-on-surface-variant hover:bg-surface-container-low'
                    }`}
                style={{ paddingLeft: `${level * 16 + 12}px` }}
            >
                {hasChildren ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            toggleExpand(page.id)
                        }}
                        className="p-0.5 rounded hover:bg-surface-container-highest transition-colors"
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </button>
                ) : (
                    <div className="w-5" />
                )}
                {page.icon ? (
                    <span className="text-sm">{page.icon}</span>
                ) : (
                    <FileText className="h-4 w-4" />
                )}
                <span className="text-sm font-medium truncate flex-1">{page.title}</span>
            </div>
            {hasChildren && isExpanded && (
                <div>
                    {page.children.map((child) => (
                        <TreeNode
                            key={child.id}
                            page={child}
                            level={level + 1}
                            expandedPages={expandedPages}
                            toggleExpand={toggleExpand}
                            searchQuery={searchQuery}
                            activePageId={activePageId}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export default function WorkspacePage() {
    const { t } = useI18n()
    const { data: session, status } = useSession()
    const router = useRouter()
    const params = useParams()
    const { currentWorkspaceId, setWorkspace, currentPageId } = useAppStore()

    const [workspace, setWorkspaceState] = useState<Workspace | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [showNewPage, setShowNewPage] = useState(false)
    const [newPageTitle, setNewPageTitle] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set())
    const [createError, setCreateError] = useState<string | null>(null)
    const [selectedText, setSelectedText] = useState('')
    const [aiResultToast, setAiResultToast] = useState<string | null>(null)

    const handleSelectionChange = useCallback(() => {
        const sel = window.getSelection()
        setSelectedText(sel?.toString().trim() ?? '')
    }, [])

    useEffect(() => {
        document.addEventListener('selectionchange', handleSelectionChange)
        return () => document.removeEventListener('selectionchange', handleSelectionChange)
    }, [handleSelectionChange])

    const handleAiResult = useCallback((result: string) => {
        navigator.clipboard.writeText(result).catch(() => {})
        setAiResultToast(t('workspaces.aiResultCopied'))
        setTimeout(() => setAiResultToast(null), 3000)
    }, [t])

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
        }
    }, [status, router])

    useEffect(() => {
        if (session && params.id) {
            setWorkspace(params.id as string)
            fetchWorkspace()
        }
    }, [session, params.id, setWorkspace])

    const fetchWorkspace = async () => {
        try {
            const response = await fetch(`/api/workspaces/${params.id}`)
            const data = await response.json()
            setWorkspaceState(data.workspace)

            // Expand all pages by default when loading
            if (data.workspace?.pages) {
                const allPageIds = new Set<string>()
                const collectIds = (pages: Page[]) => {
                    pages.forEach(page => {
                        allPageIds.add(page.id)
                        if (page.children) {
                            collectIds(page.children)
                        }
                    })
                }
                collectIds(data.workspace.pages)
                setExpandedPages(allPageIds)
            }
        } catch (error) {
            console.error('Error fetching workspace:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleCreatePage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newPageTitle.trim()) return

        setCreateError(null)

        try {
            const response = await fetch('/api/pages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: newPageTitle,
                    workspaceId: params.id,
                }),
            })

            const data = await response.json()

            if (response.ok) {
                await fetchWorkspace()
                setNewPageTitle('')
                setShowNewPage(false)
            } else {
                setCreateError(data.error || t('workspaces.createPageError'))
            }
        } catch (error) {
            console.error('Error creating page:', error)
            setCreateError(t('workspaces.createPageGenericError'))
        }
    }

    const toggleExpand = (pageId: string) => {
        setExpandedPages(prev => {
            const newSet = new Set(prev)
            if (newSet.has(pageId)) {
                newSet.delete(pageId)
            } else {
                newSet.add(pageId)
            }
            return newSet
        })
    }

    const filterPages = (pages: Page[], query: string): Page[] => {
        if (!query) return pages
        return pages
            .filter((page) =>
                page.title.toLowerCase().includes(query.toLowerCase())
            )
            .map((page) => ({
                ...page,
                children: filterPages(page.children, query),
            }))
    }

    if (status === 'loading' || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary"></div>
            </div>
        )
    }

    if (!workspace) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <Layout className="h-16 w-16 text-on-surface-variant mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-on-surface mb-2">
                        {t('workspaces.notFoundTitle')}
                    </h3>
                    <Link
                        href="/dashboard"
                        className="text-secondary hover:text-secondary-dim"
                    >
                        {t('workspaces.backToDashboard')}
                    </Link>
                </div>
            </div>
        )
    }

    const filteredPages = filterPages(workspace.pages, searchQuery)

    return (
        <AppShell
            workspace={{
                id: workspace.id,
                name: workspace.name,
                icon: workspace.icon || undefined,
            }}
            currentPage={currentPageId ? { id: currentPageId, title: '' } : undefined}
        >
            <div className="flex h-full">
                {/* Page Tree Sidebar */}
                <aside className="w-80 flex-shrink-0 bg-surface-container-low border-r border-outline-variant/15 flex flex-col">
                    {/* Search */}
                    <div className="p-4 border-b border-outline-variant/15">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
                            <input
                                type="text"
                                placeholder={t('workspaces.searchPagesPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-surface-container-high rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                            />
                        </div>
                    </div>

                    {/* Page Tree */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        {filteredPages.length > 0 ? (
                            filteredPages.map((page) => (
                                <Link
                                    key={page.id}
                                    href={`/pages/${page.id}`}
                                >
                                    <TreeNode
                                        page={page}
                                        level={0}
                                        expandedPages={expandedPages}
                                        toggleExpand={toggleExpand}
                                        searchQuery={searchQuery}
                                        activePageId={currentPageId}
                                    />
                                </Link>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
                                <FileText className="h-12 w-12 mb-4 opacity-50" />
                                <p className="text-sm">{t('workspaces.noPagesFound')}</p>
                            </div>
                        )}
                    </div>

                    {/* New Page Button */}
                    <div className="p-4 border-t border-outline-variant/15">
                        <button
                            onClick={() => setShowNewPage(!showNewPage)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-on-secondary rounded hover:bg-secondary-dim transition-colors"
                        >
                            <Plus className="h-5 w-5" />
                            <span className="text-sm font-medium">{t('workspaces.newPage')}</span>
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 flex overflow-hidden">
                    {/* Document Editor Area */}
                    <section className="flex-1 bg-surface-bright overflow-y-auto custom-scrollbar px-4 md:px-12 lg:px-24 py-16">
                        {/* Top Navigation Bar */}
                        <TopNavigationBar workspaceName={workspace.name} members={workspace.members ?? []} />

                        <div className="bg-surface-container-lowest rounded-xl p-12 min-h-[1200px] relative mt-14 max-w-4xl">
                            {/* Page Breadcrumbs */}
                            <div className="mb-10 text-on-surface-variant text-xs tracking-widest uppercase">
                                {t('workspaces.breadcrumb', { name: workspace.name })}
                            </div>

                            {/* New Page Form */}
                            {showNewPage && (
                                <div className="bg-surface-container-low rounded-lg p-6 mb-8">
                                    <form onSubmit={handleCreatePage}>
                                        {createError && (
                                            <div className="mb-4 p-3 bg-error-container text-on-error-container rounded-lg text-sm">
                                                {createError}
                                            </div>
                                        )}
                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                placeholder={t('workspaces.pageTitlePlaceholder')}
                                                value={newPageTitle}
                                                onChange={(e) => {
                                                    setNewPageTitle(e.target.value)
                                                    setCreateError(null)
                                                }}
                                                className="flex-1 px-4 py-3 bg-surface-container-high rounded text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                                autoFocus
                                            />
                                            <button
                                                type="submit"
                                                className="px-4 py-1.5 bg-secondary text-on-secondary text-sm font-medium rounded transition-all hover:opacity-80"
                                            >
                                                {t('common.create')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowNewPage(false)
                                                    setCreateError(null)
                                                }}
                                                className="px-4 py-1.5 bg-primary-container text-on-primary-container text-sm font-medium rounded transition-all hover:opacity-80"
                                            >
                                                {t('common.cancel')}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Workspace Title */}
                            <h1 className="text-[2.75rem] font-black tracking-tighter leading-tight mb-6 text-on-surface">
                                {workspace.name}
                            </h1>

                            {/* Description */}
                            <div className="relative group mb-10">
                                <p className="text-[1rem] leading-[1.6] text-on-surface-variant">
                                    {workspace.description || t('workspaces.defaultDescription')}
                                </p>
                            </div>

                            {/* Pages List */}
                            {filteredPages.length > 0 ? (
                                <ul className="space-y-2">
                                    {filteredPages.map((page) => (
                                        <li key={page.id} className="relative group">
                                            <div className="absolute -left-8 opacity-0 group-hover:opacity-100 text-outline-variant transition-opacity cursor-grab flex items-center h-full top-0">
                                                <span className="text-sm select-none">⠿</span>
                                            </div>
                                            <Link
                                                href={`/pages/${page.id}`}
                                                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-surface-container-low transition-colors"
                                            >
                                                {page.icon ? (
                                                    <span className="text-lg flex-shrink-0">{page.icon}</span>
                                                ) : (
                                                    <FileText className="h-5 w-5 text-on-surface-variant flex-shrink-0" />
                                                )}
                                                <span className="flex-1 text-sm font-medium text-on-surface">{page.title}</span>
                                                {page.children && page.children.length > 0 && (
                                                    <span className="text-[10px] text-on-surface-variant uppercase tracking-wide">
                                                        {t('workspaces.subPagesCount', { count: page.children.length })}
                                                    </span>
                                                )}
                                                <ChevronRight className="h-4 w-4 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                !showNewPage && (
                                    <button
                                        onClick={() => setShowNewPage(true)}
                                        className="px-4 py-1.5 bg-secondary text-on-secondary text-sm font-medium rounded transition-all hover:opacity-80"
                                    >
                                        {t('workspaces.createFirstPage')}
                                    </button>
                                )
                            )}
                        </div>
                    </section>

                    {/* Right Side Comments Panel */}
                    <CommentsPanel />
                </main>
            </div>

            {/* Floating AI Toolbar */}
            {selectedText && <FloatingAIToolbar selectedText={selectedText} onResult={handleAiResult} />}

            {/* AI Result Toast */}
            {aiResultToast && (
                <div className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface text-sm px-4 py-2 rounded-full shadow-lg border border-outline-variant/20 z-50">
                    {aiResultToast}
                </div>
            )}
        </AppShell>
    )
}
