'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, Plus, History, Clock, Trash2 } from 'lucide-react';
import { Role, getValidInvitationRoles } from '@/lib/workspace';
import InvitationsList from './InvitationsList';

interface InviteUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    workspaceId: string;
    workspaceName: string;
    userRole: Role;
}

type TabType = 'send' | 'pending' | 'history';

interface InviteeEntry {
    id: string;
    email: string;
    role: Role;
}

export default function InviteUsersModal({
    isOpen,
    onClose,
    workspaceId,
    workspaceName,
    userRole,
}: InviteUsersModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('send');
    const [invitees, setInvitees] = useState<InviteeEntry[]>([{ id: crypto.randomUUID(), email: '', role: 'member' }]);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [resendingId, setResendingId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [successMessage, setSuccessMessage] = useState('');
    const modalRef = useRef<HTMLDivElement>(null);
    const firstEmailRef = useRef<HTMLInputElement>(null);

    const canInvite = ['owner', 'admin'].includes(userRole);
    const validRoles = getValidInvitationRoles();

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setInvitees([{ id: crypto.randomUUID(), email: '', role: 'member' }]);
            setRowErrors({});
            setErrors({});
            setSuccessMessage('');
            setActiveTab('send');
            // Focus on first email input after animation
            setTimeout(() => firstEmailRef.current?.focus(), 100);
            // Load invitations
            loadInvitations();
        }
    }, [isOpen, workspaceId]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isSending && !isLoadingInvitations) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, isSending, isLoadingInvitations, onClose]);

    // Handle click outside
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === modalRef.current && !isSending && !isLoadingInvitations) {
            onClose();
        }
    };

    const loadInvitations = async () => {
        if (!canInvite) return;

        setIsLoadingInvitations(true);
        try {
            const response = await fetch(`/api/workspaces/${workspaceId}/invitations`);
            const data = await response.json();

            if (response.ok) {
                setInvitations(data.invitations || []);
            } else {
                console.error('Failed to load invitations:', data.error);
            }
        } catch (error) {
            console.error('Error loading invitations:', error);
        } finally {
            setIsLoadingInvitations(false);
        }
    };

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const updateInvitee = (id: string, field: 'email' | 'role', value: string) => {
        setInvitees(prev => prev.map(inv => inv.id === id ? { ...inv, [field]: value } : inv));
        if (field === 'email') {
            setRowErrors(prev => { const next = { ...prev }; delete next[id]; return next; });
        }
    };

    const addInvitee = () => {
        setInvitees(prev => [...prev, { id: crypto.randomUUID(), email: '', role: 'member' }]);
    };

    const removeInvitee = (id: string) => {
        setInvitees(prev => prev.filter(inv => inv.id !== id));
        setRowErrors(prev => { const next = { ...prev }; delete next[id]; return next; });
    };

    const validateForm = () => {
        const newRowErrors: Record<string, string> = {};
        const seenEmails = new Set<string>();

        for (const inv of invitees) {
            const trimmed = inv.email.trim();
            if (!trimmed) {
                newRowErrors[inv.id] = 'Email is required';
            } else if (!validateEmail(trimmed)) {
                newRowErrors[inv.id] = 'Invalid email address';
            } else if (seenEmails.has(trimmed.toLowerCase())) {
                newRowErrors[inv.id] = 'Duplicate email';
            } else {
                seenEmails.add(trimmed.toLowerCase());
            }
        }

        setRowErrors(newRowErrors);
        return Object.keys(newRowErrors).length === 0;
    };

    const handleSendInvitation = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsSending(true);
        setErrors({});
        setSuccessMessage('');

        // The response refers to rows by position, so keep the exact list we sent.
        const batch = invitees;

        try {
            // One request for the whole list instead of one per invitee.
            const response = await fetch(`/api/workspaces/${workspaceId}/invitations/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invitees: batch.map(inv => ({ email: inv.email.trim(), role: inv.role })),
                }),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                // The whole request was refused (permission, size cap, ...), so
                // nothing was created and the form stays as it was.
                setErrors({ submit: data.error || 'Failed to send invitations' });
                return;
            }

            const rowErrors: Record<string, string> = {};
            const rejected = new Set<number>();
            for (const err of (data.errors ?? []) as { index: number; message: string }[]) {
                rejected.add(err.index);
                const row = batch[err.index];
                if (row) rowErrors[row.id] = err.message;
            }
            setRowErrors(rowErrors);

            // Rows that were created leave the form; rejected ones stay, with their error.
            const remaining = batch.filter((_, index) => rejected.has(index));
            setInvitees(
                remaining.length > 0
                    ? remaining
                    : [{ id: crypto.randomUUID(), email: '', role: 'member' }]
            );

            const created: number = data.created ?? 0;
            const undelivered = (data.undelivered ?? []) as { email: string; reason: 'suppressed' | 'provider_error' }[];

            if (created > 0) {
                if (undelivered.length === 0) {
                    setSuccessMessage(
                        created === 1
                            ? `Invitation sent to ${batch.find((_, i) => !rejected.has(i))?.email.trim() ?? 'the recipient'}!`
                            : `${created} invitations sent successfully!`
                    );
                    setTimeout(() => setSuccessMessage(''), 4000);
                } else {
                    // The invitation rows exist even when no mail went out, so say
                    // which of the two actually happened rather than claiming "sent".
                    const suppressed = undelivered.filter(u => u.reason === 'suppressed').map(u => u.email);
                    const failed = undelivered.filter(u => u.reason === 'provider_error').map(u => u.email);
                    const parts: string[] = [];
                    if (created - undelivered.length > 0) {
                        parts.push(`${created - undelivered.length} sent.`);
                    }
                    if (suppressed.length > 0) {
                        parts.push(`Invitation created but no email was sent to ${suppressed.join(', ')} - that address has bounced before.`);
                    }
                    if (failed.length > 0) {
                        parts.push(`Email delivery failed for ${failed.join(', ')}. Use Resend once email is configured.`);
                    }
                    setErrors({ submit: parts.join(' ') });
                }
                loadInvitations();
            }
        } catch (error) {
            console.error('Error sending invitations:', error);
            setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        } finally {
            setIsSending(false);
        }
    };

    const handleResendInvitation = async (invitationId: string) => {
        setResendingId(invitationId);
        try {
            const response = await fetch(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, {
                method: 'POST',
            });

            const data = await response.json();

            if (response.ok && data.emailSent !== false) {
                setSuccessMessage('Invitation resent successfully!');
                loadInvitations();
                setTimeout(() => setSuccessMessage(''), 3000);
            } else if (response.ok) {
                setErrors({
                    submit:
                        data.emailFailureReason === 'suppressed'
                            ? 'Invitation renewed, but no email was sent - that address has bounced before.'
                            : 'Invitation renewed, but the email could not be delivered. Check your email provider settings.',
                });
                loadInvitations();
            } else {
                setErrors({ submit: data.error || 'Failed to resend invitation' });
            }
        } catch (error) {
            console.error('Error resending invitation:', error);
            setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        } finally {
            setResendingId(null);
        }
    };

    const handleCancelInvitation = async (invitationId: string) => {
        setCancellingId(invitationId);
        try {
            const response = await fetch(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (response.ok) {
                setSuccessMessage('Invitation cancelled successfully!');
                loadInvitations();
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setErrors({ submit: data.error || 'Failed to cancel invitation' });
            }
        } catch (error) {
            console.error('Error cancelling invitation:', error);
            setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        } finally {
            setCancellingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            ref={modalRef}
            onClick={handleBackdropClick}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div
                className="bg-surface-container-highest rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-outline-variant/10 flex-shrink-0">
                    <div>
                        <h2 id="modal-title" className="text-lg font-semibold text-on-surface">
                            Invite People to {workspaceName}
                        </h2>
                        <p className="text-sm text-on-surface-variant mt-1">
                            Send invitations to collaborate on this workspace
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSending || isLoadingInvitations}
                        className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Close modal"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-outline-variant/10 flex-shrink-0">
                    <button
                        onClick={() => setActiveTab('send')}
                        className={`flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                            activeTab === 'send'
                                ? 'border-secondary text-secondary'
                                : 'border-transparent text-on-surface-variant hover:text-on-surface'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Send className="h-4 w-4" />
                            Send Invitation
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                            activeTab === 'pending'
                                ? 'border-secondary text-secondary'
                                : 'border-transparent text-on-surface-variant hover:text-on-surface'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Clock className="h-4 w-4" />
                            Pending ({invitations.filter(i => i.status === 'pending').length})
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                            activeTab === 'history'
                                ? 'border-secondary text-secondary'
                                : 'border-transparent text-on-surface-variant hover:text-on-surface'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <History className="h-4 w-4" />
                            History
                        </div>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Success Message */}
                    {successMessage && (
                        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                            <p className="text-sm text-green-800 dark:text-green-300">{successMessage}</p>
                        </div>
                    )}

                    {/* Submit Error */}
                    {errors.submit && (
                        <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg">
                            <p className="text-sm text-error">{errors.submit}</p>
                        </div>
                    )}

                    {/* Send Invitation Tab */}
                    {activeTab === 'send' && (
                        <div>
                            {!canInvite ? (
                                <div className="text-center py-12">
                                    <p className="text-on-surface-variant">
                                        You don&apos;t have permission to invite people to this workspace.
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={handleSendInvitation} className="space-y-3">
                                    {/* Column headers */}
                                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-1">
                                        <span className="text-sm font-medium text-on-surface">
                                            Email Address <span className="text-error">*</span>
                                        </span>
                                        <span className="text-sm font-medium text-on-surface w-36">Role</span>
                                        <span className="w-8" />
                                    </div>

                                    {/* Invitee rows */}
                                    <div className="space-y-2">
                                        {invitees.map((inv, idx) => (
                                            <div key={inv.id} className="space-y-1">
                                                <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                                                    <input
                                                        ref={idx === 0 ? firstEmailRef : undefined}
                                                        type="email"
                                                        value={inv.email}
                                                        onChange={(e) => updateInvitee(inv.id, 'email', e.target.value)}
                                                        placeholder="colleague@example.com"
                                                        className={`w-full px-3 py-2 bg-surface-container-high rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 transition-all text-sm ${
                                                            rowErrors[inv.id] ? 'ring-2 ring-error' : 'focus:ring-secondary/50'
                                                        }`}
                                                        disabled={isSending}
                                                    />
                                                    <select
                                                        value={inv.role}
                                                        onChange={(e) => updateInvitee(inv.id, 'role', e.target.value)}
                                                        className="w-36 px-3 py-2 bg-surface-container-high rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-sm"
                                                        disabled={isSending}
                                                    >
                                                        {validRoles.map((r) => (
                                                            <option key={r} value={r}>
                                                                {r.charAt(0).toUpperCase() + r.slice(1)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeInvitee(inv.id)}
                                                        disabled={isSending || invitees.length === 1}
                                                        className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                        aria-label="Remove"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                {rowErrors[inv.id] && (
                                                    <p className="text-xs text-error pl-1">{rowErrors[inv.id]}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add another */}
                                    <button
                                        type="button"
                                        onClick={addInvitee}
                                        disabled={isSending}
                                        className="flex items-center gap-1.5 text-sm text-secondary hover:text-secondary-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add another person
                                    </button>

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        disabled={isSending || invitees.every(inv => !inv.email.trim())}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-on-secondary hover:bg-secondary-dim rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium mt-2"
                                    >
                                        {isSending ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-4 w-4" />
                                                {invitees.filter(inv => inv.email.trim()).length > 1
                                                    ? `Send ${invitees.filter(inv => inv.email.trim()).length} Invitations`
                                                    : 'Send Invitation'}
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}

                    {/* Pending Invitations Tab */}
                    {activeTab === 'pending' && (
                        <InvitationsList
                            invitations={invitations}
                            status="pending"
                            onResend={handleResendInvitation}
                            onCancel={handleCancelInvitation}
                            isLoading={isLoadingInvitations}
                            currentUserRole={userRole}
                            resendingId={resendingId}
                            cancellingId={cancellingId}
                        />
                    )}

                    {/* History Tab */}
                    {activeTab === 'history' && (
                        <InvitationsList
                            invitations={invitations}
                            status="all"
                            isLoading={isLoadingInvitations}
                            currentUserRole={userRole}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
