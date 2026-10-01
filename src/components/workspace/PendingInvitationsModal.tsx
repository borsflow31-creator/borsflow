'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { PendingInvitation } from '@/lib/invitations-client';
import { useI18n } from '@/i18n/I18nProvider';
import PendingInvitationsList from './PendingInvitationsList';

interface PendingInvitationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    invitations: PendingInvitation[];
    isLoading?: boolean;
    onRespond: (invitationId: string, choice: 'accept' | 'decline') => void;
    respondingId?: string | null;
    respondingChoice?: 'accept' | 'decline' | null;
}

/**
 * Thin shell around PendingInvitationsList. Fetching and responding stay in the
 * parent (AppShell) so the switcher's count badge and this list can never
 * disagree.
 */
export default function PendingInvitationsModal({
    isOpen,
    onClose,
    invitations,
    isLoading = false,
    onRespond,
    respondingId = null,
    respondingChoice = null,
}: PendingInvitationsModalProps) {
    const { t } = useI18n();
    const backdropRef = useRef<HTMLDivElement>(null);
    const busy = respondingId !== null;

    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !busy) onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, busy, onClose]);

    // Once the last invitation is answered there is nothing left to show.
    useEffect(() => {
        if (isOpen && !isLoading && !busy && invitations.length === 0) onClose();
    }, [isOpen, isLoading, busy, invitations.length, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={backdropRef}
            onClick={(e) => { if (e.target === backdropRef.current && !busy) onClose(); }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pending-invitations-title"
        >
            <div className="bg-surface-container-highest rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-outline-variant/10 flex-shrink-0">
                    <div>
                        <h2 id="pending-invitations-title" className="text-lg font-semibold text-on-surface">
                            Workspace invitations
                        </h2>
                        <p className="text-sm text-on-surface-variant mt-1">
                            Accept to join, or decline to dismiss.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={busy}
                        className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={t('workspace.pendingModal.closeAriaLabel')}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <PendingInvitationsList
                        invitations={invitations}
                        isLoading={isLoading}
                        onRespond={onRespond}
                        respondingId={respondingId}
                        respondingChoice={respondingChoice}
                    />
                </div>
            </div>
        </div>
    );
}
