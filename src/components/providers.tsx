'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from './ThemeProvider'
import { I18nProvider } from '@/i18n/I18nProvider'
import { PlanLimitModal } from './billing/PlanLimitModal'
import { LocaleSync } from './LocaleSync'

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <I18nProvider>
                <ThemeProvider>
                    {children}
                    <PlanLimitModal />
                    <LocaleSync />
                </ThemeProvider>
            </I18nProvider>
        </SessionProvider>
    )
}
