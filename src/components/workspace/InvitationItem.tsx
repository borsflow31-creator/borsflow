'use client';

import React, { useState } from 'react';
import { Mail, Calendar, User, Loader2, RefreshCw, X, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Role } from '@/lib/workspace';
import { useI18n } from '@/i18n/I18nProvider';

interface InvitationItemProps {
    invitation: {
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
    };
    onResend?: () => void;
    onCancel?: () => void;
    currentUserRole: Role;
    isResending?: boolean;
    isCancelling?: boolean;
}

export default function InvitationItem({
    invitation,
    onResend,
    onCancel,
    currentUserRole,
    isResending = false,
    isCancelling = false,
}: InvitationItemProps) {
    const { t } = useI18n();
    const canManage = ['owner', 'admin'].includes(currentUserRole);
    const isPending = invitation.status === 'pending';
    const isExpired = invitation.status === 'expired';

    const getStatusIcon = () => {
        switch (invitation.status) {
            case 'pending':
                return <Clock className="h-4 w-4" />;
            case 'accepted':
                return <CheckCircle className="h-4 w-4" />;
            case 'declined':
                return <XCircle className="h-4 w-4" />;
            case 'expired':
                return <XCircle className="h-4 w-4" />;
            default:
                return null;
        }
    };

    const getStatusColor = () => {
        switch (invitation.status) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
            case 'accepted':
                return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
            case 'declined':
                return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            case 'expired':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(new Date(date));
    };

    const getRoleColor = () => {
        switch (invitation.role) {
            case 'admin':
                return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
            case 'member':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
            case 'viewer':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="p-4 bg-surface-container-high rounded-lg space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center">
                        <Mail className="h-5 w-5 text-on-surface-variant" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-on-surface truncate">{invitation.email}</p>
                        <p className="text-sm text-on-surface-variant">
                            {invitation.sender.name || invitation.sender.email}
                        </p>
                    </div>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
                    {getStatusIcon()}
                    <span className="capitalize">{invitation.status}</span>
                </div>
            </div>

            {/* Details */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
                <div className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleColor()}`}>
                        {invitation.role}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>Sent: {formatDate(invitation.createdAt)}</span>
                </div>
                {isPending && (
                    <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>Expires: {formatDate(invitation.expiresAt)}</span>
                    </div>
                )}
            </div>

            {/* Actions */}
            {isPending && canManage && (
                <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/10">
                    {onResend && (
                        <button
                            onClick={onResend}
                            disabled={isResending || isCancelling}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-secondary hover:bg-secondary/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={t('workspace.invitation.resendTitle')}
                        >
                            {isResending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                            Resend
                        </button>
                    )}
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            disabled={isResending || isCancelling}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-error hover:bg-error/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={t('workspace.invitation.cancelTitle')}
                        >
                            {isCancelling ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <X className="h-4 w-4" />
                            )}
                            Cancel
                        </button>
                    )}
                </div>
            )}

            {isExpired && (
                <p className="text-sm text-error">
                    {t('workspace.invitation.expired')}
                </p>
            )}
        </div>
    );
}
