'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Sparkles, Users } from 'lucide-react'

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
    const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
    const full = limit !== null && used >= limit

    return (
        <div>
            <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-on-surface">
                    <Icon className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
                    {label}
                </span>
                <span className={full ? 'font-medium text-red-600 dark:text-red-400' : 'text-on-surface-variant'}>
                    {used.toLocaleString()} / {limit === null ? 'Unlimited' : limit.toLocaleString()}
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
                        className={`h-full rounded-full ${full ? 'bg-red-500' : 'bg-secondary'}`}
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
    const [data, setData] = useState<UsageResponse | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!workspaceId) return
        setData(null)
        setError('')
        fetch(`/api/billing/usage?workspaceId=${encodeURIComponent(workspaceId)}`)
            .then(async (res) => {
                const body = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(body.error || 'Could not load usage')
                setData(body)
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'Could not load usage'))
    }, [workspaceId])

    return (
        <div className="bg-surface-container-low rounded-lg p-6 ambient-shadow">
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-on-surface">Plan & usage</h2>
                <p className="text-on-surface-variant text-sm">
                    Pricing is flat per workspace. Usage is shared by everyone in it and resets each month.
                </p>
            </div>

            {!workspaceId ? (
                <p className="text-sm text-on-surface-variant">Select a workspace to see its plan.</p>
            ) : error ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : !data ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" aria-label="Loading" />
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center justify-between rounded-lg bg-surface-container-high px-4 py-3">
                        <div>
                            <p className="text-xs uppercase tracking-wider text-on-surface-variant">Current plan</p>
                            <p className="mt-0.5 text-lg font-semibold text-on-surface">
                                {data.plan.name}
                                {!data.billingEnabled && (
                                    <span className="ml-2 rounded-full bg-secondary/15 px-2 py-0.5 align-middle text-xs font-medium text-secondary">
                                        Beta
                                    </span>
                                )}
                            </p>
                        </div>
                        <Link href="/pricing" className="text-sm font-medium text-secondary hover:underline">
                            Compare plans
                        </Link>
                    </div>

                    <Meter
                        icon={Users}
                        label="Members"
                        used={data.members.used}
                        limit={data.members.capacity}
                        detail={
                            data.members.pendingInvitations > 0
                                ? `${data.members.members} members and ${data.members.pendingInvitations} pending invitations. The owner is not counted.`
                                : 'The workspace owner is not counted.'
                        }
                    />
                    <Meter
                        icon={Sparkles}
                        label="AI credits this month"
                        used={data.aiCredits.used}
                        limit={data.aiCredits.limit}
                        detail="A chat message uses 1 credit (2 when it looks up workspace data); generating a template 3; product and email suggestions 5."
                    />

                    {data.billingEnabled ? (
                        <Link
                            href="/pricing"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim transition-colors"
                        >
                            Upgrade plan
                        </Link>
                    ) : (
                        <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-4">
                            <p className="text-sm font-medium text-on-surface">Paid plans are coming soon</p>
                            <p className="mt-1 text-sm text-on-surface-variant">
                                Only the Free plan is available during the beta. Join a waitlist and keep{' '}
                                {data.foundingDiscountPercent}% off for life when paid plans open.
                            </p>
                            <Link
                                href="/pricing#waitlist"
                                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary rounded-lg text-sm hover:bg-secondary-dim transition-colors"
                            >
                                Join the waitlist
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
