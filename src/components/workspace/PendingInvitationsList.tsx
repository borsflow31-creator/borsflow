'use client';

import React from 'react';
import { Inbox } from 'lucide-react';
import type { PendingInvitation } from '@/lib/invitations-client';
import PendingInvitationItem from './PendingInvitationItem';

interface PendingInvitationsListProps {
    invitations: PendingInvitation[];
    onRespond: (invitationId: string, choice: 'accept' | 'decline') => void;
    isLoading?: boolean;
    respondingId?: string | null;
    respondingChoice?: 'accept' | 'decline' | null;
    emptyTitle?: string;
    emptyHint?: string;
}

/** Invitations addressed to the current user (see InvitationsList for the admin-side view). */
export default function PendingInvitationsList({
    invitations,
    onRespond,
    isLoading = false,
    respondingId = null,
    respondingChoice = null,
    emptyTitle = 'No pending invitations',
    emptyHint = "When someone invites you to a workspace, it'll show up here.",
}: PendingInvitationsListProps) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2].map((i) => (
                    <div key={i} className="p-4 bg-surface-container-high rounded-lg animate-pulse">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-surface-container-highest" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-surface-container-highest rounded w-2/3" />
                                <div className="h-3 bg-surface-container-highest rounded w-1/2" />
                            </div>
                        </div>
                        <div className="h-8 bg-surface-container-highest rounded w-1/3 ml-auto" />
                    </div>
                ))}
            </div>
        );
    }

    if (invitations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <Inbox className="h-12 w-12 text-on-surface-variant mb-3" />
                <p className="text-on-surface-variant font-medium">{emptyTitle}</p>
                <p className="text-sm text-on-surface-variant mt-1">{emptyHint}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {invitations.map((invitation) => (
                <PendingInvitationItem
                    key={invitation.id}
                    invitation={invitation}
                    onRespond={onRespond}
                    isResponding={respondingId === invitation.id}
                    respondingChoice={respondingId === invitation.id ? respondingChoice : null}
                />
            ))}
        </div>
    );
}
