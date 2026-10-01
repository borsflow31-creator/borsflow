'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Sparkles, Users } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'

interface UsageResponse {
    plan: { tier: string; name: string }
    members: { used: number; members: number; pendingInvitations: number; capacity: number | null }
    aiCredits: { used: number; limit: number | null }
    billingEnabled: boolean
    foundingDiscountPercent: number
}

function Meter({
    icon: Icon,
    label,
    used,
    limit,
    detail,
}: {
    icon: typeof Users
    label: string
    used: number
    limit: number | null
    detail?: string
}) {
    const { t, formatNumber } = useI18n()
    const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
    const full = limit !== null && used >= limit

    return (
        <div>
            <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-on-surface">
                    <Icon className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
                    {label}
                </span>
                <span className={full ? 'font-medium text-error' : 'text-on-surface-variant'}>
                    {formatNumber(used)} / {limit === null ? t('settings.billing.unlimited') : formatNumber(limit)}
                </span>
            </div>
            {limit !== null && (
                <div
                    className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
                    role="progressbar"
                    aria-label={label}
                    aria-valuemin={0}
                    aria-valuemax={limit}
                    aria-valuenow={used}
                >
                    <div
                        className={`h-full rounded-full ${full ? 'bg-error' : 'bg-secondary'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}
            {detail && <p className="mt-1 text-xs text-on-surface-variant">{detail}</p>}
        </div>
    )
}

/** Settings > Plan & usage: the workspace's plan and this month's pooled usage. */
export function PlanUsageSettings({ workspaceId }: { workspaceId: string | null }) {
    const { t } = useI18n()
    const [data, setData] = useState<UsageResponse | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!workspaceId) return
        setData(null)
        setError('')
        fetch(`/api/billing/usage?workspaceId=${encodeURIComponent(workspaceId)}`)
            .then(async (res) => {
                const body = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(body.error || t('settings.billing.loadError'))
                setData(body)
            })
            .catch((err) => setError(err instanceof Error ? err.message : t('settings.billing.loadError')))
    }, [workspaceId, t])

    return (
        <div className="bg-surface-container-low rounded-lg p-6 ambient-shadow">
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-on-surface">{t('settings.billing.heading')}</h2>
                <p className="text-on-surface-variant text-sm">
                    {t('settings.billing.subtitle')}
                </p>
            </div>

            {!workspaceId ? (
                <p className="text-sm text-on-surface-variant">{t('settings.billing.selectWorkspace')}</p>
            ) : error ? (
                <p role="alert" className="text-sm text-error">{error}</p>
            ) : !data ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" aria-label={t('settings.billing.loadingAria')} />
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center justify-between rounded-lg bg-surface-container-high px-4 py-3">
                        <div>
                            <p className="text-xs uppercase tracking-wider text-on-surface-variant">{t('settings.billing.currentPlan')}</p>
                            <p className="mt-0.5 text-lg font-semibold text-on-surface">
                                {data.plan.name}
                                {!data.billingEnabled && (
                                    <span className="ml-2 rounded-full bg-secondary/15 px-2 py-0.5 align-middle text-xs font-medium text-secondary">
                                        {t('settings.billing.betaBadge')}
                                    </span>
                                )}
                            </p>
                        </div>
                        <Link href="/pricing" className="text-sm font-medium text-secondary hover:underline">
                            {t('settings.billing.comparePlans')}
                        </Link>
                    </div>

                    <Meter
                        icon={Users}
                        label={t('settings.billing.membersLabel')}
                        used={data.members.used}
                        limit={data.members.capacity}
                        detail={
                            data.members.pendingInvitations > 0
                                ? t('settings.billing.membersDetailPending', { members: data.members.members, pending: data.members.pendingInvitations })
                                : t('settings.billing.membersDetailOwnerOnly')
                        }
                    />
                    <Meter
                        icon={Sparkles}
                        label={t('settings.billing.aiCreditsLabel')}
                        used={data.aiCredits.used}
                        limit={data.aiCredits.limit}
                        detail={t('settings.billing.aiCreditsDetail')}
                    />

                    {data.billingEnabled ? (
                        <Link
                            href="/pricing"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim transition-colors"
                        >
                            {t('settings.billing.upgradePlan')}
                        </Link>
                    ) : (
                        <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-4">
                            <p className="text-sm font-medium text-on-surface">{t('settings.billing.paidPlansComingSoon')}</p>
                            <p className="mt-1 text-sm text-on-surface-variant">
                                {t('settings.billing.paidPlansDescription', { percent: data.foundingDiscountPercent })}
                            </p>
                            <Link
                                href="/pricing#waitlist"
                                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary rounded-lg text-sm hover:bg-secondary-dim transition-colors"
                            >
                                {t('settings.billing.joinWaitlist')}
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
