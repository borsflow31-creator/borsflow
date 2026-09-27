/**
 * Browser-side helpers for the invitations a signed-in user has RECEIVED.
 *
 * Kept free of any Prisma / server-only import so client components can use it
 * (see src/lib/products.ts for the same rule). The admin-side calls that manage
 * invitations a workspace has SENT live in InviteUsersModal.
 */

// `errorFrom` lives in the products module for historical reasons; it is a
// generic `{ error }` reader with no products dependency.
import { errorFrom } from '@/lib/products';

export interface PendingInvitation {
    id: string;
    email: string;
    role: string;
    status: string;
    // JSON over the wire, so these are ISO strings rather than Dates.
    expiresAt: string;
    createdAt: string;
    workspace: { id: string; name: string; icon: string | null };
    sender: { name: string | null; email: string };
}

export type RespondResult =
    | { ok: true; workspaceId?: string }
    | { ok: false; error: string };

/** Pending, unexpired invitations addressed to the current user. */
export async function fetchPendingInvitations(): Promise<PendingInvitation[]> {
    try {
        const response = await fetch('/api/invitations/pending');
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data.invitations) ? data.invitations : [];
    } catch (error) {
        console.error('Error loading pending invitations:', error);
        return [];
    }
}

/**
 * Accept or decline an invitation.
 *
 * `token` is only needed for the emailed-link flow. From the in-app list it is
 * omitted and the server authorizes by session + email match instead.
 */
export async function respondToInvitation(
    invitationId: string,
    choice: 'accept' | 'decline',
    token?: string
): Promise<RespondResult> {
    try {
        const response = await fetch(`/api/invitations/${invitationId}/${choice}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(token ? { token } : {}),
        });

        if (!response.ok) {
            return { ok: false, error: await errorFrom(response, `Failed to ${choice} the invitation.`) };
        }

        const data = await response.json().catch(() => ({}));
        return { ok: true, workspaceId: data?.workspace?.id };
    } catch (error) {
        console.error(`Error trying to ${choice} invitation:`, error);
        return { ok: false, error: 'An unexpected error occurred. Please try again.' };
    }
}
