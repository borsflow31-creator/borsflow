import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/* What a visitor does in the first ten minutes. It anchors the right half of
   the field, which otherwise ran 570px empty, and it is the only sequence on
   the page stated as instructions rather than description. */
const FIRST_RUN = [
    'Create a workspace',
    'Add a lead, or import the list',
    'Write the scope as a document',
    'Send the quote from it',
]

/* The page's one closing region. Painted in CSS and never revealed: the text
   is set in the ground colour, so any reveal that failed would leave it
   invisible. No opacity on text either — over the light emerald, base at 75%
   measures 3.63:1 and fails AA. */
export const FinalCTA = () => {
    return (
        <section className="bg-[var(--n-emerald)] border-t border-[var(--n-border)]">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-28 sm:py-36">
                <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-end">
                    <div className="lg:col-span-7">
                        <h2 className="font-display t-display text-[var(--n-base)]">
                            Start with one deal and see where it goes.
                        </h2>
                        <p className="mt-6 t-lead measure text-[var(--n-base)]">
                            The whole path takes about ten minutes, and you will know by the end of it whether this fits
                            how your team works.
                        </p>

                        <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <Link
                                href="/register"
                                className="group inline-flex items-center justify-center gap-2 rounded-full bg-[var(--n-base)] px-7 py-3.5 text-sm font-semibold text-[var(--n-text)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                            >
                                <span>Create a workspace</span>
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </Link>
                            <Link
                                href="/login"
                                className="inline-flex items-center justify-center rounded-full border border-[var(--n-base)]/40 px-6 py-3.5 text-sm font-medium text-[var(--n-base)] transition-colors hover:border-[var(--n-base)]"
                            >
                                Sign in
                            </Link>
                        </div>

                        <p className="mt-6 text-xs text-[var(--n-base)]">
                            No sales call. Invite the team when you are ready.
                        </p>
                    </div>

                    <ol className="lg:col-span-5">
                        {FIRST_RUN.map((step, i) => (
                            <li
                                key={step}
                                className="flex items-baseline gap-4 py-3 border-b border-[var(--n-base)]/25 last:border-0"
                            >
                                <span className="t-data text-xs text-[var(--n-base)]">
                                    {String(i + 1).padStart(2, '0')}
                                </span>
                                <span className="text-sm font-medium text-[var(--n-base)]">{step}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </section>
    )
}
