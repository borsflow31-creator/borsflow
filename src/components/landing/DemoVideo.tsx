'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, Volume2, VolumeX, X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'

/* The demo opens in a dialog rather than sitting inline: a 2.8 MB video on the
   fold would compete with the capture for the LCP and load for every visitor
   whether they wanted it or not. Nothing is fetched until the button is
   pressed, because <video> is only mounted while the dialog is open.
 *
 * It then autoplays muted and loops — autoplay is only permitted muted — with
 * an explicit control for sound, so audio never arrives unasked. */
interface DemoVideoProps {
    /** Extra classes for the trigger. */
    className?: string
    /* The hero's entrance animation targets [data-hero="action"]. It is applied
       to the trigger itself rather than a wrapper, so the button stays a direct
       flex child of the CTA row - a wrapping <span> would absorb items-stretch
       and leave this button at content width beside a full-width primary. */
    'data-hero'?: string
}

export const DemoVideo = ({ className = '', ...triggerProps }: DemoVideoProps) => {
    const { t } = useI18n()
    const [open, setOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [muted, setMuted] = useState(true)
    const videoRef = useRef<HTMLVideoElement>(null)
    const closeRef = useRef<HTMLButtonElement>(null)
    const dialogRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)

    const close = useCallback(() => setOpen(false), [])

    // Portalled to <body> because the hero's GSAP timeline leaves a transform on
    // the trigger, and a transformed ancestor becomes the containing block for
    // position:fixed — which would pin the dialog inside the hero.
    useEffect(() => setMounted(true), [])

    useEffect(() => {
        if (!open) {
            // Return focus to the control that opened the dialog.
            triggerRef.current?.focus()
            return
        }

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        closeRef.current?.focus()

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                close()
                return
            }
            if (e.key !== 'Tab') return
            // Keep focus inside the dialog while it is modal.
            const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
                'button, [href], video[controls], [tabindex]:not([tabindex="-1"])'
            )
            if (!focusables || focusables.length === 0) return
            const first = focusables[0]
            const last = focusables[focusables.length - 1]
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first.focus()
            }
        }

        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = previousOverflow
        }
    }, [open, close])

    const toggleSound = () => {
        const v = videoRef.current
        if (!v) return
        v.muted = !v.muted
        setMuted(v.muted)
        if (!v.muted) void v.play().catch(() => {})
    }

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                {...triggerProps}
                onClick={() => {
                    setMuted(true)
                    setOpen(true)
                }}
                className={`taste-btn-ghost px-6 py-3.5 text-sm ${className}`.trim()}
            >
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('landing.demoVideo.watchDemo')}</span>
                <span className="t-data text-xs text-[var(--n-muted)]">0:21</span>
            </button>

            {open && mounted && createPortal(
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-[var(--n-base)]/95 backdrop-blur-md"
                    onClick={close}
                >
                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('landing.demoVideo.dialogLabel')}
                        className="relative w-full max-w-5xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-4 pb-3">
                            <p className="text-xs text-[var(--n-text)]">
                                {t('landing.demoVideo.recordedFrom')}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={toggleSound}
                                    aria-pressed={!muted}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--n-border)] bg-[var(--n-surface)] text-xs text-[var(--n-muted)] transition-colors hover:text-[var(--n-text)] hover:border-[var(--n-border-strong)]"
                                >
                                    {muted ? (
                                        <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
                                    ) : (
                                        <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                                    )}
                                    {muted ? t('landing.demoVideo.soundOff') : t('landing.demoVideo.soundOn')}
                                </button>
                                <button
                                    ref={closeRef}
                                    type="button"
                                    onClick={close}
                                    aria-label={t('landing.demoVideo.closeDemo')}
                                    className="w-8 h-8 rounded-full border border-[var(--n-border)] bg-[var(--n-surface)] text-[var(--n-muted)] flex items-center justify-center transition-colors hover:text-[var(--n-text)] hover:border-[var(--n-border-strong)]"
                                >
                                    <X className="w-4 h-4" aria-hidden="true" />
                                </button>
                            </div>
                        </div>

                        <div className="taste-plinth overflow-hidden p-1.5 sm:p-2">
                            <video
                                ref={videoRef}
                                src="/brag.mp4"
                                poster="/brag-poster.webp"
                                autoPlay
                                muted
                                loop
                                playsInline
                                controls
                                className="w-full h-auto rounded-[0.9rem] bg-[var(--n-base)]"
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
