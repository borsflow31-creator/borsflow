'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'

export const SupportSection = () => {
    const { t } = useI18n()
    const [open, setOpen] = useState<number | null>(0)
    const reduce = useReducedMotion()

    const FAQS: { q: string; a: string }[] = [
        { q: t('landing.support.faq1q'), a: t('landing.support.faq1a') },
        { q: t('landing.support.faq2q'), a: t('landing.support.faq2a') },
        { q: t('landing.support.faq3q'), a: t('landing.support.faq3a') },
        { q: t('landing.support.faq4q'), a: t('landing.support.faq4a') },
        { q: t('landing.support.faq5q'), a: t('landing.support.faq5a') },
        { q: t('landing.support.faq6q'), a: t('landing.support.faq6a') },
    ]

    return (
        <section className="py-16 sm:py-24 border-t border-[var(--n-border)]">
            <div className="max-w-3xl mx-auto px-5 sm:px-8">
                <h2 className="font-display t-h2 text-[var(--n-text)]">{t('landing.support.heading')}</h2>
                <p className="mt-5 t-lead measure text-[var(--n-muted)]">
                    {t('landing.support.lead')}
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
