'use client';

import React, { useMemo } from 'react';
import { Loader2, Inbox } from 'lucide-react';
import { Role } from '@/lib/workspace';
import InvitationItem from './InvitationItem';

interface InvitationsListProps {
    invitations: Array<{
        id: string;
        email: string;
        role: string;
        status: string;
        createdAt: Date;
        expiresAt: Date;
        sender: {
            name: string | null;
            email: string;
        };
    }>;
    status?: 'pending' | 'accepted' | 'declined' | 'expired' | 'all';
    onResend?: (invitationId: string) => void;
    onCancel?: (invitationId: string) => void;
    isLoading?: boolean;
    currentUserRole: Role;
    resendingId?: string | null;
    cancellingId?: string | null;
}

export default function InvitationsList({
    invitations,
    status = 'all',
    onResend,
    onCancel,
    isLoading = false,
    currentUserRole,
    resendingId = null,
    cancellingId = null,
}: InvitationsListProps) {
    const filteredInvitations = useMemo(() => {
        if (status === 'all') {
            return invitations;
        }
        return invitations.filter(inv => inv.status === status);
    }, [invitations, status]);

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="p-4 bg-surface-container-high rounded-lg animate-pulse"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-surface-container-highest" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-surface-container-highest rounded w-3/4" />
                                <div className="h-3 bg-surface-container-highest rounded w-1/2" />
                            </div>
                        </div>
                        <div className="h-3 bg-surface-container-highest rounded w-1/3" />
                    </div>
                ))}
            </div>
        );
    }

    if (filteredInvitations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Inbox className="h-12 w-12 text-on-surface-variant mb-3" />
                <p className="text-on-surface-variant font-medium">No invitations found</p>
                <p className="text-sm text-on-surface-variant mt-1">
                    {status === 'pending'
                        ? 'No pending invitations'
                        : status === 'all'
                        ? 'No invitations yet'
                        : `No ${status} invitations`}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {filteredInvitations.map((invitation) => (
                <InvitationItem
                    key={invitation.id}
                    invitation={invitation}
                    onResend={
                        onResend && invitation.status === 'pending'
                            ? () => onResend(invitation.id)
                            : undefined
                    }
                    onCancel={
                        onCancel && invitation.status === 'pending'
                            ? () => onCancel(invitation.id)
                            : undefined
                    }
                    currentUserRole={currentUserRole}
                    isResending={resendingId === invitation.id}
                    isCancelling={cancellingId === invitation.id}
                />
            ))}
        </div>
    );
}
