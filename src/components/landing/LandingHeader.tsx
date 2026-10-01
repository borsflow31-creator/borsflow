'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Layers, Menu, Moon, Sun, X } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/i18n/I18nProvider'

export const LandingHeader = () => {
    const { t } = useI18n()
    const [isScrolled, setIsScrolled] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [isDark, setIsDark] = useState(false)
    const { data: session } = useSession()
    const { setTheme } = useAppStore()
    const reduce = useReducedMotion()

    const NAV = [
        { label: t('landing.header.navPipeline'), href: '/#features' },
        { label: t('landing.header.navHowItWorks'), href: '/#journey' },
        { label: t('landing.header.navAssistant'), href: '/#assistant' },
        { label: t('landing.header.navTeam'), href: '/#team' },
        { label: t('landing.header.navPricing'), href: '/pricing' },
    ]

    useEffect(() => {
        setMounted(true)
        /* The pre-paint script in the root layout has already resolved the
           theme onto <html>, so the document is the source of truth here. */
        setIsDark(document.documentElement.classList.contains('dark'))

        const handleScroll = () => setIsScrolled(window.scrollY > 20)
        handleScroll()
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const toggleTheme = () => {
        const next = isDark ? 'light' : 'dark'
        setIsDark(!isDark)
        setTheme(next)
    }

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'py-3' : 'py-5'}`}
        >
            <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
                <div
                    className={`rounded-2xl transition-all duration-300 px-4 sm:px-5 py-2.5 flex items-center justify-between border ${
                        isScrolled
                            ? 'bg-[var(--n-surface)]/85 backdrop-blur-md border-[var(--n-border)] shadow-[0_8px_30px_rgb(0_0_0/0.06)]'
                            : 'bg-transparent border-transparent'
                    }`}
                >
                    <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
                        <span className="w-8 h-8 rounded-lg bg-[var(--n-text)] text-[var(--n-base)] flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-105">
                            <Layers className="w-4 h-4" aria-hidden="true" />
                        </span>
                        <span className="font-display text-base font-semibold tracking-tight text-[var(--n-text)]">
                            BorsFlow
                        </span>
                    </Link>

                    <nav aria-label={t('landing.header.sectionsAria')} className="hidden lg:flex items-center gap-1">
                        {NAV.map((item) => (
                            <a
                                key={item.label}
                                href={item.href}
                                className="px-3.5 py-1.5 rounded-full text-xs font-medium text-[var(--n-muted)] hover:text-[var(--n-text)] hover:bg-[var(--n-elevated)] transition-colors duration-200"
                            >
                                {item.label}
                            </a>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={toggleTheme}
                            aria-label={isDark ? t('landing.header.themeToLight') : t('landing.header.themeToDark')}
                            className="w-8 h-8 rounded-full border border-[var(--n-border)] bg-[var(--n-surface)] text-[var(--n-muted)] hover:text-[var(--n-text)] hover:border-[var(--n-border-strong)] flex items-center justify-center transition-colors duration-200"
                        >
                            {/* Rendered after mount only, so the server markup cannot
                                disagree with the theme the script already applied. */}
                            {mounted ? (
                                isDark ? (
                                    <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                                ) : (
                                    <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                                )
                            ) : (
                                <span className="w-3.5 h-3.5" />
                            )}
                        </button>

                        {session ? (
                            <Link
                                href="/dashboard"
                                className="taste-sheen hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--n-text)] text-[var(--n-base)] shadow-xs hover:opacity-90 transition-opacity"
                            >
                                <span>{t('landing.header.dashboard')}</span>
                                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href="/login"
                                    className="hidden sm:inline-flex px-3 py-1.5 text-xs font-medium text-[var(--n-muted)] hover:text-[var(--n-text)] transition-colors"
                                >
                                    {t('landing.header.signIn')}
                                </Link>
                                <Link
                                    href="/register"
                                    className="taste-sheen inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--n-text)] text-[var(--n-base)] shadow-xs hover:opacity-90 transition-all active:scale-[0.98]"
                                >
                                    <span>{t('landing.header.startFree')}</span>
                                    <ArrowRight className="w-3 h-3" aria-hidden="true" />
                                </Link>
                            </>
                        )}

                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen((v) => !v)}
                            aria-expanded={mobileMenuOpen}
                            aria-controls="landing-mobile-nav"
                            aria-label={t('landing.header.toggleNav')}
                            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[var(--n-text)] hover:bg-[var(--n-elevated)] transition-colors"
                        >
                            {mobileMenuOpen ? (
                                <X className="w-4 h-4" aria-hidden="true" />
                            ) : (
                                <Menu className="w-4 h-4" aria-hidden="true" />
                            )}
                        </button>
                    </div>
                </div>

                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.nav
                            id="landing-mobile-nav"
                            aria-label={t('landing.header.sectionsAria')}
                            initial={reduce ? false : { opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduce ? undefined : { opacity: 0, y: -8 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="lg:hidden mt-2 p-4 rounded-2xl bg-[var(--n-surface)] border border-[var(--n-border)] shadow-xl flex flex-col gap-1"
                        >
                            {NAV.map((item) => (
                                <a
                                    key={item.label}
                                    href={item.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--n-muted)] hover:text-[var(--n-text)] hover:bg-[var(--n-elevated)] transition-colors"
                                >
                                    {item.label}
                                </a>
                            ))}
                            <div className="mt-2 pt-3 border-t border-[var(--n-border)] flex flex-col gap-2">
                                <Link
                                    href="/login"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-full py-2.5 text-center text-sm font-medium rounded-xl text-[var(--n-text)] hover:bg-[var(--n-elevated)] transition-colors"
                                >
                                    {t('landing.header.signIn')}
                                </Link>
                                <Link
                                    href="/register"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-full py-2.5 text-center text-sm font-semibold rounded-xl bg-[var(--n-text)] text-[var(--n-base)] hover:opacity-90 transition-opacity"
                                >
                                    {t('landing.header.startFree')}
                                </Link>
                            </div>
                        </motion.nav>
                    )}
                </AnimatePresence>
            </div>
        </header>
    )
}
