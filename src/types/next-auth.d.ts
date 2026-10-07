import NextAuth from 'next-auth'

/** Mirrors the Prisma enum, kept local so client bundles need no Prisma import. */
export type BusinessType = 'AGENCY' | 'DEVELOPER'

declare module 'next-auth' {
    interface Session {
        user: {
            id: string
            email: string
            name: string | null
            theme?: 'light' | 'dark' | 'system'
            notificationsEmail?: boolean
            notificationsPush?: boolean
            /** Null until the account picks one, which is what shows the sign-up popup. */
            businessType?: BusinessType | null
        }
    }

    interface User {
        id: string
        email: string
        name: string | null
        theme?: 'light' | 'dark' | 'system'
        notificationsEmail?: boolean
        notificationsPush?: boolean
        businessType?: BusinessType | null
        /** When the user row was last confirmed to exist (ms since epoch) */
        checkedAt?: number
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string
        theme?: 'light' | 'dark' | 'system'
        notificationsEmail?: boolean
        notificationsPush?: boolean
        businessType?: BusinessType | null
    }
}
