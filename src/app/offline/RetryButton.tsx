'use client'

import { useI18n } from '@/i18n/I18nProvider'

export default function RetryButton() {
    const { t } = useI18n()
    return (
        <button type="button" onClick={() => window.location.reload()}>
            {t('public.offline.retry')}
        </button>
    )
}
