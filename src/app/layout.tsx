import type { Metadata, Viewport } from 'next'
import { DM_Sans, Albert_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

/* Three faces, one job each: DM Sans sets body and UI, Albert Sans carries
   display, JetBrains Mono carries data and measurement. All self-hosted
   through next/font, which replaces the duplicate @import + <link> pairs
   that previously loaded each family twice. */
const dmSans = DM_Sans({
    subsets: ['latin'],
    weight: ['400', '500', '600'],
    variable: '--font-dm-sans',
    display: 'swap',
})

const albertSans = Albert_Sans({
    subsets: ['latin'],
    weight: ['600', '700'],
    variable: '--font-albert',
    display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    weight: ['400'],
    variable: '--font-jetbrains',
    display: 'swap',
})

const siteUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    themeColor: [
        { media: '(prefers-color-scheme: dark)', color: '#0a0b0e' },
        { media: '(prefers-color-scheme: light)', color: '#f7f7fa' },
    ],
}

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: {
        default: 'BorsFlow — documents, CRM and billing on one database',
        template: '%s · BorsFlow',
    },
    description:
        'One workspace for block documents, a sales pipeline, quotes, invoices, email campaigns and scheduling. Draft a scope, attach a quote, get it paid — without leaving the tab.',
    applicationName: 'BorsFlow',
    manifest: '/manifest.json',
    openGraph: {
        type: 'website',
        url: siteUrl,
        siteName: 'BorsFlow',
        title: 'BorsFlow — documents, CRM and billing on one database',
        description:
            'One workspace for block documents, a sales pipeline, quotes, invoices, email campaigns and scheduling.',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'BorsFlow — documents, CRM and billing on one database',
        description:
            'One workspace for block documents, a sales pipeline, quotes, invoices, email campaigns and scheduling.',
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'BorsFlow',
    },
    formatDetection: { telephone: false },
    icons: {
        // SVG first: browsers that support it use it for the tab, so the mark
        // stays sharp at 16px instead of being downscaled from a 192px raster.
        // ?v= busts the favicon cache, which browsers keep across deploys; bump
        // it whenever the artwork changes. The PNG fallback is a circular size:
        // 192 and 512 are full-bleed maskable squares meant for the OS to crop.
        icon: [
            { url: '/icons/icon.svg?v=2', type: 'image/svg+xml' },
            { url: '/icons/icon-96x96.png?v=2', sizes: '96x96', type: 'image/png' },
        ],
        apple: [{ url: '/icons/apple-touch-icon.png?v=2', sizes: '180x180', type: 'image/png' }],
        shortcut: '/icons/icon.svg?v=2',
    },
}

/* Resolves the theme before first paint. Without this the document renders
   light, then ThemeProvider swaps it on hydration, so every dark-mode visitor
   sees a white flash and every light-mode visitor a dark one. Reads the same
   persisted Zustand key ThemeProvider writes. */
const themeScript = `(function(){try{var t='system',r=localStorage.getItem('app-storage');if(r){var p=JSON.parse(r);if(p&&p.state&&p.state.theme){t=p.state.theme}}var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches),v=d?'dark':'light',e=document.documentElement;e.classList.remove('light','dark');e.classList.add(v);e.setAttribute('data-theme',v)}catch(e){}})();`

/* Same problem as themeScript, for locale: without this the page always
   paints lang="en" dir="ltr" first, then I18nProvider flips it on mount, so
   an Arabic-locale visitor sees a flash of LTR layout before it mirrors to RTL. */
const localeScript = `(function(){try{var l=localStorage.getItem('app_locale');if(l){var e=document.documentElement;e.lang=l;e.dir=(l==='ar')?'rtl':'ltr'}}catch(e){}})();`

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" dir="ltr" className={`${dmSans.variable} ${albertSans.variable} ${jetbrainsMono.variable}`}>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeScript }} />
                <script dangerouslySetInnerHTML={{ __html: localeScript }} />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
                    rel="stylesheet"
                />
            </head>
            <body className="font-sans">
                <Providers>{children}</Providers>
            </body>
        </html>
    )
}
