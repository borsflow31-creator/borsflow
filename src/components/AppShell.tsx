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
import Toast from '@/components/Toast';
import WorkspaceList from '@/components/workspace/WorkspaceList';
import CreateWorkspaceModal from '@/components/workspace/CreateWorkspaceModal';
import InviteUsersModal from '@/components/workspace/InviteUsersModal';
import PendingInvitationsModal from '@/components/workspace/PendingInvitationsModal';
import {
    fetchPendingInvitations,
    respondToInvitation,
    type PendingInvitation,
} from '@/lib/invitations-client';
import { Workspace } from '@/types';
import { Role } from '@/lib/workspace';
import AIChatPanel from '@/components/AIChatPanel';

/* ─── Nav config ─────────────────────────────────────────── */
const NAV_GROUPS = [
    {
        label: 'General',
        items: [
            { label: 'Home',   href: '/dashboard',         icon: Home,      basePath: '/dashboard' },
            { label: 'Pages',  href: '__workspace__',       icon: FileText,  basePath: '/workspaces' },
            { label: 'Kanban',    href: '__kanban__',    icon: Columns,         basePath: '/kanban-board-view' },
            { label: 'Chat',      href: '__chat__',      icon: MessageSquare,   basePath: '__chat__' },
        ],
    },
    {
        label: 'Business',
        items: [
            { label: 'CRM',            href: '__crm__',      icon: Users,        basePath: '/crm' },
            { label: 'Meetings',       href: '__meetings__', icon: CalendarDays, basePath: '/meetings' },
            { label: 'Email Marketing',href: '/email-marketing', icon: Mail,    basePath: '/email-marketing' },
            { label: 'Products',       href: '__products__', icon: Package,      basePath: '/products' },
            { label: 'Quotes',         href: '__quotes__',   icon: QuoteIcon,    basePath: '/quotes' },
            { label: 'Invoices',       href: '__invoices__', icon: DollarSign,   basePath: '/invoices' },
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

    const [workspaces,           setWorkspaces]           = useState<Workspace[]>([]);
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
    const [pendingInvitations,        setPendingInvitations]        = useState<PendingInvitation[]>([]);
    const [isLoadingInvitations,      setIsLoadingInvitations]      = useState(false);
    const [showPendingInvitations,    setShowPendingInvitations]    = useState(false);
    const [respondingInvitationId,    setRespondingInvitationId]    = useState<string | null>(null);
    const [respondingChoice,          setRespondingChoice]          = useState<'accept' | 'decline' | null>(null);
    const [aiPanelOpen,             setAiPanelOpen]              = useState(false);
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
    const fetchWorkspaces = useCallback(async () => {
        if (!session?.user?.id) return;
        setIsLoadingWorkspaces(true);
        try {
            const res = await fetch('/api/workspaces');
            if (res.ok) {
                const data = await res.json();
                setWorkspaces(data.workspaces || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingWorkspaces(false);
        }
    }, [session?.user?.id]);

    useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

    /* invitations addressed to the current user */
    const loadPendingInvitations = useCallback(async () => {
        if (!session?.user?.id) return;
        setIsLoadingInvitations(true);
        try {
            setPendingInvitations(await fetchPendingInvitations());
        } finally {
            setIsLoadingInvitations(false);
        }
    }, [session?.user?.id]);

    useEffect(() => { loadPendingInvitations(); }, [loadPendingInvitations]);

    /* fetch current workspace details + role */
    useEffect(() => {
        const run = async () => {
            const wsId = currentWorkspaceId || workspace?.id;
            if (wsId) {
                try {
                    const res = await fetch(`/api/workspaces/${wsId}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (!workspace) setFetchedWorkspace(data.workspace);
                        if (session?.user?.id && data.workspace) {
                            const ws = data.workspace;
                            if (ws.ownerId === session.user.id) {
                                setUserRole('owner');
                            } else {
                                const member = ws.members?.find((m: { userId: string; role: string }) => m.userId === session.user.id);
                                setUserRole(member ? (member.role as Role) : 'viewer');
                            }
                        }
                    }
                } catch (e) { console.error(e); }
            } else if (!wsId) {
                setFetchedWorkspace(null);
                // Derive role from first available workspace so invite works on non-workspace pages
                const fallbackWs = workspaces[0];
                if (fallbackWs && session?.user?.id) {
                    const res2 = await fetch(`/api/workspaces/${fallbackWs.id}`).catch(() => null);
                    if (res2?.ok) {
                        const data2 = await res2.json();
                        const ws2 = data2.workspace;
                        if (ws2?.ownerId === session.user.id) {
                            setUserRole('owner');
                        } else {
                            const member = ws2?.members?.find((m: { userId: string; role: string }) => m.userId === session.user.id);
                            setUserRole(member ? (member.role as Role) : 'viewer');
                        }
                    } else {
                        setUserRole('viewer');
                    }
                } else {
                    setUserRole('viewer');
                }
            }
        };
        run();
    }, [currentWorkspaceId, workspace?.id, session?.user?.id, workspaces]);

    /* fetch first page id for Pages nav link */
    useEffect(() => {
        if (!currentWorkspaceId) { setFirstPageId(null); return; }
        fetch(`/api/workspaces/${currentWorkspaceId}`)
            .then(r => r.json())
            .then(data => {
                const pages = data.workspace?.pages;
                setFirstPageId(pages?.[0]?.id ?? null);
            })
            .catch(() => setFirstPageId(null));
    }, [currentWorkspaceId]);

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
            { label: 'Dashboard', href: '/dashboard' },
        ];
        if (effectiveWorkspace && (pathname.startsWith('/workspaces') || pathname.startsWith('/pages/') || pathname.startsWith('/kanban-board-view'))) {
            crumbs.push({ label: effectiveWorkspace.name, href: `/workspaces/${effectiveWorkspace.id}` });
        }
        if (pathname === '/pages') crumbs.push({ label: 'Pages', href: '/pages' });
        if (currentPage && pathname.startsWith('/pages/')) {
            crumbs.push({ label: currentPage.title, href: `/pages/${currentPage.id}` });
        }
        if (pathname === '/settings') crumbs.push({ label: 'Settings', href: '/settings' });
        return crumbs;
    }, [explicitBreadcrumbs, effectiveWorkspace, currentPage, pathname]);

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
                body: JSON.stringify({ title: 'Untitled', workspaceId: effectiveWorkspace.id }),
            });
            if (res.ok) {
                const data = await res.json();
                router.push(`/pages/${data.page.id}`);
            } else {
                const err = await res.json();
                setToast({ message: err.error || 'Failed to create page', type: 'error' });
            }
        } catch {
            setToast({ message: 'Failed to create page. Please try again.', type: 'error' });
        } finally {
            setIsCreatingPage(false);
        }
    };

    const handleWorkspaceSelect = (id: string) => {
        setWorkspace(id);
        router.push(`/workspaces/${id}`);
    };

    const handleCreateWorkspace = async (newWs: Workspace) => {
        setToast({ message: 'Workspace created!', type: 'success' });
        await fetchWorkspaces();
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
            setToast({ message: 'Invitation declined', type: 'success' });
            await loadPendingInvitations();
            return;
        }

        setToast({
            message: invitation ? `You joined ${invitation.workspace.name}!` : 'Invitation accepted!',
            type: 'success',
        });
        // Refresh both lists: without the workspaces refetch the newly joined
        // workspace would be missing from the switcher until a full reload.
        await Promise.all([fetchWorkspaces(), loadPendingInvitations()]);
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
                    aria-label="Toggle sidebar"
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
                                title="Expand sidebar"
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
                                    title="Collapse sidebar"
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
                        title="Expand sidebar"
                        className="mx-auto mb-1 p-1.5 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                        <PanelLeftOpen className="h-4 w-4" />
                    </button>
                )}

                {/* ── Navigation ── */}
                <nav className="flex-1 overflow-y-auto custom-scrollbar px-2 py-1" role="navigation">
                    {NAV_GROUPS.map((group) => (
                        <div key={group.label} className="mb-3">
                            {/* Group label — hidden when collapsed */}
                            {isEffectivelyExpanded && (
                                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60 select-none">
                                    {group.label}
                                </p>
                            )}
                            <div className="space-y-0.5">
                                {group.items.map((item) => {
                                    const href      = resolveHref(item.href, effectiveWorkspace ?? null, firstPageId, currentWorkspaceId);
                                    const active    = isActive(item.basePath);
                                    const Icon      = item.icon;
                                    return (
                                        <Link
                                            key={item.basePath}
                                            href={href}
                                            title={!isEffectivelyExpanded ? item.label : undefined}
                                            aria-label={item.label}
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
                                                    {item.label}
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
                        title={!isEffectivelyExpanded ? 'Invite People' : undefined}
                        className={`
                            w-full flex items-center gap-2.5 rounded-xl
                            text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface
                            transition-colors duration-150 text-sm font-medium
                            ${!isEffectivelyExpanded ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                        `}
                    >
                        <UserPlus className="h-4 w-4 flex-shrink-0" />
                        {isEffectivelyExpanded && <span>Invite People</span>}
                    </button>

                    {/* New Page CTA */}
                    <button
                        onClick={handleCreatePage}
                        disabled={isCreatingPage || !effectiveWorkspace}
                        title={
                            !effectiveWorkspace
                                ? 'Select a workspace first'
                                : !isEffectivelyExpanded ? 'New Page' : undefined
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
                                {isCreatingPage ? 'Creating…' : !effectiveWorkspace ? 'Select workspace' : 'New Page'}
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
                                    <p className="text-[10px] text-on-surface-variant leading-tight">Account</p>
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
                                    Settings
                                </Link>
                                <button
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-highest transition-colors w-full"
                                >
                                    <LogOut className="h-4 w-4 text-on-surface-variant" />
                                    Logout
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
                                            placeholder="Search pages, tasks…"
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
                                            <p className="px-4 py-3 text-sm text-on-surface-variant">No results found.</p>
                                        ) : (
                                            <ul>
                                                {searchResults.map((result) => (
                                                    <li key={result.id}>
                                                        <Link
                                                            href={`/pages/${result.id}`}
                                                            onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); setShowDropdown(false); }}
                                                            className="flex flex-col px-4 py-2.5 hover:bg-surface-container-highest transition-colors"
                                                        >
                                                            <span className="text-sm font-medium text-on-surface truncate">{result.title || 'Untitled'}</span>
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
                                aria-label="Search"
                            >
                                <Search className="h-4 w-4" />
                            </button>
                        )}

                        {/* Divider */}
                        <div className="h-5 w-px bg-outline-variant/30" />

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
                                        title={`${workspaceMembers.length - 3} more members`}
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
                            aria-label="Toggle dark mode"
                        >
                            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </button>

                        {/* Ask AI */}
                        <button
                            onClick={() => setAiPanelOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-secondary hover:bg-secondary/10 rounded-lg transition-colors font-medium"
                        >
                            <span className="material-symbols-outlined text-base leading-none">auto_awesome</span>
                            <span className="hidden sm:inline">Ask AI</span>
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
            <CreateWorkspaceModal
                isOpen={showCreateWorkspaceModal}
                onClose={() => setShowCreateWorkspaceModal(false)}
                onSuccess={handleCreateWorkspace}
            />
            <InviteUsersModal
                isOpen={showInviteUsersModal}
                onClose={() => setShowInviteUsersModal(false)}
                workspaceId={effectiveWorkspace?.id || workspaces[0]?.id || ''}
                workspaceName={effectiveWorkspace?.name || workspaces[0]?.name || ''}
                userRole={userRole}
            />
            <PendingInvitationsModal
                isOpen={showPendingInvitations}
                onClose={() => setShowPendingInvitations(false)}
                invitations={pendingInvitations}
                isLoading={isLoadingInvitations}
                onRespond={handleRespondToInvitation}
                respondingId={respondingInvitationId}
                respondingChoice={respondingChoice}
            />

            {/* ── AI Chat Panel ── */}
            <AIChatPanel isOpen={aiPanelOpen} onClose={() => setAiPanelOpen(false)} workspaceId={currentWorkspaceId} />
        </div>
    );
}
