import React from 'react'
import { Check, X } from 'lucide-react'

/* No prices and no claims about other products: the argument is the seam that
   opens between any five tools, which is verifiable by anyone who has run one. */
const SEAMS: string[] = [
    'The proposal lives where the deal cannot see it',
    'Line items get retyped out of the proposal, by hand',
    'The kickoff is booked in another tool, behind another link',
    'Contacts leave as a CSV and come back stale',
]

const JOINS: string[] = [
    'The document and the deal are the same record',
    'Converting a quote carries the client, line items and tax across',
    'Meetings attach to the lead, synced both ways',
    'Segments read the pipeline live — nothing is exported to send email',
]

export const WhyChoose = () => {
    return (
        <section id="comparison" className="py-16 sm:py-24 scroll-mt-24 border-t border-[var(--n-border)]">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
                <div className="max-w-3xl">
                    <h2 className="font-display t-h2 text-[var(--n-text)]">
                        The problem was never the tools. It was the gaps between them.
                    </h2>
                    <p className="mt-5 t-lead measure text-[var(--n-muted)]">
                        A doc tool, a CRM, a billing tool, a scheduler and an email platform each do their job well. The
                        work leaks out where they meet.
                    </p>
                </div>

                <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
                    {/* Five tools */}
                    <div>
                        <h3 className="pb-4 border-b border-[var(--n-border-strong)] text-xs font-medium uppercase tracking-wider text-[var(--n-muted)]">
                            Five tools
                        </h3>
                        <dl>
                            {SEAMS.map((seam) => (
                                <div key={seam} className="flex items-start gap-2.5 py-3 border-b border-[var(--n-border)]">
                                    <X className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--n-muted)]" aria-hidden="true" />
                                    <dt className="text-sm text-[var(--n-muted)]">{seam}</dt>
                                </div>
                            ))}
                        </dl>
                    </div>

                    {/* One workspace */}
                    <div>
                        <h3 className="pb-4 border-b border-[var(--n-border-strong)] text-xs font-medium uppercase tracking-wider text-[var(--n-text)]">
                            One workspace
                        </h3>
                        <dl>
                            {JOINS.map((join) => (
                                <div key={join} className="flex items-start gap-2.5 py-3 border-b border-[var(--n-border)]">
                                    <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--n-emerald)]" aria-hidden="true" />
                                    <dt className="text-sm text-[var(--n-text)]">{join}</dt>
                                </div>
                            ))}
                        </dl>
                    </div>
                </div>
            </div>
        </section>
    )
}
