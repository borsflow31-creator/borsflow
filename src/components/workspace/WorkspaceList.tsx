'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ChevronDown, FolderPlus, UserPlus, Check, Mail } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Workspace } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';

interface WorkspaceListProps {
    workspaces: Workspace[];
    currentWorkspaceId: string | null;
    onWorkspaceSelect: (workspaceId: string) => void;
    onCreateWorkspace: () => void;
    onInviteUsers?: () => void;
    canInviteUsers?: boolean;
    isLoading?: boolean;
    /** Invitations addressed to the current user that they haven't answered yet. */
    pendingInvitationCount?: number;
    onOpenInvitations?: () => void;
}

function getInitials(name: string) {
    return name ? name.charAt(0).toUpperCase() : '?';
}

/** Small "Invited" tag for workspaces the user joined through an invitation (doesn't own). */
function InvitedBadge({ label, title }: { label: string; title: string }) {
    return (
        <span
            title={title}
            className="flex-shrink-0 rounded-full border border-secondary/30 bg-secondary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-secondary"
        >
            {label}
        </span>
    );
}

export default function WorkspaceList({
    workspaces,
    currentWorkspaceId,
    onWorkspaceSelect,
    onCreateWorkspace,
    onInviteUsers,
    canInviteUsers = false,
    isLoading = false,
    pendingInvitationCount = 0,
    onOpenInvitations,
}: WorkspaceListProps) {
    const { t } = useI18n();
    const myId = useSession().data?.user?.id;
    const [open, setOpen] = useState(false);

    // A workspace the user doesn't own is one they were invited to
    const isInvited = (ws: Workspace) => !!myId && !!ws.ownerId && ws.ownerId !== myId;
    const invitedTitle = (ws: Workspace) => {
        const owner = (ws as Workspace & { owner?: { name?: string | null; email?: string | null } }).owner;
        const name = owner?.name || owner?.email;
        return name ? t('workspace.list.invitedBy', { name }) : t('workspace.list.invitedTitle');
    };
    const ref = useRef<HTMLDivElement>(null);

    const sortedWorkspaces = useMemo(() => {
        return [...workspaces].sort((a, b) => {
            if (a.id === currentWorkspaceId) return -1;
            if (b.id === currentWorkspaceId) return 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
    }, [workspaces, currentWorkspaceId]);

    const active = sortedWorkspaces.find((w) => w.id === currentWorkspaceId);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    if (isLoading) {
        return (
            <div className="px-3 pt-4 pb-2">
                <div className="h-10 bg-surface-container-high rounded-xl animate-pulse" />
            </div>
        );
    }

    return (
        <div className="px-3 pt-4 pb-2" ref={ref}>
            {/* Workspace trigger row */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => setOpen((v) => !v)}
                    className="flex-1 flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-surface-container-highest transition-colors duration-150 min-w-0"
                    aria-label={t('workspace.list.switchWorkspace')}
                    aria-expanded={open}
                >
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-on-secondary font-bold text-xs flex-shrink-0 shadow-sm">
                        {active?.icon || (active ? getInitials(active.name) : '?')}
                    </div>
                    {/* Name */}
                    <div className="flex-1 min-w-0 text-left">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-on-surface leading-tight min-w-0">
                            <span className="truncate">{active?.name ?? 'Select workspace'}</span>
                            {active && isInvited(active) && (
                                <InvitedBadge label={t('workspace.list.invitedBadge')} title={invitedTitle(active)} />
                            )}
                        </p>
                        <p className="text-[10px] text-on-surface-variant leading-tight">{t('workspace.list.label')}</p>
                    </div>
                    {pendingInvitationCount > 0 && (
                        <span
                            className="px-1.5 py-0.5 rounded-full bg-secondary text-on-secondary text-[10px] font-bold leading-none flex-shrink-0"
                            aria-label={`${pendingInvitationCount} pending invitation${pendingInvitationCount === 1 ? '' : 's'}`}
                        >
                            {pendingInvitationCount}
                        </span>
                    )}
                    <ChevronDown
                        className={`h-3.5 w-3.5 text-on-surface-variant flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    />
                </button>

                {/* Invite button — only for owners/admins with an active workspace */}
                {canInviteUsers && currentWorkspaceId && (
                    <button
                        onClick={onInviteUsers}
                        title={t('workspace.list.invitePeople')}
                        className="p-2 rounded-xl hover:bg-secondary/10 text-on-surface-variant hover:text-secondary transition-colors duration-150 flex-shrink-0"
                        aria-label={t('workspace.list.inviteAriaLabel')}
                    >
                        <UserPlus className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Dropdown */}
            {open && (
                <div className="mt-1.5 bg-surface-container-highest rounded-xl shadow-xl border border-outline-variant/10 overflow-hidden">
                    <div className="p-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                        {sortedWorkspaces.length === 0 ? (
                            <p className="px-3 py-3 text-sm text-on-surface-variant text-center">{t('workspace.list.noWorkspaces')}</p>
                        ) : (
                            sortedWorkspaces.map((ws) => {
                                const isSelected = ws.id === currentWorkspaceId;
                                return (
                                    <button
                                        key={ws.id}
                                        onClick={() => { onWorkspaceSelect(ws.id); setOpen(false); }}
                                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors duration-150 ${
                                            isSelected
                                                ? 'bg-secondary/10 text-secondary'
                                                : 'text-on-surface hover:bg-surface-container-high'
                                        }`}
                                    >
                                        <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] flex-shrink-0 ${
                                            isSelected ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface'
                                        }`}>
                                            {ws.icon || getInitials(ws.name)}
                                        </div>
                                        <span className="flex-1 text-sm font-medium truncate text-left">{ws.name}</span>
                                        {isInvited(ws) && (
                                            <InvitedBadge label={t('workspace.list.invitedBadge')} title={invitedTitle(ws)} />
                                        )}
                                        {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                    {pendingInvitationCount > 0 && onOpenInvitations && (
                        <>
                            <div className="h-px bg-outline-variant/10" />
                            <div className="p-1.5">
                                <button
                                    onClick={() => { setOpen(false); onOpenInvitations(); }}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-on-surface hover:bg-surface-container-high transition-colors duration-150"
                                >
                                    <div className="w-6 h-6 rounded-md bg-secondary/10 text-secondary flex items-center justify-center flex-shrink-0">
                                        <Mail className="h-3.5 w-3.5" />
                                    </div>
                                    <span className="flex-1 text-sm font-medium text-left">{t('workspace.list.invitations')}</span>
                                    <span className="px-1.5 py-0.5 rounded-full bg-secondary text-on-secondary text-[10px] font-bold leading-none">
                                        {pendingInvitationCount}
                                    </span>
                                </button>
                            </div>
                        </>
                    )}
                    <div className="h-px bg-outline-variant/10" />
                    <div className="p-1.5">
                        <button
                            onClick={() => { setOpen(false); onCreateWorkspace(); }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors duration-150"
                        >
                            <div className="w-6 h-6 rounded-md bg-surface-container-high flex items-center justify-center flex-shrink-0">
                                <FolderPlus className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-sm font-medium">{t('workspace.list.newWorkspace')}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
