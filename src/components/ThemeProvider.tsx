'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'

function applyTheme(theme: 'light' | 'dark' | 'system') {
    const root = document.documentElement
    const resolved =
        theme === 'system'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
            : theme

    root.classList.remove('light', 'dark')
    root.classList.add(resolved)
    // Landing page uses data-theme attribute for CSS variable switching
    root.setAttribute('data-theme', resolved)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { theme } = useAppStore()

    useEffect(() => {
        applyTheme(theme)

        if (theme === 'system') {
            const mq = window.matchMedia('(prefers-color-scheme: dark)')
            const handler = () => applyTheme('system')
            mq.addEventListener('change', handler)
            return () => mq.removeEventListener('change', handler)
        }
    }, [theme])

    return <>{children}</>
}
