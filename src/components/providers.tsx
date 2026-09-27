'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from './ThemeProvider'
import { I18nProvider } from '@/i18n/I18nProvider'

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <I18nProvider>
                <ThemeProvider>{children}</ThemeProvider>
            </I18nProvider>
        </SessionProvider>
    )
}
