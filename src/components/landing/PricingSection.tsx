'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowRight, Bell, Check, Loader2 } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import {
    BILLING_ENABLED,
    FOUNDING_DISCOUNT_PERCENT,
    PLANS,
    PLAN_ORDER,
    type PlanDefinition,
    type PlanTier,
} from '@/lib/billing/plans'

/* The comparison is against a per-seat stack in general, not named products:
   the rest of the landing page makes no claims about other tools either. */
const PER_SEAT_STACK_PRICE = 39

const fmt = (n: number) => n.toLocaleString('en-US')

function limitLine(value: number | null, unit: string, unlimited = `Unlimited ${unit}`) {
    return value === null ? unlimited : `${fmt(value)} ${unit}`
}

function planLines(plan: PlanDefinition): string[] {
    const l = plan.limits
    return [
        l.maxMembers === null ? 'Unlimited members' : `Up to ${l.maxMembers} invited members`,
        plan.tier === 'BUSINESS'
            ? 'Unlimited AI credits (fair use)'
            : limitLine(l.aiCreditsPerMonth, 'AI credits / month', 'Unlimited AI credits'),
        limitLine(l.crmContacts, 'CRM contacts'),
        l.invoicesPerMonth === null ? 'Unlimited quotes and invoices' : `${l.invoicesPerMonth} invoices / month`,
        limitLine(l.emailSendsPerMonth, 'marketing emails / month', 'Custom email volume'),
        `${l.paymentFeePercent}% fee on online invoice payments`,
    ]
}

/** Cheapest tier whose member cap fits a team of `size` (the owner is not counted). */
function tierForTeam(size: number): PlanDefinition {
    const invited = Math.max(0, size - 1)
    return (
        PLAN_ORDER.map((t) => PLANS[t]).find(
            (p) => p.limits.maxMembers === null || p.limits.maxMembers >= invited
        ) ?? PLANS.ENTERPRISE
    )
}

function WaitlistForm({ tier, onDone }: { tier: PlanTier; onDone: () => void }) {
    const { data: session } = useSession()
    const { currentWorkspaceId } = useAppStore()
    const [email, setEmail] = useState('')
    const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
    const [error, setError] = useState('')
    const signedIn = !!session?.user?.email

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setState('saving')
        setError('')
        try {
            const res = await fetch('/api/billing/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tier, email, workspaceId: currentWorkspaceId }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Could not join the waitlist')
            setState('done')
            onDone()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not join the waitlist')
            setState('error')
        }
    }

    if (state === 'done') {
        return (
            <p role="status" className="text-xs text-[var(--n-text)]">
                {tier === 'ENTERPRISE'
                    ? "Thanks - we'll be in touch by email."
                    : `You're on the list. We'll email you when ${PLANS[tier].name} opens, with ${FOUNDING_DISCOUNT_PERCENT}% off for life.`}
            </p>
        )
    }

    return (
        <form onSubmit={submit} className="flex flex-col gap-2">
            {!signedIn && (
                <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    aria-label="Email address"
                    className="w-full rounded-full border border-[var(--n-border-strong)] bg-[var(--n-base)] px-4 py-2.5 text-sm text-[var(--n-text)] placeholder:text-[var(--n-muted)] focus:outline-none focus:border-[var(--n-text)]"
                />
            )}
            <button
                type="submit"
                disabled={state === 'saving'}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--n-text)] px-5 py-2.5 text-sm font-semibold text-[var(--n-base)] disabled:opacity-60"
            >
                {state === 'saving' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {signedIn ? `Notify ${session?.user?.email}` : 'Notify me'}
            </button>
            {error && (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}
        </form>
    )
}

