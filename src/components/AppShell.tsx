'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Search, X, Menu, X as CloseIcon, Plus,
    Home, FileText, Columns, Users, Settings,
    FileText as QuoteIcon, DollarSign, Loader2,
    Mail, ChevronRight, PanelLeftClose, PanelLeftOpen,
    UserPlus, CalendarDays, MessageSquare, Moon, Sun, LogOut, Package,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useSession, signOut } from 'next-auth/react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import Toast from '@/components/Toast';
import NotificationBell from '@/components/notifications/NotificationBell';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import WorkspaceList from '@/components/workspace/WorkspaceList';
import dynamic from 'next/dynamic';
import {
    respondToInvitation,
    type PendingInvitation,
} from '@/lib/invitations-client';
import { cachedJson, peekCached, invalidateCached } from '@/lib/client-cache';
import { Workspace } from '@/types';
import { Role } from '@/lib/workspace';
// Only downloaded when first opened, so they don't weigh on every page load.
const CreateWorkspaceModal    = dynamic(() => import('@/components/workspace/CreateWorkspaceModal'), { ssr: false });
const InviteUsersModal        = dynamic(() => import('@/components/workspace/InviteUsersModal'), { ssr: false });
const PendingInvitationsModal = dynamic(() => import('@/components/workspace/PendingInvitationsModal'), { ssr: false });
const AIChatPanel             = dynamic(() => import('@/components/AIChatPanel'), { ssr: false });

const WORKSPACES_URL   = '/api/workspaces';
const INVITATIONS_URL  = '/api/invitations/pending';
const workspaceUrl = (id: string) => `/api/workspaces/${id}`;

/* ─── Nav config ─────────────────────────────────────────── */
const NAV_GROUPS: { labelKey: MessageKey; items: { labelKey: MessageKey; href: string; icon: typeof Home; basePath: string }[] }[] = [
    {
        labelKey: 'nav.groupGeneral',
        items: [
            { labelKey: 'nav.home',   href: '/dashboard',         icon: Home,      basePath: '/dashboard' },
            { labelKey: 'nav.pages',  href: '__workspace__',       icon: FileText,  basePath: '/workspaces' },
            { labelKey: 'nav.kanban',    href: '__kanban__',    icon: Columns,         basePath: '/kanban-board-view' },
            { labelKey: 'nav.chat',      href: '__chat__',      icon: MessageSquare,   basePath: '__chat__' },
        ],
    },
    {
        labelKey: 'nav.groupBusiness',
        items: [
            { labelKey: 'nav.crm',            href: '__crm__',      icon: Users,        basePath: '/crm' },
            { labelKey: 'nav.meetings',       href: '__meetings__', icon: CalendarDays, basePath: '/meetings' },
            { labelKey: 'nav.emailMarketing', href: '/email-marketing', icon: Mail,    basePath: '/email-marketing' },
            { labelKey: 'nav.products',       href: '__products__', icon: Package,      basePath: '/products' },
            { labelKey: 'nav.quotes',         href: '__quotes__',   icon: QuoteIcon,    basePath: '/quotes' },
            { labelKey: 'nav.invoices',       href: '__invoices__', icon: DollarSign,   basePath: '/invoices' },
        ],
    },
];

/* ─── Types ───────────────────────────────────────────────── */
interface AppShellProps {
    children: ReactNode;
    workspace?: { id: string; name: string; icon?: string };
    currentPage?: { id: string; title: string };
    breadcrumbs?: { label: string; href: string }[];
}

