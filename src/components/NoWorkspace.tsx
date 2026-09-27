'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Building2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import PendingInvitationsList from '@/components/workspace/PendingInvitationsList';
import {
    fetchPendingInvitations,
    respondToInvitation,
    type PendingInvitation,
} from '@/lib/invitations-client';

export default function NoWorkspace() {
    const router = useRouter();
    const { data: session } = useSession();
    const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [respondingId, setRespondingId] = useState<string | null>(null);
    const [respondingChoice, setRespondingChoice] = useState<'accept' | 'decline' | null>(null);
    const [error, setError] = useState('');

    // This component renders AppShell rather than living inside it, so it cannot
    // read AppShell's invitation state and loads its own copy.
    const load = useCallback(async () => {
        if (!session?.user?.id) return;
        setIsLoading(true);
        try {
            setInvitations(await fetchPendingInvitations());
        } finally {
            setIsLoading(false);
        }
    }, [session?.user?.id]);

    useEffect(() => { load(); }, [load]);

    const handleRespond = async (invitationId: string, choice: 'accept' | 'decline') => {
        const invitation = invitations.find((i) => i.id === invitationId);
        setRespondingId(invitationId);
        setRespondingChoice(choice);
        setError('');

        const result = await respondToInvitation(invitationId, choice);

        setRespondingId(null);
        setRespondingChoice(null);

        if (!result.ok) {
            setError(result.error);
            return;
        }

        if (choice === 'accept') {
            // A full navigation into the workspace also remounts AppShell, which
            // re-fetches the workspace list - so there is nothing to refresh here.
            const workspaceId = result.workspaceId ?? invitation?.workspace.id;
            if (workspaceId) {
                router.push(`/workspaces/${workspaceId}`);
                return;
            }
        }

        await load();
    };

    const hasInvitations = invitations.length > 0;

    return (
        <AppShell>
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 gap-6">
                {hasInvitations && (
                    <div className="bg-surface-container-low rounded-2xl p-8 max-w-md w-full">
                        <h2 className="text-xl font-semibold text-on-surface mb-1">
                            You&apos;ve been invited
                        </h2>
                        <p className="text-on-surface-variant mb-5 text-sm">
                            Accept an invitation to join a workspace.
                        </p>
                        {error && (
                            <div className="p-3 mb-4 rounded-lg bg-error/10 text-error text-sm">{error}</div>
                        )}
                        <PendingInvitationsList
                            invitations={invitations}
                            isLoading={isLoading}
                            onRespond={handleRespond}
                            respondingId={respondingId}
                            respondingChoice={respondingChoice}
                        />
                    </div>
                )}

                <div className="bg-surface-container-low rounded-2xl p-12 text-center max-w-md w-full">
                    <Building2 className="h-16 w-16 mx-auto mb-4 text-on-surface-variant" strokeWidth={1.5} />
                    <h2 className="text-xl font-semibold text-on-surface mb-2">No workspace selected</h2>
                    <p className="text-on-surface-variant mb-6">
                        Select or create a workspace to continue.
                    </p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim text-sm font-medium transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        </AppShell>
    );
}
