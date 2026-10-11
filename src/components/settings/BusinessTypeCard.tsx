'use client';

import { useSession } from 'next-auth/react';
import { Building, Building2, Lock } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Which offer the account is on: real estate agency or real estate developer.
 * Chosen once after sign-up (BusinessTypeModal) and permanent, because it picks
 * the whole dashboard and navigation, so this only states it.
 */
export function BusinessTypeCard() {
    const { t } = useI18n();
    const { data: session } = useSession();
    const type = session?.user?.businessType;
    if (!type) return null;

    const developer = type === 'DEVELOPER';
    const Icon = developer ? Building : Building2;

    return (
        <div className="bg-surface-container-low rounded-lg p-6 ambient-shadow mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant mb-3">{t('settingsOffer.heading')}</p>
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-on-surface">
                        {developer ? t('onboarding.developerTitle') : t('onboarding.agencyTitle')}
                    </h2>
                    <p className="text-sm text-on-surface-variant">
                        {developer ? t('onboarding.developerTagline') : t('onboarding.agencyTagline')}
                    </p>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-on-surface-variant">
                        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {t('settingsOffer.permanent')}
                    </p>
                </div>
            </div>
        </div>
    );
}
