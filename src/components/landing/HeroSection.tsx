'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import { HeroStage } from './HeroStage'
import { DemoVideo } from './DemoVideo'

export const HeroSection = () => {
    const { t } = useI18n()

    /* These are assurances for the call to action, so they sit with it rather than
       a viewport below the capture. The export claim lives here and nowhere else. */
    const ASSURANCES = [
        t('landing.hero.assuranceFree'),
        t('landing.hero.assuranceRoles'),
        t('landing.hero.assuranceData'),
    ]

    return (
        <HeroStage>
            <section className="pt-28 pb-16 sm:pt-32 sm:pb-20 overflow-hidden">
                <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
                    <div className="max-w-4xl">
                        <h1 className="font-display t-display text-[var(--n-text)]">
                            {/* Each line clips its own mask so the sequence can lift
                                them independently without a wrapper per word. */}
                            <span className="block overflow-hidden">
                                <span data-hero="line" className="block">
                                    {t('landing.hero.titleLine1')}
                                </span>
                            </span>
                            <span className="block overflow-hidden">
                                <span data-hero="line" className="block">
                                    {t('landing.hero.titleLine2')}
                                </span>
                            </span>
                        </h1>

                        <p data-hero="lead" className="mt-5 t-lead measure text-[var(--n-muted)]">
                            {t('landing.hero.lead')}
                        </p>

                        <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <Link
                                data-hero="action"
                                href="/register"
                                className="taste-sheen taste-btn-primary group px-7 py-3.5 text-sm"
                            >
                                <span>{t('landing.hero.startFree')}</span>
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </Link>
                            <DemoVideo data-hero="action" />
                        </div>

                        <ul className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2">
                            {ASSURANCES.map((item) => (
                                <li
                                    key={item}
                                    data-hero="assurance"
                                    className="flex items-center gap-1.5 text-xs text-[var(--n-muted)]"
                                >
                                    <Check className="w-3.5 h-3.5 shrink-0 text-[var(--n-emerald)]" aria-hidden="true" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Breaks the reading column and bleeds off the right edge, so the
                    product reads as a window onto something larger. */}
                <div
                    data-hero="plate"
                    className="mt-12 sm:mt-14 pl-5 sm:pl-8 lg:pl-[max(2.5rem,calc((100vw-80rem)/2+2.5rem))]"
                >
                    <div className="plate-raster taste-plinth overflow-hidden p-1.5 sm:p-2">
                        <Image
                            src="/shots/crm.webp"
                            alt={t('landing.hero.plateAlt')}
                            width={2160}
                            height={930}
                            priority
                            sizes="(max-width: 640px) 100vw, 88vw"
                            className="w-full h-auto rounded-[0.9rem]"
                        />
                    </div>
                </div>
            </section>
        </HeroStage>
    )
}
