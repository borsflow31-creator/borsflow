'use client';

import React from 'react';
import { Loader2, CheckCircle, Clock } from 'lucide-react';
import type { PendingInvitation } from '@/lib/invitations-client';

interface PendingInvitationItemProps {
    invitation: PendingInvitation;
    onRespond: (invitationId: string, choice: 'accept' | 'decline') => void;
    isResponding?: boolean;
    // Which action is in flight, so only that button shows a spinner.
    respondingChoice?: 'accept' | 'decline' | null;
}

const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    member: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

function formatExpiry(expiresAt: string) {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'Expired';
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    if (days >= 1) return `Expires in ${days} day${days === 1 ? '' : 's'}`;
    const hours = Math.max(1, Math.floor(ms / (60 * 60 * 1000)));
    return `Expires in ${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * One invitation as seen by its RECIPIENT: the workspace is the headline and
 * the actions are Accept / Decline. (The admin-side InvitationItem is the
 * mirror image - invitee email as headline, Resend / Cancel as actions.)
 */
export default function PendingInvitationItem({
    invitation,
    onRespond,
    isResponding = false,
    respondingChoice = null,
}: PendingInvitationItemProps) {
    const { workspace, sender, role } = invitation;
    const inviter = sender.name || sender.email;

    return (
        <div className="p-4 bg-surface-container-high rounded-lg space-y-3">
            <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-lg">
                    {workspace.icon || workspace.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-on-surface truncate">{workspace.name}</p>
                    <p className="text-sm text-on-surface-variant truncate">
                        {inviter} invited you as{' '}
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[role] ?? ROLE_COLORS.viewer}`}>
                            {role}
                        </span>
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-outline-variant/10">
                <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <Clock className="h-3.5 w-3.5" />
                    {formatExpiry(invitation.expiresAt)}
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onRespond(invitation.id, 'decline')}
                        disabled={isResponding}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isResponding && respondingChoice === 'decline' && <Loader2 className="h-4 w-4 animate-spin" />}
                        Decline
                    </button>
                    <button
                        onClick={() => onRespond(invitation.id, 'accept')}
                        disabled={isResponding}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isResponding && respondingChoice === 'accept' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCircle className="h-4 w-4" />
                        )}
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
}