function PlanCard({ plan, yearly }: { plan: PlanDefinition; yearly: boolean }) {
    const [waitlistOpen, setWaitlistOpen] = useState(false)
    const [joined, setJoined] = useState(false)
    const isFree = plan.tier === 'FREE'
    // Enterprise is sales-led, so it collects interest the same way at any stage.
    const comingSoon = !isFree && (!BILLING_ENABLED || plan.tier === 'ENTERPRISE')
    const price = yearly ? plan.priceYearly : plan.priceMonthly

    return (
        <div
            className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.highlighted
                    ? 'border-[var(--n-text)] bg-[var(--n-surface)] shadow-[0_8px_30px_rgb(0_0_0/0.06)]'
                    : 'border-[var(--n-border)] bg-[var(--n-surface)]/60'
            }`}
        >
            <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-semibold text-[var(--n-text)]">{plan.name}</h3>
                {isFree ? (
                    <span className="rounded-full bg-[var(--n-emerald)] px-2.5 py-0.5 text-xs font-semibold text-[var(--n-base)]">
                        Available now
                    </span>
                ) : comingSoon && plan.tier !== 'ENTERPRISE' ? (
                    <span className="rounded-full border border-[var(--n-border-strong)] px-2.5 py-0.5 text-xs font-medium text-[var(--n-muted)]">
                        Coming soon
                    </span>
                ) : plan.highlighted ? (
                    <span className="rounded-full bg-[var(--n-text)] px-2.5 py-0.5 text-xs font-semibold text-[var(--n-base)]">
                        Most popular
                    </span>
                ) : null}
            </div>
            <p className="mt-2 text-sm text-[var(--n-muted)] min-h-[2.5rem]">{plan.tagline}</p>

            <div className="mt-5 flex items-baseline gap-1.5">
                {price === null ? (
                    <span className="font-display text-3xl font-semibold text-[var(--n-text)]">Custom</span>
                ) : (
                    <>
                        <span className="font-display text-4xl font-semibold tracking-tight text-[var(--n-text)]">
                            ${price}
                        </span>
                        <span className="text-xs text-[var(--n-muted)]">
                            {price === 0 ? 'forever' : '/ month, whole team'}
                        </span>
                    </>
                )}
            </div>
            <p className="mt-1 text-xs text-[var(--n-muted)] min-h-[1rem]">
                {price ? (yearly ? 'Billed yearly' : 'Billed monthly') : ''}
            </p>

            <div className="mt-6">
                {isFree ? (
                    <Link
                        href="/register"
                        className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--n-emerald)] px-5 py-2.5 text-sm font-semibold text-[var(--n-base)] transition-transform hover:-translate-y-0.5"
                    >
                        Start free
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                ) : comingSoon ? (
                    waitlistOpen || joined ? (
                        <WaitlistForm tier={plan.tier} onDone={() => setJoined(true)} />
                    ) : (
                        <button
                            type="button"
                            onClick={() => setWaitlistOpen(true)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--n-border-strong)] px-5 py-2.5 text-sm font-medium text-[var(--n-text)] hover:border-[var(--n-text)]"
                        >
                            <Bell className="w-4 h-4" aria-hidden="true" />
                            {plan.tier === 'ENTERPRISE' ? 'Talk to us' : 'Notify me'}
                        </button>
                    )
                ) : (
                    <Link
                        href={`/settings?section=billing&plan=${plan.tier}`}
                        className="inline-flex w-full items-center justify-center rounded-full bg-[var(--n-text)] px-5 py-2.5 text-sm font-semibold text-[var(--n-base)]"
                    >
                        Upgrade to {plan.name}
                    </Link>
                )}
            </div>

            <ul className="mt-6 flex flex-col gap-2.5 border-t border-[var(--n-border)] pt-5">
                {[...planLines(plan), ...plan.features].map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-[var(--n-text)]">
                        <Check className="w-3.5 h-3.5 shrink-0 mt-1 text-[var(--n-emerald)]" aria-hidden="true" />
                        <span>{line}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

function TeamCalculator() {
    const [size, setSize] = useState(10)
    const plan = tierForTeam(size)
    const ours = plan.priceYearly
    const theirs = size * PER_SEAT_STACK_PRICE

    return (
        <div className="mt-14 rounded-2xl border border-[var(--n-border)] bg-[var(--n-surface)]/60 p-6 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-5">
                    <h3 className="font-display text-xl font-semibold text-[var(--n-text)]">
                        One price for the whole team
                    </h3>
                    <p className="mt-2 text-sm text-[var(--n-muted)]">
                        Separate docs, CRM and chat tools usually charge for every seat, around $
                        {PER_SEAT_STACK_PRICE} per person a month together. BorsFlow charges the workspace.
                    </p>
                    <label htmlFor="team-size" className="mt-6 block text-xs font-medium uppercase tracking-wider text-[var(--n-muted)]">
                        Team size: <span className="t-data text-[var(--n-text)]">{size}</span>
                    </label>
                    <input
                        id="team-size"
                        type="range"
                        min={1}
                        max={76}
                        value={size}
                        onChange={(e) => setSize(Number(e.target.value))}
                        className="mt-3 w-full accent-[var(--n-emerald)]"
                    />
                </div>
                <dl className="lg:col-span-7 grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-[var(--n-border)] p-5">
                        <dt className="text-xs text-[var(--n-muted)]">Per-seat tools</dt>
                        <dd className="mt-2 font-display text-3xl font-semibold text-[var(--n-muted)] line-through decoration-1">
                            ${fmt(theirs)}
                        </dd>
                        <dd className="mt-1 text-xs text-[var(--n-muted)]">per month</dd>
                    </div>
                    <div className="rounded-xl border border-[var(--n-text)] p-5">
                        <dt className="text-xs text-[var(--n-muted)]">BorsFlow {plan.name}</dt>
                        <dd className="mt-2 font-display text-3xl font-semibold text-[var(--n-text)]">
                            {ours === null ? 'Custom' : `$${fmt(ours)}`}
                        </dd>
                        <dd className="mt-1 text-xs text-[var(--n-muted)]">
                            {ours === 0 ? 'free, AI included' : 'per month, billed yearly'}
                        </dd>
                    </div>
                </dl>
            </div>
        </div>
    )
}

export const PricingSection = ({ headingLevel = 'h2' }: { headingLevel?: 'h1' | 'h2' }) => {
    const [yearly, setYearly] = useState(true)
    const Heading = headingLevel

    return (
        <section id="pricing" className="py-16 sm:py-24 scroll-mt-24 border-t border-[var(--n-border)]">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
                <div className="max-w-3xl">
                    <Heading className="font-display t-h2 text-[var(--n-text)]">
                        Flat pricing per workspace. AI included on every plan.
                    </Heading>
                    <p className="mt-5 t-lead measure text-[var(--n-muted)]">
                        No per-seat fees. Docs, CRM, quotes, invoices, email and the AI assistant all come in one
                        price for the whole team.
                    </p>
                </div>

                {!BILLING_ENABLED && (
                    <div
                        id="waitlist"
                        className="mt-8 scroll-mt-28 rounded-2xl border border-[var(--n-border-strong)] bg-[var(--n-elevated)] px-5 py-4 text-sm text-[var(--n-text)]"
                    >
                        <strong className="font-semibold">BorsFlow is in open beta.</strong> The Free plan is available
                        now so you can test everything. Paid plans are coming soon. Join a waitlist below, or start on
                        Free, and you&apos;ll keep a founding price of {FOUNDING_DISCOUNT_PERCENT}% off for life.
                    </div>
                )}

                <div className="mt-10 flex items-center gap-3" role="group" aria-label="Billing period">
                    {[
                        { label: 'Yearly', value: true, note: '2 months free' },
                        { label: 'Monthly', value: false, note: '' },
                    ].map((opt) => (
                        <button
                            key={opt.label}
                            type="button"
                            aria-pressed={yearly === opt.value}
                            onClick={() => setYearly(opt.value)}
                            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                                yearly === opt.value
                                    ? 'bg-[var(--n-text)] text-[var(--n-base)]'
                                    : 'text-[var(--n-muted)] hover:text-[var(--n-text)] hover:bg-[var(--n-elevated)]'
                            }`}
                        >
                            {opt.label}
                            {opt.note && <span className="ml-1.5 opacity-80">· {opt.note}</span>}
                        </button>
                    ))}
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {PLAN_ORDER.map((tier) => (
                        <PlanCard key={tier} plan={PLANS[tier]} yearly={yearly} />
                    ))}
                </div>

                <TeamCalculator />

                <p className="mt-6 text-xs text-[var(--n-muted)]">
                    Prices in USD, excluding tax. Members are counted without the workspace owner; guests are free
                    within each plan&apos;s guest allowance. AI credits are shared across the workspace and reset every
                    month.
                </p>
            </div>
        </section>
    )
}
