import React from 'react'
import { Boxes, Calendar, Mail, Users } from 'lucide-react'

/* Architecture facts, kept as a definition list rather than a fourth row of
   cards. The compliance, uptime and audit-trail assertions this section once
   carried had nothing behind them and were removed. */
const FOUNDATIONS: { term: string; detail: string }[] = [
    { term: 'PostgreSQL via Prisma', detail: 'One typed schema, every workspace scoped at the query.' },
    { term: 'NextAuth sessions', detail: 'Email and password with verification, or Google sign-in.' },
    {
        term: 'Secrets encrypted before storage',
        detail: 'Calendar tokens, Stripe keys and meeting passwords never sit in plain text.',
    },
    { term: 'Per-page permissions', detail: 'View or edit grants per person, plus public read-only links.' },
]

export const BentoGrid = () => {
    return (
        <section id="features" className="py-16 sm:py-24 scroll-mt-24">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
                <div className="max-w-3xl">
                    <h2 className="font-display t-h2 text-[var(--n-text)]">
                        Everything the deal touches, on one database.
                    </h2>
                    <p className="mt-5 t-lead measure text-[var(--n-muted)]">
                        Documents, pipeline, money, email and calendar are not five integrations wired together. They are
                        five views of the same rows.
                    </p>
                </div>

                <div className="mt-14 grid grid-cols-1 lg:grid-cols-6 gap-5">
                    <article id="crm" className="taste-plinth lg:col-span-3 p-6 sm:p-8 scroll-mt-24">
                        <Users className="w-5 h-5 text-[var(--n-emerald)]" aria-hidden="true" />
                        <h3 className="mt-4 font-display t-h3 text-[var(--n-text)]">A pipeline you can read at a glance</h3>
                        <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                            Custom stages, deal values, sources and scoring. Drag the board or work the table. Import from
                            CSV, then watch the same records drive quotes, email and meetings.
                        </p>
                    </article>

                    <article className="taste-plinth lg:col-span-3 p-6 sm:p-8">
                        <Mail className="w-5 h-5 text-[var(--n-emerald)]" aria-hidden="true" />
                        <h3 className="mt-4 font-display t-h3 text-[var(--n-text)]">Email that follows the deal</h3>
                        <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                            Automations fire on events that already exist in your pipeline &mdash; a lead created, a stage
                            changed, a tag added. Send through SendGrid, SES, Resend, Mailgun, Postmark or your own
                            SMTP; bounces suppress themselves.
                        </p>
                    </article>

                    <article className="taste-plinth lg:col-span-2 p-6 sm:p-8">
                        <Calendar className="w-5 h-5 text-[var(--n-emerald)]" aria-hidden="true" />
                        <h3 className="mt-4 font-display t-h3 text-[var(--n-text)]">Meetings in the same place</h3>
                        <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                            Connect Google Calendar, Cal.com or Zoom and sync both ways. Meetings attach to their lead and
                            carry attendees and notes. Tokens refresh on a cron, so a connection never quietly expires.
                        </p>
                    </article>

                    <article className="taste-plinth lg:col-span-2 p-6 sm:p-8">
                        <Boxes className="w-5 h-5 text-[var(--n-emerald)]" aria-hidden="true" />
                        <h3 className="mt-4 font-display t-h3 text-[var(--n-text)]">A catalogue and a template library</h3>
                        <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                            Products carry SKUs, tax rates and stock straight into line items. Pages, quotes, invoices and
                            boards all start from a template if you want one.
                        </p>
                    </article>

                    {/* Bare material on the page ground, deliberately without a
                        plinth, so the row reads as a change of surface. */}
                    <div className="lg:col-span-2 self-start">
                        <h3 className="pb-3 border-b border-[var(--n-border-strong)] text-xs font-medium uppercase tracking-wider text-[var(--n-text)]">
                            Underneath
                        </h3>
                        <dl className="grid grid-cols-1 gap-x-8">
                        {FOUNDATIONS.map(({ term, detail }) => (
                            <div key={term} className="py-3.5 border-b border-[var(--n-border)]">
                                <dt className="text-xs font-medium text-[var(--n-text)]">{term}</dt>
                                <dd className="mt-1 text-xs leading-relaxed text-[var(--n-muted)]">{detail}</dd>
                            </div>
                            ))}
                        </dl>
                    </div>
                </div>
            </div>
        </section>
    )
}
