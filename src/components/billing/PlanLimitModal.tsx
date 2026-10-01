'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'

interface PlanLimitPayload {
    error: string
    code: 'PLAN_LIMIT'
    kind: string
    limit: number
    used: number
    upgradeUrl: string
    billingEnabled: boolean
    foundingDiscountPercent?: number
}

/**
 * Shows the upgrade (or, before paid plans launch, waitlist) prompt whenever any
 * API call answers 402 PLAN_LIMIT.
 *
 * It watches `fetch` instead of being wired into each caller: over a dozen
 * components call the AI routes, and most only check `res.ok`. They keep
 * handling the failure as before; this adds the explanation on top.
 */
export function PlanLimitModal() {
    const { t } = useI18n()
    const TITLES: Record<string, string> = {
        ai_credits: t('settings.planLimit.titleAiCredits'),
        members: t('settings.planLimit.titleMembers'),
        email_sends: t('settings.planLimit.titleEmailSends'),
        invoices: t('settings.planLimit.titleInvoices'),
    }
    const [limit, setLimit] = useState<PlanLimitPayload | null>(null)

    useEffect(() => {
        const originalFetch = window.fetch
        window.fetch = async (...args) => {
            const response = await originalFetch(...args)
            if (response.status === 402) {
                response
                    .clone()
                    .json()
                    .then((body) => {
                        if (body?.code === 'PLAN_LIMIT') setLimit(body)
                    })
                    .catch(() => {})
            }
            return response
        }
        return () => {
            window.fetch = originalFetch
        }
    }, [])

    useEffect(() => {
        if (!limit) return
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLimit(null)
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [limit])

    if (!limit) return null

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
            onClick={() => setLimit(null)}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="plan-limit-title"
                className="w-full max-w-md rounded-2xl border border-[var(--n-border)] bg-[var(--n-surface)] p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--n-elevated)]">
                        <Sparkles className="h-5 w-5 text-[var(--n-emerald)]" aria-hidden="true" />
                    </span>
                    <button
                        type="button"
                        onClick={() => setLimit(null)}
                        aria-label={t('settings.planLimit.closeAria')}
                        className="rounded-lg p-1 text-[var(--n-muted)] hover:bg-[var(--n-elevated)] hover:text-[var(--n-text)]"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <h2 id="plan-limit-title" className="mt-4 text-lg font-semibold text-[var(--n-text)]">
                    {TITLES[limit.kind] ?? t('settings.planLimit.titleGeneric')}
                </h2>
                <p className="mt-2 text-sm text-[var(--n-muted)]">{limit.error}</p>

                {limit.limit > 0 && (
                    <div className="mt-4">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--n-elevated)]">
                            <div className="h-full w-full rounded-full bg-[var(--n-emerald)]" />
                        </div>
                        <p className="mt-1.5 text-xs text-[var(--n-muted)]">
                            {t('settings.planLimit.usedOfLimit', { used: limit.used, limit: limit.limit })}
                        </p>
                    </div>
                )}

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() => setLimit(null)}
                        className="rounded-full px-4 py-2 text-sm font-medium text-[var(--n-muted)] hover:text-[var(--n-text)]"
                    >
                        {t('settings.planLimit.notNow')}
                    </button>
                    <Link
                        href={limit.upgradeUrl}
                        onClick={() => setLimit(null)}
                        className="inline-flex items-center justify-center rounded-full bg-[var(--n-text)] px-5 py-2 text-sm font-semibold text-[var(--n-base)]"
                    >
                        {limit.billingEnabled
                            ? t('settings.planLimit.seePlans')
                            : t('settings.planLimit.joinWaitlistDiscount', { percent: limit.foundingDiscountPercent ?? 30 })}
                    </Link>
                </div>
            </div>
        </div>
    )
}
