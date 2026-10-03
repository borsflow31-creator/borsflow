import NextAuth from 'next-auth'

declare module 'next-auth' {
    interface Session {
        user: {
            id: string
            email: string
            name: string | null
            theme?: 'light' | 'dark' | 'system'
            notificationsEmail?: boolean
            notificationsPush?: boolean
        }
    }

    interface User {
        id: string
        email: string
        name: string | null
        theme?: 'light' | 'dark' | 'system'
        notificationsEmail?: boolean
        notificationsPush?: boolean
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
    }
}
