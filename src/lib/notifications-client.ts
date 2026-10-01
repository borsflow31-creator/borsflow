/**
 * Browser-side helpers for the notification bell.
 *
 * Kept free of any Prisma / server-only import so client components can use it
 * (see src/lib/invitations-client.ts for the same rule).
 */

export interface NotificationItem {
    id: string;
    type: string;
    category: string;
    title: string;
    body: string | null;
    href: string | null;
    readAt: string | null;
    createdAt: string;
    actor: { id: string; name: string | null; email: string } | null;
}

export interface NotificationsPage {
    notifications: NotificationItem[];
    nextCursor: string | null;
    unreadCount: number;
}

export async function fetchNotifications(opts: { cursor?: string; unreadOnly?: boolean } = {}): Promise<NotificationsPage> {
    const params = new URLSearchParams();
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.unreadOnly) params.set('unreadOnly', 'true');

    const response = await fetch(`/api/notifications${params.toString() ? `?${params}` : ''}`);
    if (!response.ok) throw new Error('Failed to load notifications');
    return response.json();
}

/** Lightweight poll for just the unread count, used to refresh the bell's badge. */
export async function fetchUnreadCount(): Promise<number> {
    try {
        const response = await fetch('/api/notifications?unreadOnly=true');
        if (!response.ok) return 0;
        const data = await response.json();
        return typeof data.unreadCount === 'number' ? data.unreadCount : 0;
    } catch {
        return 0;
    }
}

export async function markNotificationsRead(ids: string[]): Promise<boolean> {
    try {
        const response = await fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids }),
        });
        return response.ok;
    } catch {
        return false;
    }
}

export async function markAllNotificationsRead(): Promise<boolean> {
    try {
        const response = await fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ all: true }),
        });
        return response.ok;
    } catch {
        return false;
    }
}

export async function dismissNotification(id: string): Promise<boolean> {
    try {
        const response = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
        return response.ok;
    } catch {
        return false;
    }
}

// ─── Preferences ────────────────────────────────────────────────────────────

export type NotificationCategoryKey = 'team' | 'sales' | 'meetings' | 'tasks';

export interface CategoryPref {
    inApp: boolean;
    email: boolean;
}

export interface NotificationPrefsResponse {
    notificationsEmail: boolean;
    prefs: Record<NotificationCategoryKey, CategoryPref>;
}

export async function fetchNotificationPrefs(): Promise<NotificationPrefsResponse | null> {
    try {
        const response = await fetch('/api/user/notification-prefs');
        if (!response.ok) return null;
        return response.json();
    } catch {
        return null;
    }
}

export async function updateNotificationPrefs(
    patch: { notificationsEmail?: boolean; prefs?: Partial<Record<NotificationCategoryKey, Partial<CategoryPref>>> }
): Promise<NotificationPrefsResponse | null> {
    try {
        const response = await fetch('/api/user/notification-prefs', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        });
        if (!response.ok) return null;
        return response.json();
    } catch {
        return null;
    }
}
