'use client'

import React, { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useI18n } from '@/i18n/I18nProvider'

type Stage = { title: string; body: string }

/* The page's mid-scroll colour event. The close is still the ending because
   the two fields are nothing alike: this one is divided, dense and
   interactive; that one is open and empty. Painted in CSS, never revealed. */
export const FourStageJourney = () => {
    const { t } = useI18n()
    const [active, setActive] = useState(0)
    const reduce = useReducedMotion()

    /* The label/title/body triad restated one fact three times. Title and body
       only. The numerals stay because the sequence is the argument. */
    const STAGES: Stage[] = [
        { title: t('landing.journey.stage1Title'), body: t('landing.journey.stage1Body') },
        { title: t('landing.journey.stage2Title'), body: t('landing.journey.stage2Body') },
        { title: t('landing.journey.stage3Title'), body: t('landing.journey.stage3Body') },
        { title: t('landing.journey.stage4Title'), body: t('landing.journey.stage4Body') },
    ]

    return (
        <section id="journey" className="py-24 sm:py-32 scroll-mt-24 bg-[var(--n-emerald)]">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
                <div className="max-w-3xl">
                    <h2 className="font-display t-h2 text-[var(--n-base)]">
                        {t('landing.journey.heading')}
                    </h2>
                    <p className="mt-5 t-lead measure text-[var(--n-base)]">
                        {t('landing.journey.lead')}
                    </p>
                </div>

                <ol className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--n-base)]/20">
                    {STAGES.map((s, i) => {
                        const isActive = i === active
                        return (
                            <li key={s.title} className="bg-[var(--n-emerald)]">
                                <button
                                    type="button"
                                    onClick={() => setActive(i)}
                                    onMouseEnter={() => setActive(i)}
                                    onFocus={() => setActive(i)}
                                    aria-current={isActive ? 'step' : undefined}
                                    className="relative w-full h-full p-6 sm:p-7 text-left transition-colors duration-300 hover:bg-[var(--n-base)]/10 focus-visible:bg-[var(--n-base)]/10"
                                >
                                    {/* A 2px rule in the ground colour: an emerald rule
                                        would be invisible on an emerald field. */}
                                    <motion.span
                                        aria-hidden="true"
                                        className="absolute inset-x-0 top-0 h-0.5 bg-[var(--n-base)] origin-left"
                                        initial={false}
                                        animate={{ scaleX: i <= active ? 1 : 0 }}
                                        transition={
                                            reduce ? { duration: 0 } : { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
                                        }
                                    />
                                    <span className="t-data text-xs text-[var(--n-base)]">
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <span className="mt-3 block font-display text-base font-semibold leading-snug text-[var(--n-base)]">
                                        {s.title}
                                    </span>
                                    <span className="mt-2.5 block text-xs leading-relaxed text-[var(--n-base)]">
                                        {s.body}
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ol>
            </div>
        </section>
    )
}
