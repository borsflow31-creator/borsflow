import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { findUserByEmail } from './api/user'
import { normalizeEmail } from './email/normalize'
import { createStarterWorkspace } from './onboarding'
import { checkRateLimit, consumeRateLimits, type RateLimitRule } from './api/rate-limit'
import { TeamLogger } from './team/logger'

/** Failed password attempts allowed per address before sign-in is paused. */
const LOGIN_FAILURE_LIMIT: RateLimitRule = {
    bucket: 'auth:login-failure',
    limit: 10,
    windowMs: 15 * 60 * 1000,
    windowLabel: '15 minutes',
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email and password required')
                }

                // Failed attempts are counted per address, so a password can't be
                // guessed with unlimited tries. Only failures count, so a normal
                // sign-in never uses up the allowance.
                const attempts = {
                    subject: `email:${normalizeEmail(credentials.email)}`,
                    rule: LOGIN_FAILURE_LIMIT,
                }
                if (!(await checkRateLimit(attempts)).allowed) {
                    throw new Error('Too many failed sign-in attempts. Try again in a few minutes.')
                }

                // Case-insensitive: the address may have been stored as typed at sign-up.
                const user = await findUserByEmail(credentials.email)

                if (!user || !user.password) {
                    await consumeRateLimits([attempts])
                    throw new Error('Invalid credentials')
                }

                const isPasswordValid = await bcrypt.compare(
                    credentials.password,
                    user.password
                )

                if (!isPasswordValid) {
                    await consumeRateLimits([attempts])
                    throw new Error('Invalid credentials')
                }

                if (!user.emailVerified) {
                    throw new Error('Please verify your email address before logging in')
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    notificationsEmail: user.notificationsEmail,
                    notificationsPush: user.notificationsPush,
                    businessType: user.businessType,
                }
            },
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        }),
    ],
    session: {
        strategy: 'jwt',
    },
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async signIn({ user, account, profile }) {
            if (account?.provider === 'google') {
                if (!user.email) return false;
                
                // Match case-insensitively, otherwise a Google profile whose email
                // differs only in case from an existing account would create a
                // second User (plus its own workspace and starter page).
                const googleEmail = normalizeEmail(user.email);
                let dbUser = await findUserByEmail(googleEmail);

                if (!dbUser) {
                    dbUser = await prisma.user.create({
                        data: {
                            email: googleEmail,
                            name: user.name,
                            emailVerified: new Date(),
                        }
                    });
                    
                    await createStarterWorkspace(dbUser.id);
                }
                
                // Override user id with database id
                user.id = dbUser.id;
                return true;
            }
            return true;
        },
        async jwt({ token, user, account, trigger }) {
            // Tokens issued before emails were normalised carry the address as typed.
            if (token.email) token.email = normalizeEmail(token.email)
            if (user) {
                token.id = user.id
                token.notificationsEmail = user.notificationsEmail
                token.notificationsPush = user.notificationsPush
                token.businessType = user.businessType ?? null
            }
            if (account?.provider === 'google' && token.email) {
                const dbUser = await findUserByEmail(token.email, {
                    select: { id: true, notificationsEmail: true, notificationsPush: true, businessType: true },
                });
                if (dbUser) {
                    token.id = dbUser.id;
                    token.notificationsEmail = dbUser.notificationsEmail;
                    token.notificationsPush = dbUser.notificationsPush;
                    token.businessType = dbUser.businessType;
                }
            }
            // Re-validate that the stored id still exists in the DB (guards against DB
            // resets). This callback runs on every getServerSession, i.e. every API
            // call, so only re-check on sign-in/update or every 10 minutes.
            const RECHECK_MS = 10 * 60 * 1000
            const due = !!user || !!account || trigger === 'update' ||
                !token.checkedAt || Date.now() - (token.checkedAt as number) > RECHECK_MS
            if (token.id && token.email && due) {
                token.checkedAt = Date.now()
                const exists = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    select: { id: true, notificationsEmail: true, notificationsPush: true, businessType: true },
                });
                if (!exists) {
                    const dbUser = await findUserByEmail(token.email as string, {
                        select: { id: true, notificationsEmail: true, notificationsPush: true, businessType: true },
                    });
                    if (dbUser) {
                        token.id = dbUser.id;
                        token.notificationsEmail = dbUser.notificationsEmail;
                        token.notificationsPush = dbUser.notificationsPush;
                        token.businessType = dbUser.businessType;
                    }
                } else {
                    token.notificationsEmail = exists.notificationsEmail;
                    token.notificationsPush = exists.notificationsPush;
                    // Re-read every time this check is due, so the choice made in the
                    // popup reaches the session on the update() that follows it.
                    token.businessType = exists.businessType;
                }
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                // Repairs sessions whose JWT was minted before emails were
                // normalised, so no one has to sign in again.
                if (session.user.email) session.user.email = normalizeEmail(session.user.email)
                session.user.id = token.id as string
                session.user.notificationsEmail = token.notificationsEmail ?? true
                session.user.notificationsPush = token.notificationsPush ?? true
                session.user.businessType = token.businessType ?? null
            }
            return session
        },
    },
    events: {
        // Goes in each workspace's activity log, so admins can see when their team
        // was last in. Resolved by email: a Google sign-in's `user.id` is the
        // provider's, not ours.
        async signIn({ user, account }) {
            const method = account?.provider ?? 'credentials'
            const id = user.email
                ? (await findUserByEmail(user.email, { select: { id: true } }))?.id
                : user.id
            if (id) void TeamLogger.logSignIn(id, method)
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
}
