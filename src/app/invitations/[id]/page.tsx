'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { CheckCircle, AlertCircle, Loader2, Mail, LogIn } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface InvitationPreview {
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: string;
    workspace: { id: string; name: string; icon: string | null };
    sender: { name: string | null; email: string };
}

interface Viewer {
    isAuthenticated: boolean;
    email: string | null;
    emailMatches: boolean;
}

function InvitationContent() {
    const { t } = useI18n();
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { status: sessionStatus } = useSession();

    const invitationId = params?.id as string;
    const token = searchParams.get('token');

    const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
    const [viewer, setViewer] = useState<Viewer | null>(null);
    const [loadError, setLoadError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [action, setAction] = useState<'accept' | 'decline' | null>(null);
    const [actionError, setActionError] = useState('');
    const [result, setResult] = useState<'accepted' | 'declined' | null>(null);

    // Re-fetch once the session resolves so `viewer` reflects the signed-in user.
    useEffect(() => {
        if (!token) {
            setLoadError(t('public.invitation.missingToken'));
            setIsLoading(false);
            return;
        }
        if (sessionStatus === 'loading') return;

        let cancelled = false;

        const load = async () => {
            try {
                const res = await fetch(
                    `/api/invitations/${invitationId}?token=${encodeURIComponent(token)}`
                );
                const data = await res.json();
                if (cancelled) return;

                if (res.ok) {
                    setInvitation(data.invitation);
                    setViewer(data.viewer);
                } else {
                    setLoadError(data.error || t('public.invitation.loadFailed'));
                }
            } catch {
                if (!cancelled) setLoadError(t('public.invitation.unexpectedError'));
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [invitationId, token, sessionStatus, t]);

    const respond = async (choice: 'accept' | 'decline') => {
        setAction(choice);
        setActionError('');
        try {
            const res = await fetch(`/api/invitations/${invitationId}/${choice}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const data = await res.json();

            if (res.ok) {
                setResult(choice === 'accept' ? 'accepted' : 'declined');
                if (choice === 'accept') {
                    const workspaceId = data.workspace?.id ?? invitation?.workspace.id;
                    setTimeout(() => router.push(`/workspaces/${workspaceId}`), 1500);
                }
            } else {
                setActionError(
                    data.error ||
                        t('public.invitation.actionFailed', {
                            action: choice === 'accept' ? t('public.invitation.acceptVerb') : t('public.invitation.declineVerb'),
                        })
                );
            }
        } catch {
            setActionError(t('public.invitation.actionFailedGeneric'));
        } finally {
            setAction(null);
        }
    };

    const card = 'w-full max-w-md bg-surface-container-low rounded-xl p-8 shadow-lg';

    if (isLoading || sessionStatus === 'loading') {
        return (
            <div className={`${card} text-center`}>
                <Loader2 className="h-12 w-12 text-secondary animate-spin mx-auto mb-4" />
                <p className="text-on-surface-variant">{t('public.invitation.loadingText')}</p>
            </div>
        );
    }

    if (loadError || !invitation) {
        return (
            <div className={`${card} text-center`}>
                <AlertCircle className="h-16 w-16 text-error mx-auto mb-6" />
                <h1 className="text-2xl font-bold text-on-surface mb-3">{t('public.invitation.unavailableTitle')}</h1>
                <p className="text-on-surface-variant mb-8">{loadError}</p>
                <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center px-6 py-3 bg-secondary text-on-secondary rounded-lg font-medium hover:bg-secondary-dim transition-colors"
                >
                    {t('public.invitation.goToDashboard')}
                </Link>
            </div>
        );
    }

    if (result) {
        const accepted = result === 'accepted';
        return (
            <div className={`${card} text-center`}>
                <CheckCircle
                    className={`h-16 w-16 mx-auto mb-6 ${accepted ? 'text-success' : 'text-on-surface-variant'}`}
                />
                <h1 className="text-2xl font-bold text-on-surface mb-3">
                    {accepted
                        ? t('public.invitation.welcomeTo', { workspace: invitation.workspace.name })
                        : t('public.invitation.declinedTitle')}
                </h1>
                <p className="text-on-surface-variant mb-6">
                    {accepted
                        ? t('public.invitation.accessGranted')
                        : t('public.invitation.declinedBody', { workspace: invitation.workspace.name })}
                </p>
                {accepted ? (
                    <p className="text-sm text-on-surface-variant animate-pulse">{t('public.invitation.takingYouThere')}</p>
                ) : (
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center px-6 py-3 bg-secondary text-on-secondary rounded-lg font-medium hover:bg-secondary-dim transition-colors"
                    >
                        {t('public.invitation.goToDashboard')}
                    </Link>
                )}
            </div>
        );
    }

    const workspaceBadge = (
        <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-xl bg-surface-container-highest flex items-center justify-center text-2xl">
                {invitation.workspace.icon || '\u{1F4C1}'}
            </div>
        </div>
    );

    // Already resolved server-side (accepted/declined/expired) - nothing to act on.
    if (invitation.status !== 'pending') {
        const copy: Record<string, string> = {
            accepted: t('public.invitation.alreadyAccepted'),
            declined: t('public.invitation.alreadyDeclined'),
            expired: t('public.invitation.expired'),
        };
        return (
            <div className={`${card} text-center`}>
                <AlertCircle className="h-16 w-16 text-on-surface-variant mx-auto mb-6" />
                <h1 className="text-2xl font-bold text-on-surface mb-3">
                    {t('public.invitation.invitationToWorkspace', { workspace: invitation.workspace.name })}
                </h1>
                <p className="text-on-surface-variant mb-8">
                    {copy[invitation.status] || t('public.invitation.notActive')}
                </p>
                <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center px-6 py-3 bg-secondary text-on-secondary rounded-lg font-medium hover:bg-secondary-dim transition-colors"
                >
                    {t('public.invitation.goToDashboard')}
                </Link>
            </div>
        );
    }

    const inviter = invitation.sender.name || invitation.sender.email;
    const returnTo = `/invitations/${invitationId}?token=${encodeURIComponent(token!)}`;

    // Signed out, or signed in as the wrong account: acting would fail server-side,
    // so send them through auth first rather than showing a dead button.
    if (!viewer?.isAuthenticated || !viewer.emailMatches) {
        const wrongAccount = Boolean(viewer?.isAuthenticated) && !viewer?.emailMatches;
        return (
            <div className={`${card} text-center`}>
                {workspaceBadge}
                <h1 className="text-2xl font-bold text-on-surface mb-3">
                    {t('public.invitation.youreInvitedTo', { workspace: invitation.workspace.name })}
                </h1>
                <p className="text-on-surface-variant mb-2">
                    {t('public.invitation.invitedAs', { inviter, role: invitation.role })}
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-on-surface-variant mb-8">
                    <Mail className="h-4 w-4" />
                    <span>{invitation.email}</span>
                </div>

                {wrongAccount && (
                    <div className="p-3 mb-6 rounded-lg bg-error/10 text-error text-sm">
                        {t('public.invitation.wrongAccountNotice', {
                            email: viewer?.email ?? '',
                            invitedEmail: invitation.email,
                        })}
                    </div>
                )}

                <Link
                    href={`/login?callbackUrl=${encodeURIComponent(returnTo)}`}
                    className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-secondary text-on-secondary rounded-lg font-medium hover:bg-secondary-dim transition-colors"
                >
                    <LogIn className="h-4 w-4" />
                    {wrongAccount ? t('public.invitation.switchAccount') : t('public.invitation.signInToAccept')}
                </Link>
                <Link
                    href={`/register?callbackUrl=${encodeURIComponent(returnTo)}`}
                    className="inline-flex items-center justify-center w-full px-6 py-3 mt-3 text-on-surface-variant rounded-lg font-medium hover:bg-surface-container-high transition-colors"
                >
                    {t('public.invitation.createAccount')}
                </Link>
            </div>
        );
    }

    return (
        <div className={`${card} text-center`}>
            {workspaceBadge}
            <h1 className="text-2xl font-bold text-on-surface mb-3">
                {t('public.invitation.joinWorkspace', { workspace: invitation.workspace.name })}
            </h1>
            <p className="text-on-surface-variant mb-2">
                {t('public.invitation.invitedAs', { inviter, role: invitation.role })}
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-on-surface-variant mb-8">
                <Mail className="h-4 w-4" />
                <span>{invitation.email}</span>
            </div>

            {actionError && (
                <div className="p-3 mb-6 rounded-lg bg-error/10 text-error text-sm">
                    {actionError}
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
                <button
                    onClick={() => respond('accept')}
                    disabled={action !== null}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded-lg font-medium hover:bg-secondary-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {action === 'accept' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <CheckCircle className="h-4 w-4" />
                    )}
                    {t('public.invitation.accept')}
                </button>
                <button
                    onClick={() => respond('decline')}
                    disabled={action !== null}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 text-on-surface-variant rounded-lg font-medium hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {action === 'decline' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {t('public.invitation.decline')}
                </button>
            </div>
        </div>
    );
}

export default function InvitationPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
            <Suspense fallback={<Loader2 className="h-8 w-8 text-secondary animate-spin" />}>
                <InvitationContent />
            </Suspense>
        </div>
    );
}
