'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const FAQS: { q: string; a: string }[] = [
    {
        q: 'Can I bring my existing contacts over?',
        a: 'Leads and catalogue products import from CSV, up to a thousand rows per file, with duplicate SKUs reported row by row instead of failing the whole file. Documents are not imported automatically.',
    },
    {
        q: 'How do payments actually reach me?',
        a: 'Three ways, and you can use all of them: a Stripe payment link per invoice, Stripe Connect so funds settle to your own account, or your own Stripe keys, encrypted before storage. Cash, cheques and transfers you record by hand, and partial payments draw the balance down as they land.',
    },
    {
        q: 'Can a client open a quote without an account?',
        a: 'Yes. Each quote and invoice publishes to its own unguessable link, which you can rotate. From it the client accepts or rejects outright, and the status changes on your side immediately.',
    },
    {
        q: 'What can I get back out?',
        a: 'Any page exports to PDF, Word or Markdown, and every quote and invoice renders as a real server-generated PDF. There is no single-button export of an entire workspace yet — worth knowing before you start rather than after.',
    },
    {
        q: 'Who on my team can see what?',
        a: 'Four roles decide it, checked on the server: viewers read, members edit their own work, admins manage everything except deleting the workspace, owners do all of it. Individual pages can also be granted to one person.',
    },
    {
        q: 'Does it work on my phone?',
        a: 'It installs as an app on iOS and Android and caches the interface. Editing still needs a connection — there is no offline queue that syncs later, and we would rather say so than let you lose an hour finding out.',
    },
]

export const SupportSection = () => {
    const [open, setOpen] = useState<number | null>(0)
    const reduce = useReducedMotion()

    return (
        <section className="py-16 sm:py-24 border-t border-[var(--n-border)]">
            <div className="max-w-3xl mx-auto px-5 sm:px-8">
                <h2 className="font-display t-h2 text-[var(--n-text)]">The questions that decide it.</h2>
                <p className="mt-5 t-lead measure text-[var(--n-muted)]">
                    Including the two places this product will not do what you might assume.
                </p>

                <div className="mt-12 measure">
                    {FAQS.map(({ q, a }, i) => {
                        const isOpen = open === i
                        return (
                            <div key={q} className="border-b border-[var(--n-border)]">
                                <h3>
                                    <button
                                        type="button"
                                        onClick={() => setOpen(isOpen ? null : i)}
                                        aria-expanded={isOpen}
                                        aria-controls={`faq-panel-${i}`}
                                        className="w-full flex items-start justify-between gap-6 py-5 text-left group"
                                    >
                                        <span className="text-sm sm:text-base font-medium text-[var(--n-text)]">{q}</span>
                                        <ChevronDown
                                            aria-hidden="true"
                                            className={`w-4 h-4 shrink-0 mt-0.5 text-[var(--n-muted)] transition-transform duration-200 group-hover:text-[var(--n-text)] ${
                                                isOpen ? 'rotate-180' : ''
                                            }`}
                                        />
                                    </button>
                                </h3>
                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            id={`faq-panel-${i}`}
                                            initial={reduce ? false : { height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={reduce ? undefined : { height: 0, opacity: 0 }}
                                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                            className="overflow-hidden"
                                        >
                                            <p className="pb-6 text-sm leading-relaxed text-[var(--n-muted)]">{a}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
