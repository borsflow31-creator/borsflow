'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Building, Building2, Check, Loader2, Lock } from 'lucide-react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';

type BusinessType = 'AGENCY' | 'DEVELOPER';

const OPTIONS: {
    value: BusinessType;
    icon: typeof Building;
    titleKey: MessageKey;
    taglineKey: MessageKey;
    pointKeys: MessageKey[];
}[] = [
    {
        value: 'AGENCY',
        icon: Building2,
        titleKey: 'onboarding.agencyTitle',
        taglineKey: 'onboarding.agencyTagline',
        pointKeys: ['onboarding.agencyPoint1', 'onboarding.agencyPoint2', 'onboarding.agencyPoint3'],
    },
    {
        value: 'DEVELOPER',
        icon: Building,
        titleKey: 'onboarding.developerTitle',
        taglineKey: 'onboarding.developerTagline',
        pointKeys: ['onboarding.developerPoint1', 'onboarding.developerPoint2', 'onboarding.developerPoint3'],
    },
];

/**
 * The one-time "what kind of business are you?" question shown after sign-up.
 *
 * Deliberately not dismissable -- no close button, no backdrop click, no Escape.
 * The answer picks the whole dashboard and navigation, and it is permanent, so
 * letting it be skipped would leave an account on a default nobody chose.
 */
export default function BusinessTypeModal() {
    const { t } = useI18n();
    const { update } = useSession();
    const router = useRouter();

    const [selected, setSelected] = useState<BusinessType | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleContinue = async () => {
        if (!selected || isSaving) return;
        setIsSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/user/business-type', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ businessType: selected }),
            });
            // 409 means it was already set (another tab, a replayed request). The
            // stored value wins, so refresh the session and show what it says
            // rather than reporting a failure the user can do nothing about.
            if (!res.ok && res.status !== 409) throw new Error('save failed');

            // Re-reads the user row into the JWT (the jwt callback runs on update),
            // which is what flips the dashboard and nav.
            await update();
            router.refresh();
        } catch {
            setError(t('onboarding.error'));
            setIsSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="business-type-title"
        >
            <div className="relative w-full max-w-2xl bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-[0_8px_40px_rgb(0,0,0,0.18)] p-6 sm:p-8 my-auto">
                <div className="text-center mb-6">
                    <h2 id="business-type-title" className="text-2xl font-bold text-on-surface mb-2">
                        {t('onboarding.businessTypeTitle')}
                    </h2>
                    <p className="text-sm text-on-surface-variant">{t('onboarding.businessTypeSubtitle')}</p>
                </div>

                <div role="radiogroup" aria-labelledby="business-type-title" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {OPTIONS.map(({ value, icon: Icon, titleKey, taglineKey, pointKeys }) => {
                        const active = selected === value;
                        return (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                disabled={isSaving}
                                onClick={() => setSelected(value)}
                                className={`relative text-start rounded-xl border-2 p-5 transition-all disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60 ${
                                    active
                                        ? 'border-secondary bg-secondary/5 shadow-sm'
                                        : 'border-outline-variant/30 hover:border-outline-variant hover:bg-surface-container-low'
                                }`}
                            >
                                {active && (
                                    <span className="absolute top-3 end-3 w-5 h-5 rounded-full bg-secondary text-on-secondary flex items-center justify-center">
                                        <Check className="h-3 w-3" strokeWidth={3} />
                                    </span>
                                )}
                                <div
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                                        active ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant'
                                    }`}
                                >
                                    <Icon className="h-5 w-5" />
                                </div>
                                <p className="text-base font-semibold text-on-surface">{t(titleKey)}</p>
                                <p className="text-xs text-on-surface-variant mt-0.5 mb-3">{t(taglineKey)}</p>
                                <ul className="space-y-1.5">
                                    {pointKeys.map((key) => (
                                        <li key={key} className="flex items-start gap-2 text-xs text-on-surface-variant">
                                            <Check className="h-3.5 w-3.5 mt-px flex-shrink-0 text-secondary" />
                                            <span>{t(key)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </button>
                        );
                    })}
                </div>

                <p className="flex items-center justify-center gap-1.5 text-xs text-on-surface-variant mt-5">
                    <Lock className="h-3 w-3" />
                    {t('onboarding.permanentNote')}
                </p>

                {error && (
                    <p role="alert" className="text-sm text-error text-center mt-3">
                        {error}
                    </p>
                )}

                <button
                    type="button"
                    onClick={handleContinue}
                    disabled={!selected || isSaving}
                    className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-secondary text-on-secondary py-3 text-sm font-semibold hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isSaving ? t('onboarding.saving') : t('onboarding.continueCta')}
                </button>
            </div>
        </div>
    );
}