/* ─── Helpers ─────────────────────────────────────────────── */
function getInitials(name: string) {
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function resolveHref(
    raw: string,
    workspace: { id: string; name: string; icon?: string } | null,
    firstPageId?: string | null,
    fallbackWorkspaceId?: string | null,
): string {
    if (!workspace) {
        if (raw === '__workspace__') return '/dashboard';
        if (raw === '__kanban__')   return fallbackWorkspaceId ? `/kanban-board-view?workspace=${fallbackWorkspaceId}` : '/kanban-board-view';
        if (raw === '__crm__')      return '/crm';
        if (raw === '__meetings__') return '/meetings';
        if (raw === '__products__') return '/products';
        if (raw === '__quotes__')   return '/quotes';
        if (raw === '__invoices__') return '/invoices';
        if (raw === '__chat__')     return fallbackWorkspaceId ? `/workspaces/${fallbackWorkspaceId}/chat` : '#';
        return raw;
    }
    if (raw === '__workspace__') {
        return firstPageId ? `/pages/${firstPageId}` : `/workspaces/${workspace.id}`;
    }
    if (raw === '__kanban__')    return `/kanban-board-view?workspace=${workspace.id}`;
    if (raw === '__crm__')       return `/crm?workspace=${workspace.id}`;
    if (raw === '__meetings__')  return `/meetings?workspace=${workspace.id}`;
    if (raw === '__products__')  return `/products?workspace=${workspace.id}`;
    if (raw === '__quotes__')    return `/quotes?workspace=${workspace.id}`;
    if (raw === '__invoices__')  return `/invoices?workspace=${workspace.id}`;
    if (raw === '__chat__')      return `/workspaces/${workspace.id}/chat`;
    return raw;
}

/* ─── Component ───────────────────────────────────────────── */
export default function AppShell({
    children,
    workspace,
    currentPage,
    breadcrumbs: explicitBreadcrumbs,
}: AppShellProps) {
    const pathname = usePathname();
    const router   = useRouter();
    const { data: session } = useSession();
    const { t } = useI18n();
    const {
        sidebarOpen, toggleSidebar,
        sidebarCollapsed, toggleSidebarCollapsed,
        currentWorkspaceId, setWorkspace,
        theme, setTheme,
    } = useAppStore();

    const [searchQuery,    setSearchQuery]    = useState('');
    const [showSearch,     setShowSearch]     = useState(false);
    const [searchResults,  setSearchResults]  = useState<{ id: string; title: string; workspaceName: string }[]>([]);
    const [searchLoading,  setSearchLoading]  = useState(false);
    const [showDropdown,   setShowDropdown]   = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const [isMobile,       setIsMobile]       = useState(false);
    const [isCreatingPage, setIsCreatingPage] = useState(false);
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);
    const [toast,          setToast]          = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [workspaces,           setWorkspaces]           = useState<Workspace[]>(() => peekCached<{ workspaces?: Workspace[] }>(WORKSPACES_URL)?.workspaces || []);
    const [isLoadingWorkspaces,  setIsLoadingWorkspaces]  = useState(false);
    const [fetchedWorkspace,     setFetchedWorkspace]     = useState<{
        id: string; name: string; icon?: string;
        ownerId?: string;
        owner?: { id: string; name?: string | null; email?: string | null };
        members?: { userId: string; role: string; user?: { id: string; name?: string | null; email?: string | null } }[];
    } | null>(null);
    const [userRole,             setUserRole]             = useState<Role>('member');

    const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = useState(false);
    const [showInviteUsersModal,     setShowInviteUsersModal]     = useState(false);
    const [pendingInvitations,        setPendingInvitations]        = useState<PendingInvitation[]>(() => peekCached<{ invitations?: PendingInvitation[] }>(INVITATIONS_URL)?.invitations || []);
    const [isLoadingInvitations,      setIsLoadingInvitations]      = useState(false);
    const [showPendingInvitations,    setShowPendingInvitations]    = useState(false);
    const [respondingInvitationId,    setRespondingInvitationId]    = useState<string | null>(null);
    const [respondingChoice,          setRespondingChoice]          = useState<'accept' | 'decline' | null>(null);
    const [aiPanelOpen,             setAiPanelOpen]              = useState(false);
    // Keep the panel mounted after its first open so a closed chat keeps its history
    const [aiPanelLoaded,           setAiPanelLoaded]            = useState(false);
    useEffect(() => { if (aiPanelOpen) setAiPanelLoaded(true); }, [aiPanelOpen]);
    const [firstPageId,              setFirstPageId]              = useState<string | null>(null);
    const [showUserMenu,             setShowUserMenu]             = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    /* mobile detection */
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 1024);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    /* fetch all workspaces */
    const fetchWorkspaces = useCallback(async (force = false) => {
        if (!session?.user?.id) return;
        if (force) invalidateCached(WORKSPACES_URL);
        // Only show the loading state when there's nothing cached to display
        if (!peekCached(WORKSPACES_URL)) setIsLoadingWorkspaces(true);
        try {
            const data = await cachedJson<{ workspaces?: Workspace[] }>(WORKSPACES_URL);
            setWorkspaces(data.workspaces || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingWorkspaces(false);
        }
    }, [session?.user?.id]);

    useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

    /* invitations addressed to the current user */
    const loadPendingInvitations = useCallback(async (force = false) => {
        if (!session?.user?.id) return;
        if (force) invalidateCached(INVITATIONS_URL);
        if (!peekCached(INVITATIONS_URL)) setIsLoadingInvitations(true);
        try {
            const data = await cachedJson<{ invitations?: PendingInvitation[] }>(INVITATIONS_URL);
            setPendingInvitations(Array.isArray(data.invitations) ? data.invitations : []);
        } catch {
            setPendingInvitations([]);
        } finally {
            setIsLoadingInvitations(false);
        }
    }, [session?.user?.id]);

    useEffect(() => { loadPendingInvitations(); }, [loadPendingInvitations]);

    /* current workspace details: role, first page, name — one cached request */
    const applyWorkspaceDetail = useCallback((ws: any, isCurrent: boolean) => {
        if (!ws) return;
        if (isCurrent) {
            if (!workspace) setFetchedWorkspace(ws);
            setFirstPageId(ws.pages?.[0]?.id ?? null);
        }
        if (session?.user?.id) {
            if (ws.ownerId === session.user.id) {
                setUserRole('owner');
            } else {
                const member = ws.members?.find((m: { userId: string; role: string }) => m.userId === session.user.id);
                setUserRole(member ? (member.role as Role) : 'viewer');
            }
        }
    }, [workspace, session?.user?.id]);

    const wsId = currentWorkspaceId || workspace?.id;
    // The role fallback below needs a workspace only when none is selected; keying
    // on its id (not the whole list) stops the effect re-running on every list refresh.
    const fallbackWsId = wsId ? null : workspaces[0]?.id ?? null;

    useEffect(() => {
        let cancelled = false;
        if (wsId) {
            const cached = peekCached<{ workspace?: any }>(workspaceUrl(wsId));
            if (cached?.workspace) applyWorkspaceDetail(cached.workspace, true);
            cachedJson<{ workspace?: any }>(workspaceUrl(wsId))
                .then(data => { if (!cancelled) applyWorkspaceDetail(data.workspace, true); })
                .catch(() => { if (!cancelled) setFirstPageId(null); });
        } else {
            setFetchedWorkspace(null);
            setFirstPageId(null);
            // Derive role from the first available workspace so invite works on non-workspace pages
            if (fallbackWsId && session?.user?.id) {
                cachedJson<{ workspace?: any }>(workspaceUrl(fallbackWsId))
                    .then(data => { if (!cancelled) applyWorkspaceDetail(data.workspace, false); })
                    .catch(() => { if (!cancelled) setUserRole('viewer'); });
            } else {
                setUserRole('viewer');
            }
        }
        return () => { cancelled = true; };
    }, [wsId, fallbackWsId, session?.user?.id, applyWorkspaceDetail]);

    const effectiveWorkspace = workspace || fetchedWorkspace;
    const canInviteUsers     = ['owner', 'admin'].includes(userRole);

    /* auto-collapse on workspace/kanban/pages routes (they have their own inline sidebar) */
    const shouldCollapseSidebar = useMemo(() =>
        pathname.startsWith('/kanban-board-view') || pathname.startsWith('/workspaces/') || pathname.startsWith('/pages/'),
    [pathname]);

    useEffect(() => {
        if (shouldCollapseSidebar && !sidebarCollapsed) toggleSidebarCollapsed();
    }, [shouldCollapseSidebar, sidebarCollapsed, toggleSidebarCollapsed]);

    /* breadcrumbs */
    const breadcrumbs = useMemo(() => {
        if (explicitBreadcrumbs) return explicitBreadcrumbs;
        const crumbs: { label: string; href: string }[] = [
            { label: t('nav.dashboard'), href: '/dashboard' },
        ];
        if (effectiveWorkspace && (pathname.startsWith('/workspaces') || pathname.startsWith('/pages/') || pathname.startsWith('/kanban-board-view'))) {
            crumbs.push({ label: effectiveWorkspace.name, href: `/workspaces/${effectiveWorkspace.id}` });
        }
        if (pathname === '/pages') crumbs.push({ label: t('nav.pages'), href: '/pages' });
        if (currentPage && pathname.startsWith('/pages/')) {
            crumbs.push({ label: currentPage.title, href: `/pages/${currentPage.id}` });
        }
        if (pathname === '/settings') crumbs.push({ label: t('nav.settings'), href: '/settings' });
        return crumbs;
    }, [explicitBreadcrumbs, effectiveWorkspace, currentPage, pathname, t]);

    /* close dropdown on outside click */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    /* debounced search */
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }
        const timer = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
                if (res.ok) {
                    const data = await res.json();
                    setSearchResults(data.results || []);
                    setShowDropdown(true);
                }
            } catch (e) { console.error(e); }
            finally { setSearchLoading(false); }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    /* handlers */
    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); };

    const handleCreatePage = async () => {
        if (!effectiveWorkspace || isCreatingPage) return;
        setIsCreatingPage(true);
        try {
            const res = await fetch('/api/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: t('shell.untitled'), workspaceId: effectiveWorkspace.id }),
            });
            if (res.ok) {
                const data = await res.json();
                router.push(`/pages/${data.page.id}`);
            } else {
                const err = await res.json();
                setToast({ message: err.error || t('shell.createPageFailed'), type: 'error' });
            }
        } catch {
            setToast({ message: t('shell.createPageFailedRetry'), type: 'error' });
        } finally {
            setIsCreatingPage(false);
        }
    };

    const handleWorkspaceSelect = (id: string) => {
        setWorkspace(id);
        router.push(`/workspaces/${id}`);
    };

    const handleCreateWorkspace = async (newWs: Workspace) => {
        setToast({ message: t('shell.workspaceCreated'), type: 'success' });
        await fetchWorkspaces(true);
        handleWorkspaceSelect(newWs.id);
    };

    const handleRespondToInvitation = async (invitationId: string, choice: 'accept' | 'decline') => {
        const invitation = pendingInvitations.find((i) => i.id === invitationId);
        setRespondingInvitationId(invitationId);
        setRespondingChoice(choice);

        const result = await respondToInvitation(invitationId, choice);

        setRespondingInvitationId(null);
        setRespondingChoice(null);

        if (!result.ok) {
            setToast({ message: result.error, type: 'error' });
            return;
        }

        if (choice === 'decline') {
            setToast({ message: t('shell.invitationDeclined'), type: 'success' });
            await loadPendingInvitations(true);
            return;
        }

        setToast({
            message: invitation
                ? t('shell.joinedWorkspace', { workspace: invitation.workspace.name })
                : t('shell.invitationAccepted'),
            type: 'success',
        });
        // Refresh both lists: without the workspaces refetch the newly joined
        // workspace would be missing from the switcher until a full reload.
        await Promise.all([fetchWorkspaces(true), loadPendingInvitations(true)]);
        const workspaceId = result.workspaceId ?? invitation?.workspace.id;
        if (workspaceId) {
            setShowPendingInvitations(false);
            handleWorkspaceSelect(workspaceId);
        }
    };

    const isActive = (basePath: string) => {
        if (basePath === '/dashboard') return pathname === '/dashboard';
        if (basePath === '__chat__') return pathname.includes('/chat');
        if (basePath === '/workspaces') return pathname.startsWith('/workspaces') && !pathname.includes('/chat');
        return pathname.startsWith(basePath);
    };

    /* ── layout state ── */
    // Only allow hover-expand when the sidebar was manually collapsed (not auto-collapsed by route)
    const isEffectivelyExpanded = !sidebarCollapsed || (!shouldCollapseSidebar && isSidebarHovered);
    const sidebarWidth    = isEffectivelyExpanded ? 'w-64' : 'w-[60px]';
    const sidebarTranslate = isMobile
        ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full')
        : 'translate-x-0';
    const contentMargin  = isMobile ? '' : (sidebarCollapsed ? 'ml-[60px]' : 'ml-64');

    /* user info */
    const userName    = session?.user?.name || session?.user?.email || 'User';
    const userInitials = getInitials(userName);

    /* workspace members for header avatars */
    const workspaceMembers = useMemo(() => {
        if (!fetchedWorkspace) return [];
        const all: { id: string; name: string }[] = [];
        if (fetchedWorkspace.owner) {
            all.push({ id: fetchedWorkspace.owner.id, name: fetchedWorkspace.owner.name || fetchedWorkspace.owner.email || 'User' });
        }
        if (fetchedWorkspace.members) {
            for (const m of fetchedWorkspace.members) {
                const u = m.user;
                if (u && !all.find(x => x.id === u.id)) {
                    all.push({ id: u.id, name: u.name || u.email || 'User' });
                }
            }
        }
        return all;
    }, [fetchedWorkspace]);

    return (
        <div className="flex h-screen bg-background text-on-surface overflow-hidden">

            {/* ── Mobile overlay ── */}
            {isMobile && sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-30 backdrop-blur-sm"
                    onClick={toggleSidebar}
                    aria-hidden="true"
                />
            )}

            {/* ── Mobile hamburger ── */}
            {isMobile && (
                <button
                    onClick={toggleSidebar}
                    className="fixed top-3 left-3 z-50 p-2 rounded-xl bg-surface-container-highest shadow-md hover:shadow-lg transition-all"
                    aria-label={t('shell.toggleSidebar')}
                >
                    {sidebarOpen
                        ? <CloseIcon className="h-5 w-5 text-on-surface" />
                        : <Menu      className="h-5 w-5 text-on-surface" />}
                </button>
            )}

            {/* ════════════════ SIDEBAR ════════════════ */}
            <aside
                onMouseEnter={() => setIsSidebarHovered(true)}
                onMouseLeave={() => setIsSidebarHovered(false)}
                className={`
                    fixed left-0 top-0 h-full z-40
                    bg-surface-container-low
                    flex flex-col
                    border-r border-outline-variant/10
                    transition-all duration-300 ease-in-out
                    ${sidebarWidth} ${sidebarTranslate}
                `}
            >
                {/* ── Top: workspace + collapse toggle ── */}
                <div className="flex-shrink-0">
                    {!isEffectivelyExpanded ? (
                        /* collapsed: show avatar only */
                        <div className="flex flex-col items-center pt-4 pb-2 gap-1">
                            <button
                                onClick={toggleSidebarCollapsed}
                                title={t('shell.expandSidebar')}
                                className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-on-secondary font-bold text-sm shadow-sm hover:opacity-90 transition-opacity"
                            >
                                {effectiveWorkspace?.icon || (effectiveWorkspace ? effectiveWorkspace.name.charAt(0).toUpperCase() : '?')}
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-start justify-between pr-2">
                            <div className="flex-1 min-w-0">
                                <WorkspaceList
                                    workspaces={workspaces}
                                    currentWorkspaceId={currentWorkspaceId}
                                    onWorkspaceSelect={handleWorkspaceSelect}
                                    onCreateWorkspace={() => setShowCreateWorkspaceModal(true)}
                                    onInviteUsers={() => setShowInviteUsersModal(true)}
                                    canInviteUsers={canInviteUsers}
                                    isLoading={isLoadingWorkspaces}
                                    pendingInvitationCount={pendingInvitations.length}
                                    onOpenInvitations={() => setShowPendingInvitations(true)}
                                />
                            </div>
                            {!isMobile && !shouldCollapseSidebar && (
                                <button
                                    onClick={toggleSidebarCollapsed}
                                    title={t('shell.collapseSidebar')}
                                    className="mt-5 p-1.5 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors flex-shrink-0"
                                >
                                    <PanelLeftClose className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Divider ── */}
                <div className="mx-3 h-px bg-outline-variant/20 mb-1 flex-shrink-0" />

                {/* ── Expand button when collapsed ── */}
                {!isEffectivelyExpanded && !isMobile && !shouldCollapseSidebar && (
                    <button
                        onClick={toggleSidebarCollapsed}
                        title={t('shell.expandSidebar')}
                        className="mx-auto mb-1 p-1.5 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                        <PanelLeftOpen className="h-4 w-4" />
                    </button>
                )}

                {/* ── Navigation ── */}
                <nav className="flex-1 overflow-y-auto custom-scrollbar px-2 py-1" role="navigation">
                    {NAV_GROUPS.map((group) => (
                        <div key={group.labelKey} className="mb-3">
                            {/* Group label — hidden when collapsed */}
                            {isEffectivelyExpanded && (
                                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60 select-none">
                                    {t(group.labelKey)}
                                </p>
                            )}
                            <div className="space-y-0.5">
                                {group.items.map((item) => {
                                    const href      = resolveHref(item.href, effectiveWorkspace ?? null, firstPageId, currentWorkspaceId);
                                    const active    = isActive(item.basePath);
                                    const Icon      = item.icon;
                                    const label     = t(item.labelKey);
                                    return (
                                        <Link
                                            key={item.basePath}
                                            href={href}
                                            title={!isEffectivelyExpanded ? label : undefined}
                                            aria-label={label}
                                            aria-current={active ? 'page' : undefined}
                                            className={`
                                                group flex items-center gap-3 rounded-xl
                                                transition-colors duration-150
                                                ${!isEffectivelyExpanded ? 'justify-center px-2 py-2.5' : 'px-3 py-2'}
                                                ${active
                                                    ? 'bg-secondary/10 text-secondary'
                                                    : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'}
                                            `}
                                        >
                                            <Icon
                                                className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${
                                                    active
                                                        ? 'text-secondary'
                                                        : 'text-on-surface-variant group-hover:text-on-surface'
                                                }`}
                                                strokeWidth={active ? 2.25 : 1.75}
                                            />
                                            {isEffectivelyExpanded && (
                                                <span className={`text-sm font-medium ${active ? 'text-secondary' : ''}`}>
                                                    {label}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* ── Footer ── */}
                <div className="flex-shrink-0 border-t border-outline-variant/10 p-2 space-y-1">
                    {/* Invite People */}
                    <button
                        onClick={() => setShowInviteUsersModal(true)}
                        title={!isEffectivelyExpanded ? t('shell.invitePeople') : undefined}
                        className={`
                            w-full flex items-center gap-2.5 rounded-xl
                            text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface
                            transition-colors duration-150 text-sm font-medium
                            ${!isEffectivelyExpanded ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                        `}
                    >
                        <UserPlus className="h-4 w-4 flex-shrink-0" />
                        {isEffectivelyExpanded && <span>{t('shell.invitePeople')}</span>}
                    </button>

                    {/* New Page CTA */}
                    <button
                        onClick={handleCreatePage}
                        disabled={isCreatingPage || !effectiveWorkspace}
                        title={
                            !effectiveWorkspace
                                ? t('shell.selectWorkspaceFirst')
                                : !isEffectivelyExpanded ? t('shell.newPage') : undefined
                        }
                        className={`
                            w-full flex items-center gap-2.5 rounded-xl
                            bg-secondary text-on-secondary
                            hover:opacity-90 active:opacity-80
                            disabled:opacity-40 disabled:cursor-not-allowed
                            transition-opacity duration-150 font-medium text-sm
                            ${!isEffectivelyExpanded ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                        `}
                    >
                        {isCreatingPage
                            ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                            : <Plus    className="h-4 w-4 flex-shrink-0" />}
                        {isEffectivelyExpanded && (
                            <span>
                                {isCreatingPage ? t('shell.creatingPage') : !effectiveWorkspace ? t('shell.selectWorkspace') : t('shell.newPage')}
                            </span>
                        )}
                    </button>

                    {/* User row */}
                    <div ref={userMenuRef} className="relative">
                        <button
                            onClick={() => setShowUserMenu(v => !v)}
                            title={!isEffectivelyExpanded ? userName : undefined}
                            className={`
                                group flex items-center gap-2.5 rounded-xl w-full
                                hover:bg-surface-container-highest transition-colors duration-150
                                ${!isEffectivelyExpanded ? 'justify-center px-2 py-2' : 'px-2.5 py-2'}
                            `}
                        >
                            {/* Avatar */}
                            <div className="w-7 h-7 rounded-full bg-surface-container-highest border border-outline-variant/20 flex items-center justify-center text-[11px] font-semibold text-on-surface flex-shrink-0">
                                {userInitials}
                            </div>
                            {isEffectivelyExpanded && (
                                <div className="flex-1 min-w-0 text-left">
                                    <p className="text-sm font-medium text-on-surface truncate leading-tight">{userName}</p>
                                    <p className="text-[10px] text-on-surface-variant leading-tight">{t('shell.account')}</p>
                                </div>
                            )}
                            {isEffectivelyExpanded && (
                                <Settings className="h-3.5 w-3.5 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            )}
                        </button>
                        {showUserMenu && (
                            <div className="absolute bottom-full left-0 mb-1 w-44 bg-surface-container rounded-xl border border-outline-variant/20 shadow-lg overflow-hidden z-50">
                                <Link
                                    href="/settings"
                                    onClick={() => setShowUserMenu(false)}
                                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-highest transition-colors"
                                >
                                    <Settings className="h-4 w-4 text-on-surface-variant" />
                                    {t('nav.settings')}
                                </Link>
                                <button
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-highest transition-colors w-full"
                                >
                                    <LogOut className="h-4 w-4 text-on-surface-variant" />
                                    {t('nav.logout')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* ════════════════ MAIN CONTENT ════════════════ */}
            <div className={`flex-1 flex flex-col transition-all duration-300 ${contentMargin} min-w-0`}>

                {/* ── Top header ── */}
                <header className="h-12 flex-shrink-0 bg-surface-container-lowest border-b border-outline-variant/10 flex items-center justify-between px-5 gap-4">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-1 text-sm min-w-0 overflow-hidden">
                        {breadcrumbs.map((crumb, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-on-surface-variant/50 flex-shrink-0" />}
                                <Link
                                    href={crumb.href}
                                    className={`transition-colors truncate ${
                                        i === breadcrumbs.length - 1
                                            ? 'text-on-surface font-medium'
                                            : 'text-on-surface-variant hover:text-on-surface'
                                    }`}
                                >
                                    {crumb.label}
                                </Link>
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Search */}
                        {showSearch ? (
                            <div ref={searchRef} className="relative">
                                <form onSubmit={handleSearch} className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-variant pointer-events-none" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder={t('shell.searchPlaceholder')}
                                            autoFocus
                                            className="w-56 pl-8 pr-3 py-1.5 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                        />
                                        {searchLoading && (
                                            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-variant animate-spin" />
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); setShowDropdown(false); }}
                                        className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </form>
                                {showDropdown && (
                                    <div className="absolute top-full mt-1 left-0 w-72 bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-lg overflow-hidden z-50">
                                        {searchResults.length === 0 ? (
                                            <p className="px-4 py-3 text-sm text-on-surface-variant">{t('shell.noResultsFound')}</p>
                                        ) : (
                                            <ul>
                                                {searchResults.map((result) => (
                                                    <li key={result.id}>
                                                        <Link
                                                            href={`/pages/${result.id}`}
                                                            onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); setShowDropdown(false); }}
                                                            className="flex flex-col px-4 py-2.5 hover:bg-surface-container-highest transition-colors"
                                                        >
                                                            <span className="text-sm font-medium text-on-surface truncate">{result.title || t('shell.untitled')}</span>
                                                            <span className="text-xs text-on-surface-variant truncate">{result.workspaceName}</span>
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowSearch(true)}
                                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors"
                                aria-label={t('shell.searchAria')}
                            >
                                <Search className="h-4 w-4" />
                            </button>
                        )}

                        {/* Divider */}
                        <div className="h-5 w-px bg-outline-variant/30" />

                        {/* Language */}
                        <LanguageSwitcher variant="icon" />

                        {/* Notifications */}
                        <NotificationBell />

                        {/* Member avatars */}
                        {workspaceMembers.length > 0 && (
                            <div className="flex items-center -space-x-2">
                                {workspaceMembers.slice(0, 3).map((member) => (
                                    <div
                                        key={member.id}
                                        title={member.name}
                                        className="w-7 h-7 rounded-full bg-secondary/20 border-2 border-surface-container-lowest flex items-center justify-center text-[10px] font-semibold text-secondary"
                                    >
                                        {getInitials(member.name)}
                                    </div>
                                ))}
                                {workspaceMembers.length > 3 && (
                                    <div
                                        title={t('shell.moreMembersTitle', { count: workspaceMembers.length - 3 })}
                                        className="w-7 h-7 rounded-full bg-surface-container-high border-2 border-surface-container-lowest flex items-center justify-center text-[10px] font-semibold text-on-surface-variant"
                                    >
                                        +{workspaceMembers.length - 3}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Dark mode toggle */}
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors"
                            aria-label={t('shell.toggleDarkMode')}
                        >
                            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </button>

                        {/* Ask AI */}
                        <button
                            onClick={() => setAiPanelOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-secondary hover:bg-secondary/10 rounded-lg transition-colors font-medium"
                        >
                            <span className="material-symbols-outlined text-base leading-none">auto_awesome</span>
                            <span className="hidden sm:inline">{t('shell.askAI')}</span>
                        </button>
                    </div>
                </header>

                {/* ── Page content ── */}
                <main className="flex-1 overflow-y-auto custom-scrollbar">
                    {children}
                </main>
            </div>

            {/* ── Toast ── */}
            {toast && (
                <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
            )}

            {/* ── Modals ── */}
            {showCreateWorkspaceModal && <CreateWorkspaceModal
                isOpen={showCreateWorkspaceModal}
                onClose={() => setShowCreateWorkspaceModal(false)}
                onSuccess={handleCreateWorkspace}
            />}
            {showInviteUsersModal && <InviteUsersModal
                isOpen={showInviteUsersModal}
                onClose={() => setShowInviteUsersModal(false)}
                workspaceId={effectiveWorkspace?.id || workspaces[0]?.id || ''}
                workspaceName={effectiveWorkspace?.name || workspaces[0]?.name || ''}
                userRole={userRole}
            />}
            {showPendingInvitations && <PendingInvitationsModal
                isOpen={showPendingInvitations}
                onClose={() => setShowPendingInvitations(false)}
                invitations={pendingInvitations}
                isLoading={isLoadingInvitations}
                onRespond={handleRespondToInvitation}
                respondingId={respondingInvitationId}
                respondingChoice={respondingChoice}
            />}

            {/* ── AI Chat Panel ── */}
            {aiPanelLoaded && <AIChatPanel isOpen={aiPanelOpen} onClose={() => setAiPanelOpen(false)} workspaceId={currentWorkspaceId} />}
        </div>
    );
}
