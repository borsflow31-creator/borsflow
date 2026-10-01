'use client';

import { useEffect, useState } from 'react';
import { Bell, Loader2, Users, DollarSign, CalendarDays, Columns } from 'lucide-react';
import {
    fetchNotificationPrefs,
    updateNotificationPrefs,
    type NotificationCategoryKey,
    type NotificationPrefsResponse,
} from '@/lib/notifications-client';
import { useI18n } from '@/i18n/I18nProvider';

function Switch({
    checked,
    disabled,
    onChange,
    label,
}: {
    checked: boolean;
    disabled?: boolean;
    onChange: (value: boolean) => void;
    label: string;
}) {
    return (
        <button
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex items-center h-5 w-9 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                checked ? 'bg-secondary' : 'bg-outline-variant'
            }`}
        >
            <span className={`inline-block w-4 h-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
    );
}

interface NotificationSettingsProps {
    onToast: (message: string, type: 'success' | 'error') => void;
}

export default function NotificationSettings({ onToast }: NotificationSettingsProps) {
    const { t } = useI18n();
    const CATEGORIES: { key: NotificationCategoryKey; label: string; description: string; icon: typeof Bell }[] = [
        { key: 'team', label: t('settings.notifications.categoryTeamLabel'), description: t('settings.notifications.categoryTeamDescription'), icon: Users },
        { key: 'sales', label: t('settings.notifications.categorySalesLabel'), description: t('settings.notifications.categorySalesDescription'), icon: DollarSign },
        { key: 'meetings', label: t('settings.notifications.categoryMeetingsLabel'), description: t('settings.notifications.categoryMeetingsDescription'), icon: CalendarDays },
        { key: 'tasks', label: t('settings.notifications.categoryTasksLabel'), description: t('settings.notifications.categoryTasksDescription'), icon: Columns },
    ];
    const [prefs, setPrefs] = useState<NotificationPrefsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);

    useEffect(() => {
        fetchNotificationPrefs().then((data) => {
            setPrefs(data);
            setLoading(false);
        });
    }, []);

    const saveMasterEmail = async (value: boolean) => {
        if (!prefs) return;
        const previous = prefs;
        setPrefs({ ...prefs, notificationsEmail: value });
        setSavingKey('master');
        const result = await updateNotificationPrefs({ notificationsEmail: value });
        setSavingKey(null);
        if (!result) {
            setPrefs(previous);
            onToast(t('settings.notifications.updateFailed'), 'error');
        }
    };

    const saveCategory = async (category: NotificationCategoryKey, field: 'inApp' | 'email', value: boolean) => {
        if (!prefs) return;
        const previous = prefs;
        setPrefs({
            ...prefs,
            prefs: { ...prefs.prefs, [category]: { ...prefs.prefs[category], [field]: value } },
        });
        setSavingKey(`${category}.${field}`);
        const result = await updateNotificationPrefs({ prefs: { [category]: { [field]: value } } });
        setSavingKey(null);
        if (!result) {
            setPrefs(previous);
            onToast(t('settings.notifications.updateFailed'), 'error');
        }
    };

    if (loading || !prefs) {
        return (
            <div className="bg-surface-container-low rounded-lg p-6 ambient-shadow flex items-center justify-center gap-2 py-16 text-on-surface-variant">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">{t('settings.notifications.loading')}</span>
            </div>
        );
    }

    return (
        <div className="bg-surface-container-low rounded-lg p-6 ambient-shadow">
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-on-surface">{t('settings.notifications.heading')}</h2>
                <p className="text-on-surface-variant text-sm">{t('settings.notifications.subtitle')}</p>
            </div>

            <div className="space-y-6">
                {/* Master email switch */}
                <div className="flex items-center justify-between p-4 bg-surface-container-high rounded-lg">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                            <Bell className="h-5 w-5 text-secondary" />
                        </div>
                        <div>
                            <h3 className="font-medium text-on-surface">{t('settings.notifications.emailHeading')}</h3>
                            <p className="text-sm text-on-surface-variant mt-1">
                                {t('settings.notifications.emailDescription')}
                            </p>
                        </div>
                    </div>
                    <Switch
                        checked={prefs.notificationsEmail}
                        onChange={saveMasterEmail}
                        label={t('settings.notifications.emailSwitchAria')}
                    />
                </div>

                {/* Per-category matrix */}
                <div className="border border-outline-variant/15 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[1fr,72px,72px] items-center px-4 py-2.5 bg-surface-container-high text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                        <span>{t('settings.notifications.categoryHeader')}</span>
                        <span className="text-center">{t('settings.notifications.inAppHeader')}</span>
                        <span className="text-center">{t('settings.notifications.emailHeader')}</span>
                    </div>
                    {CATEGORIES.map(({ key, label, description, icon: Icon }, i) => {
                        const pref = prefs.prefs[key];
                        return (
                            <div
                                key={key}
                                className={`grid grid-cols-[1fr,72px,72px] items-center px-4 py-3.5 ${i > 0 ? 'border-t border-outline-variant/10' : ''}`}
                            >
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                                        <Icon className="h-4 w-4 text-secondary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-on-surface text-sm">{label}</p>
                                        <p className="text-xs text-on-surface-variant mt-0.5">{description}</p>
                                    </div>
                                </div>
                                <div className="flex justify-center">
                                    <Switch
                                        checked={pref.inApp}
                                        onChange={(v) => saveCategory(key, 'inApp', v)}
                                        label={t('settings.notifications.inAppAria', { label })}
                                    />
                                </div>
                                <div className="flex justify-center">
                                    <Switch
                                        checked={pref.email}
                                        disabled={!prefs.notificationsEmail}
                                        onChange={(v) => saveCategory(key, 'email', v)}
                                        label={t('settings.notifications.emailAria', { label })}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <p className="text-xs text-on-surface-variant/70 flex items-center gap-1.5">
                    {savingKey && <Loader2 className="h-3 w-3 animate-spin" />}
                    {t('settings.notifications.savingNote')}
                </p>
            </div>
        </div>
    );
}
