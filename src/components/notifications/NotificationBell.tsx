'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Check, Loader2, MessageSquare, DollarSign, CalendarDays, Columns } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import {
    fetchNotifications,
    fetchUnreadCount,
    markNotificationsRead,
    markAllNotificationsRead,
    type NotificationItem,
} from '@/lib/notifications-client';
import { useI18n } from '@/i18n/I18nProvider';

const POLL_INTERVAL_MS = 60_000;

const CATEGORY_ICON: Record<string, typeof Bell> = {
    team: MessageSquare,
    sales: DollarSign,
    meetings: CalendarDays,
    tasks: Columns,
};

function getInitials(name: string | null) {
    if (!name) return '?';
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function isToday(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function NotificationBell() {
    const router = useRouter();
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<'all' | 'unread'>('all');
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const refreshUnreadCount = useCallback(() => {
        fetchUnreadCount().then(setUnreadCount);
    }, []);

    useEffect(() => {
        refreshUnreadCount();
        const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
        const onFocus = () => refreshUnreadCount();
        window.addEventListener('focus', onFocus);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [refreshUnreadCount]);

    const loadPage = useCallback(async (unreadOnly: boolean) => {
        setLoading(true);
        try {
            const page = await fetchNotifications({ unreadOnly });
            setItems(page.notifications);
            setUnreadCount(page.unreadCount);
        } catch {
            // non-fatal: the panel just shows nothing new
        } finally {
            setLoading(false);
            setLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (open) loadPage(tab === 'unread');
    }, [open, tab, loadPage]);

    // Close on outside click or Escape.
    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const handleItemClick = async (item: NotificationItem) => {
        if (!item.readAt) {
            setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
            setUnreadCount((c) => Math.max(0, c - 1));
            void markNotificationsRead([item.id]);
        }
        setOpen(false);
        if (item.href) router.push(item.href);
    };

    const handleMarkAllRead = async () => {
        setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
        setUnreadCount(0);
        await markAllNotificationsRead();
    };

    const todays = items.filter((n) => isToday(n.createdAt));
    const earlier = items.filter((n) => !isToday(n.createdAt));

    return (
        <div ref={panelRef} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                className="relative p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors"
                aria-label={unreadCount > 0 ? t('notifications.bell.unreadCount', { count: unreadCount }) : t('notifications.bell.title')}
                aria-expanded={open}
            >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                    <span
                        aria-live="polite"
                        className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error text-[10px] font-semibold flex items-center justify-center"
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute top-full mt-1 right-0 w-80 bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-lg overflow-hidden z-50 flex flex-col max-h-[28rem]">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10">
                        <div className="flex items-center gap-1">
                            {(['all', 'unread'] as const).map((key) => (
                                <button
                                    key={key}
                                    onClick={() => setTab(key)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                        tab === key
                                            ? 'bg-secondary/10 text-secondary'
                                            : 'text-on-surface-variant hover:bg-surface-container-high'
                                    }`}
                                >
                                    {key === 'all' ? t('notifications.bell.all') : t('notifications.bell.unread')}
                                </button>
                            ))}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="flex items-center gap-1 text-xs text-secondary hover:underline"
                            >
                                <Check className="h-3 w-3" />
                                {t('notifications.bell.markAllRead')}
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loading && !loaded ? (
                            <div className="flex items-center justify-center gap-2 py-10 text-on-surface-variant text-sm">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('notifications.bell.loading')}
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
                                <Bell className="h-6 w-6 text-on-surface-variant/40" />
                                <p className="text-sm text-on-surface-variant">
                                    {tab === 'unread' ? t('notifications.bell.caughtUp') : t('notifications.bell.empty')}
                                </p>
                            </div>
                        ) : (
                            <>
                                {todays.length > 0 && <NotificationGroup label={t('notifications.bell.today')} items={todays} onClick={handleItemClick} />}
                                {earlier.length > 0 && <NotificationGroup label={t('notifications.bell.earlier')} items={earlier} onClick={handleItemClick} />}
                            </>
                        )}
                    </div>

                    <Link
                        href="/settings?section=notifications"
                        onClick={() => setOpen(false)}
                        className="px-4 py-2.5 text-xs text-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border-t border-outline-variant/10 transition-colors"
                    >
                        {t('notifications.bell.settings')}
                    </Link>
                </div>
            )}
        </div>
    );
}

function NotificationGroup({
    label,
    items,
    onClick,
}: {
    label: string;
    items: NotificationItem[];
    onClick: (item: NotificationItem) => void;
}) {
    return (
        <div>
            <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant/70">{label}</p>
            <ul>
                {items.map((item) => {
                    const Icon = CATEGORY_ICON[item.category] || Bell;
                    const unread = !item.readAt;
                    return (
                        <li key={item.id}>
                            <button
                                onClick={() => onClick(item)}
                                className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-surface-container-highest transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    {item.actor ? (
                                        <span className="text-[10px] font-semibold text-secondary">{getInitials(item.actor.name)}</span>
                                    ) : (
                                        <Icon className="h-4 w-4 text-secondary" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm leading-snug ${unread ? 'font-medium text-on-surface' : 'text-on-surface-variant'}`}>
                                        {item.title}
                                    </p>
                                    <p className="text-[11px] text-on-surface-variant/70 mt-0.5">
                                        {formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true })}
                                    </p>
                                </div>
                                {unread && <span className="w-2 h-2 rounded-full bg-secondary flex-shrink-0 mt-2" />}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
