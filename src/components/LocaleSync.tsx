'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useI18n, type Locale } from '@/i18n/I18nProvider'

const LOCALES: Locale[] = ['en', 'fr', 'es', 'ar', 'de']

/**
 * Keeps the signed-in person's saved language (`User.locale`, which their emails
 * and notifications are written in) the same as the language the app shows.
 *
 * - On a browser that has never picked a language, the saved one is applied, so
 *   signing in on a new device opens in the language chosen at sign-up.
 * - After that, every change made with the language switcher is saved.
 *
 * Renders nothing.
 */
export function LocaleSync() {
    const { status } = useSession()
    const { locale, setLocale } = useI18n()
    // undefined until the saved language has been read for this session.
    const [saved, setSaved] = useState<string | null | undefined>(undefined)

    useEffect(() => {
        if (status !== 'authenticated') {
            setSaved(undefined)
            return
        }
        let cancelled = false
        fetch('/api/user')
            .then((res) => (res.ok ? res.json() : null))
            .then((user: { locale?: string | null } | null) => {
                if (cancelled || !user) return
                let chosenHere: string | null = null
                try {
                    chosenHere = localStorage.getItem('app_locale')
                } catch {
                    // Storage blocked: the saved language still applies.
                }
                const stored = user.locale && LOCALES.includes(user.locale as Locale) ? (user.locale as Locale) : null
                if (!chosenHere && stored && stored !== locale) setLocale(stored)
                setSaved(stored)
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
        // Read once per sign-in; the effect below follows later changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status])

    useEffect(() => {
        if (status !== 'authenticated' || saved === undefined || saved === locale) return
        // A browser that never chose waits for the saved language to load instead of
        // overwriting it with the default.
        let chosenHere: string | null = null
        try {
            chosenHere = localStorage.getItem('app_locale')
        } catch {}
        if (saved && !chosenHere) return
        setSaved(locale)
        fetch('/api/user', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale }),
        }).catch(() => {})
    }, [locale, saved, status])

    return null
}
