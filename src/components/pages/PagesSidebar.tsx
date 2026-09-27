'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Plus, Search, ChevronRight, FileText, ChevronDown, Lock, MoreHorizontal, Users } from 'lucide-react';
import PageAccessModal from './PageAccessModal';

interface Page {
    id: string;
    title: string;
    icon: string | null;
    children: Page[];
    _count?: { accessRecords: number };
}

interface PagesSidebarProps {
    workspaceId: string;
    currentPageId: string;
    isAdmin?: boolean;
    onCreatePage?: () => void;
}

function PageTreeItem({
    page,
    level,
    currentPageId,
    workspaceId,
    isAdmin,
}: {
    page: Page;
    level: number;
    currentPageId: string;
    workspaceId: string;
    isAdmin: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [accessModalOpen, setAccessModalOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const isActive = page.id === currentPageId;
    const hasChildren = page.children && page.children.length > 0;
    const isRestricted = (page._count?.accessRecords ?? 0) > 0;

    useEffect(() => {
        if (!menuOpen) return;
        function handleClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [menuOpen]);

    return (
        <div className="select-none">
            <div
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 mb-0.5
                    ${isActive
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'hover:bg-surface-container-high text-on-surface'
                    }`}
                style={{ paddingLeft: `${level * 12 + 12}px` }}
            >
                {hasChildren ? (
                    <button
                        onClick={(e) => { e.preventDefault(); setExpanded(!expanded); }}
                        className="flex-shrink-0 p-0.5 rounded hover:bg-surface-container-highest transition-colors"
                    >
                        {expanded
                            ? <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                ) : (
                    <div className="w-4 flex-shrink-0" />
                )}
                <Link
                    href={`/pages/${page.id}`}
                    className="flex items-center gap-2 flex-1 min-w-0"
                >
                    {page.icon
                        ? <span className="text-sm flex-shrink-0">{page.icon}</span>
                        : <FileText className="w-4 h-4 flex-shrink-0 text-on-surface-variant" />}
                    <span className="text-sm font-medium truncate">{page.title || 'Untitled'}</span>
                    {isRestricted && isAdmin && (
                        <Lock className="w-3 h-3 flex-shrink-0 text-on-surface-variant/60 ml-auto" />
                    )}
                </Link>

                {/* "..." menu — only for admins */}
                {isAdmin && (
                    <div className="relative flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" ref={menuRef}>
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen((v) => !v); }}
                            className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant transition-colors"
                        >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                        {menuOpen && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                                <button
                                    onClick={() => { setMenuOpen(false); setAccessModalOpen(true); }}
                                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                                >
                                    <Users className="w-4 h-4 text-primary" />
                                    Share with members
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {hasChildren && expanded && (
                <div>
                    {page.children.map((child) => (
                        <PageTreeItem
                            key={child.id}
                            page={child}
                            level={level + 1}
                            currentPageId={currentPageId}
                            workspaceId={workspaceId}
                            isAdmin={isAdmin}
                        />
                    ))}
                </div>
            )}

            {accessModalOpen && (
                <PageAccessModal
                    pageId={page.id}
                    workspaceId={workspaceId}
                    pageTitle={page.title}
                    isOpen={accessModalOpen}
                    onClose={() => setAccessModalOpen(false)}
                />
            )}
        </div>
    );
}

export default function PagesSidebar({ workspaceId, currentPageId, isAdmin = false, onCreatePage }: PagesSidebarProps) {
    const [pages, setPages] = useState<Page[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [expanded, setExpanded] = useState(true);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!workspaceId) return;
        fetch(`/api/workspaces/${workspaceId}`)
            .then(r => r.json())
            .then(data => setPages(data.workspace?.pages || []))
            .catch(() => setPages([]))
            .finally(() => setLoading(false));
    }, [workspaceId]);

    const filteredPages = pages.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className={`
            flex flex-col bg-surface-container-low border-r border-outline-variant/30
            transition-all duration-300 ease-in-out flex-shrink-0
            ${expanded ? 'w-64' : 'w-14'}
        `}>
            {/* Header */}
            <div className="p-4 border-b border-outline-variant/30">
                <div className="flex items-center justify-between mb-3">
                    {expanded && (
                        <h2 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            Pages
                        </h2>
                    )}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
                        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
                    >
                        <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </button>
                </div>

                {expanded && (
                    <button
                        onClick={onCreatePage}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-secondary text-on-secondary rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New Page</span>
                    </button>
                )}
            </div>

            {/* Search */}
            {expanded && (
                <div className="p-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant" />
                        <input
                            type="text"
                            placeholder="Search pages..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                        />
                    </div>
                </div>
            )}

            {/* Pages List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-1">
                {loading && (
                    <div className="space-y-2 px-2 py-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-2">
                                <div className="w-4 h-4 rounded bg-surface-container-high animate-pulse flex-shrink-0" />
                                <div className="flex-1 h-3.5 bg-surface-container-high rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                )}

                {!loading && filteredPages.length === 0 && (
                    <div className="text-center py-8 px-4">
                        <FileText className="w-10 h-10 mx-auto mb-2 text-on-surface-variant/30" />
                        {expanded && (
                            <p className="text-xs text-on-surface-variant">
                                {searchQuery ? 'No pages found' : 'No pages yet'}
                            </p>
                        )}
                    </div>
                )}

                {!loading && filteredPages.map((page) => (
                    <PageTreeItem
                        key={page.id}
                        page={page}
                        level={0}
                        currentPageId={currentPageId}
                        workspaceId={workspaceId}
                        isAdmin={isAdmin}
                    />
                ))}
            </div>

            {/* Footer */}
            {expanded && (
                <div className="p-3 border-t border-outline-variant/30">
                    <p className="text-xs text-on-surface-variant text-center">
                        {pages.length} {pages.length === 1 ? 'page' : 'pages'}
                    </p>
                </div>
            )}
        </div>
    );
}
