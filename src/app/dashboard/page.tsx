'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/i18n/I18nProvider'
import { TrendingUp, Clock, AlertCircle, FileText as FileTextIcon } from 'lucide-react'
import { cachedJson, invalidateCached } from '@/lib/client-cache'

interface Workspace {
    id: string
    name: string
    description: string | null
    icon: string | null
    _count: {
        pages: number
    }
    updatedAt: string
}

interface RecentActivity {
    id: string
    type: 'page_created' | 'page_updated' | 'workspace_created'
    title: string
    timestamp: string
    workspaceName: string
}

interface BillingAnalytics {
    totalRevenue: number
    pendingAmount: number
    overdueAmount: number
    counts: {
        total: number
        draft: number
        sent: number
        partially_paid: number
        paid: number
        overdue: number
    }
}

export default function DashboardPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { setWorkspace } = useAppStore()
    const { t, locale, formatNumber } = useI18n()

    const [workspaces, setWorkspaces] = useState<Workspace[]>([])
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
    const [billingAnalytics, setBillingAnalytics] = useState<BillingAnalytics | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false)
    const [newWorkspaceName, setNewWorkspaceName] = useState('')
    const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [quickCaptureText, setQuickCaptureText] = useState('')
    const [quickCaptureWorkspaceId, setQuickCaptureWorkspaceId] = useState('')

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
        }
    }, [status, router])

    useEffect(() => {
        if (session) {
            fetchWorkspaces()
            fetchRecentActivity()
        }
    }, [session])

    const fetchWorkspaces = async () => {
        try {
            const data = await cachedJson('/api/workspaces')
            const ws: Workspace[] = data.workspaces || []
            setWorkspaces(ws)
            // Load analytics once we have the first workspace id
            if (ws.length > 0) {
                setQuickCaptureWorkspaceId(ws[0].id)
                try {
                    const res = await fetch(`/api/invoices?workspaceId=${ws[0].id}&limit=1`)
                    if (res.ok) {
                        const invoiceData = await res.json()
                        if (invoiceData.analytics) setBillingAnalytics(invoiceData.analytics)
                    }
                } catch {
                    // non-critical
                }
            }
        } catch (error) {
            console.error('Error fetching workspaces:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchRecentActivity = async () => {
        try {
            const response = await fetch('/api/pages?limit=5&sort=updatedAt')
            const data = await response.json()
            const activities: RecentActivity[] = (data.pages || []).map((page: any) => ({
                id: page.id,
                type: 'page_updated',
                title: page.title,
                timestamp: page.updatedAt,
                workspaceName: page.workspace?.name || t('dashboard.unknownWorkspace'),
            }))
            setRecentActivity(activities)
        } catch (error) {
            console.error('Error fetching recent activity:', error)
        }
    }

    const handleCreateWorkspace = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newWorkspaceName.trim()) return

        try {
            const response = await fetch('/api/workspaces', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newWorkspaceName,
                    description: newWorkspaceDescription,
                }),
            })

            if (response.ok) {
                invalidateCached('/api/workspaces')
                const data = await response.json()
                setWorkspaces([...workspaces, data.workspace])
                setNewWorkspaceName('')
                setNewWorkspaceDescription('')
                setShowNewWorkspaceModal(false)

                if (!quickCaptureWorkspaceId) setQuickCaptureWorkspaceId(data.workspace.id)

                // Add activity
                setRecentActivity([
                    {
                        id: Date.now().toString(),
                        type: 'workspace_created',
                        title: data.workspace.name,
                        timestamp: new Date().toISOString(),
                        workspaceName: data.workspace.name,
                    },
                    ...recentActivity,
                ])
            }
        } catch (error) {
            console.error('Error creating workspace:', error)
        }
    }

    const handleQuickCapture = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!quickCaptureText.trim() || !quickCaptureWorkspaceId) return

        try {
            const response = await fetch('/api/pages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: quickCaptureText,
                    workspaceId: quickCaptureWorkspaceId,
                }),
            })

            if (response.ok) {
                setQuickCaptureText('')
                fetchRecentActivity()
            }
        } catch (error) {
            console.error('Error creating quick capture:', error)
        }
    }

    const handleWorkspaceClick = (workspaceId: string) => {
        setWorkspace(workspaceId)
    }

    const filteredWorkspaces = workspaces.filter((workspace) =>
        workspace.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return t('dashboard.justNow')
        if (diffMins < 60) return t('dashboard.minutesAgo', { mins: diffMins })
        if (diffHours < 24) return t('dashboard.hoursAgo', { hours: diffHours })
        if (diffDays < 7) return t('dashboard.daysAgo', { days: diffDays })
        return date.toLocaleDateString(locale)
    }

    if (status === 'loading' || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-on-surface-variant"></div>
            </div>
        )
    }

    return (
        <AppShell>
            <div className="max-w-4xl mx-auto px-6 py-12 pb-24">
                
                {/* Header Section */}
                <div className="mb-10">
                    <h1 className="text-3xl font-bold text-on-surface mb-2">
                        {session?.user?.name?.split(' ')[0]
                            ? t('dashboard.greeting', { name: session.user.name.split(' ')[0] })
                            : t('dashboard.greetingNoName')}
                    </h1>
                </div>

                {/* Top Section: Quick Actions & Search */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                    {/* Search */}
                    <div className="relative flex items-center bg-transparent border border-outline-variant/30 rounded-xl overflow-hidden focus-within:border-on-surface-variant transition-colors hover:border-outline-variant shadow-sm h-12">
                        <span className="material-symbols-outlined text-on-surface-variant pl-4 pointer-events-none">search</span>
                        <input
                            type="text"
                            placeholder={t('dashboard.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 h-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
                        />
                    </div>

                    {/* Quick Capture */}
                    <div className="relative flex items-center bg-transparent border border-outline-variant/30 rounded-xl overflow-hidden focus-within:border-on-surface-variant transition-colors hover:border-outline-variant shadow-sm h-12">
                        <span className="material-symbols-outlined text-on-surface-variant pl-4 pointer-events-none">add_circle</span>
                        <form onSubmit={handleQuickCapture} className="flex-1 flex h-full">
                            <input
                                type="text"
                                placeholder={t('dashboard.quickCapturePlaceholder')}
                                value={quickCaptureText}
                                onChange={(e) => setQuickCaptureText(e.target.value)}
                                className="w-full px-3 h-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
                                disabled={workspaces.length === 0}
                            />
                            {workspaces.length > 0 && (
                                <select 
                                    value={quickCaptureWorkspaceId}
                                    onChange={(e) => setQuickCaptureWorkspaceId(e.target.value)}
                                    className="px-3 bg-transparent text-xs font-medium text-on-surface-variant border-l border-outline-variant/30 focus:outline-none cursor-pointer appearance-none hover:bg-surface-container-low transition-colors outline-none"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 0.5rem center',
                                        backgroundSize: '1.2em',
                                        paddingRight: '2rem'
                                    }}
                                >
                                    {workspaces.map(ws => (
                                        <option key={ws.id} value={ws.id}>{ws.name}</option>
                                    ))}
                                </select>
                            )}
                            <button type="submit" className="hidden"></button>
                        </form>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    
                    {/* Left Column: Recent Activity & Billing */}
                    <div className="col-span-1 lg:col-span-2 flex flex-col gap-12">
                        
                        {/* Recently Visited / Activity */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-on-surface-variant text-base">history</span>
                                <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{t('dashboard.recentlyUpdated')}</h2>
                            </div>
                            
                            {recentActivity.length > 0 ? (
                                <div className="space-y-1">
                                    {recentActivity.map((activity) => (
                                        <div
                                            key={activity.id}
                                            className="group flex items-center justify-between py-2.5 px-3 -mx-3 rounded-lg hover:bg-surface-container-low transition-colors"
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <span className="material-symbols-outlined text-on-surface-variant/70 text-lg group-hover:text-on-surface transition-colors flex-shrink-0">
                                                    {activity.type === 'page_created' ? 'docs_add_on' : 'description'}
                                                </span>
                                                <div className="flex flex-col overflow-hidden">
                                                    <p className="text-sm font-medium text-on-surface truncate group-hover:text-secondary transition-colors cursor-pointer leading-tight">
                                                        {activity.title}
                                                    </p>
                                                    <p className="text-xs text-on-surface-variant/70 truncate flex items-center gap-1 mt-0.5">
                                                        <span>{activity.workspaceName}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-xs text-on-surface-variant/50 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                                {formatTimestamp(activity.timestamp)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-6 text-sm text-on-surface-variant/60 flex items-center gap-2">
                                    {t('dashboard.noRecentActivity')}
                                </div>
                            )}
                        </div>

                        {/* Minimalist Billing KPIs */}
                        {billingAnalytics && (
                             <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-on-surface-variant text-base">account_balance_wallet</span>
                                        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{t('dashboard.invoicesOverview')}</h2>
                                    </div>
                                    <Link href="/invoices" className="text-[10px] bg-surface-container hover:bg-surface-container-high py-1 px-2 rounded-md text-on-surface-variant cursor-pointer transition-colors flex items-center gap-1 font-medium">
                                        {t('dashboard.openFull')} <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                    </Link>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 border border-outline-variant/20 rounded-xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-outline-variant/20 bg-surface-container-lowest/50">
                                    <div className="p-4 bg-transparent hover:bg-surface-container-low/50 transition-colors">
                                        <p className="text-xs text-on-surface-variant mb-1.5 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-success"/> {t('dashboard.revenue')}</p>
                                        <p className="text-xl font-semibold text-on-surface">
                                            {formatNumber(billingAnalytics.totalRevenue, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-transparent hover:bg-surface-container-low/50 transition-colors">
                                        <p className="text-xs text-on-surface-variant mb-1.5 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-warning"/> {t('dashboard.pending')}</p>
                                        <p className="text-xl font-semibold text-on-surface">
                                            {formatNumber(billingAnalytics.pendingAmount, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-transparent hover:bg-surface-container-low/50 transition-colors">
                                        <p className="text-xs text-on-surface-variant mb-1.5 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-error"/> {t('dashboard.overdue')}</p>
                                        <p className="text-xl font-semibold text-on-surface">
                                            {formatNumber(billingAnalytics.overdueAmount, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-transparent hover:bg-surface-container-low/50 transition-colors">
                                        <p className="text-xs text-on-surface-variant mb-1.5 flex items-center gap-1.5"><FileTextIcon className="w-3.5 h-3.5 text-secondary"/> {t('dashboard.totalInvoices')}</p>
                                        <p className="text-xl font-semibold text-on-surface">{billingAnalytics.counts.total}</p>
                                    </div>
                                </div>
                             </div>
                        )}
                        
                    </div>

                    {/* Right Column: Workspaces */}
                    <div className="col-span-1 border-t lg:border-t-0 lg:border-l border-outline-variant/10 pt-8 lg:pt-0 lg:pl-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-on-surface-variant text-base">grid_view</span>
                                <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{t('dashboard.workspaces')}</h2>
                            </div>
                            <button
                                onClick={() => setShowNewWorkspaceModal(true)}
                                className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-sm hover:bg-surface-container-low"
                            >
                                <span className="material-symbols-outlined text-[17px]">add</span>
                            </button>
                        </div>
                        
                        {filteredWorkspaces.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                                {filteredWorkspaces.map((workspace) => (
                                    <Link
                                        key={workspace.id}
                                        href={`/workspaces/${workspace.id}`}
                                        onClick={() => handleWorkspaceClick(workspace.id)}
                                        className="group flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-surface-container-low transition-colors"
                                    >
                                        <div className="w-6 h-6 rounded bg-surface-container flex items-center justify-center text-[11px] font-medium text-on-surface shadow-sm">
                                            {workspace.icon || workspace.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 flex justify-between items-center overflow-hidden">
                                            <span className="text-sm font-medium text-on-surface truncate">
                                                {workspace.name}
                                            </span>
                                            <span className="text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                {workspace._count.pages}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="py-4 border border-dashed border-outline-variant/30 rounded-lg text-center flex flex-col items-center gap-2 bg-surface-container-lowest/50">
                                <span className="material-symbols-outlined text-on-surface-variant/40 text-xl">folder_open</span>
                                <p className="text-xs text-on-surface-variant">{t('dashboard.noWorkspaces')}</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Subtle Modal - mimicking Notion's command menus */}
            {showNewWorkspaceModal && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
                    <div
                        className="absolute inset-0 bg-black/5 backdrop-blur-[2px] transition-opacity"
                        onClick={() => setShowNewWorkspaceModal(false)}
                    ></div>
                    <div className="relative bg-surface-container-lowest rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-full max-w-[400px] border border-outline-variant/20 overflow-hidden mix-card p-0 animate-in fade-in slide-in-from-bottom-4 duration-200">
                        <div className="px-5 py-3 border-b border-outline-variant/10">
                            <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{t('dashboard.createWorkspaceModalTitle')}</h2>
                        </div>
                        <form onSubmit={handleCreateWorkspace} className="p-5">
                            <div className="space-y-4">
                                <div>
                                    <input
                                        type="text"
                                        value={newWorkspaceName}
                                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                                        className="w-full text-base bg-transparent border-b border-transparent hover:border-outline-variant/30 focus:border-secondary focus:outline-none transition-colors pb-1 placeholder:text-on-surface-variant/40 font-medium"
                                        placeholder={t('dashboard.workspaceNamePlaceholder')}
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <textarea
                                        value={newWorkspaceDescription}
                                        onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                                        className="w-full text-sm bg-transparent border-b border-transparent hover:border-outline-variant/30 focus:border-secondary focus:outline-none transition-colors pb-1 placeholder:text-on-surface-variant/40 resize-none"
                                        placeholder={t('dashboard.workspaceDescriptionPlaceholder')}
                                        rows={2}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowNewWorkspaceModal(false)}
                                    className="px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low border border-transparent hover:border-outline-variant/20 rounded transition-all"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newWorkspaceName.trim()}
                                    className="px-3 py-1.5 text-xs font-medium bg-on-surface text-surface-container-lowest rounded hover:bg-on-surface/90 shadow-sm transition-all disabled:opacity-30"
                                >
                                    {t('common.create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppShell>
    )
}
