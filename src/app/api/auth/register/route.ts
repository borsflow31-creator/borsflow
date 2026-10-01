import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

import crypto from 'crypto'
import { isValidEmail, sendVerificationEmail } from '@/lib/email'
import { normalizeEmail } from '@/lib/email/normalize'
import { findUserByEmail } from '@/lib/api/user'
import { consumeRateLimits, rateLimitHeaders, type RateLimitRule } from '@/lib/api/rate-limit'
import { safeCallbackUrl } from '@/lib/url'

/**
 * Sign-ups per IP, so accounts cannot be created in bulk, and per address,
 * because every attempt on an unverified address re-sends a verification
 * email - without a cap this endpoint could be used to flood someone's inbox.
 */
const SIGNUP_PER_IP: RateLimitRule = {
    bucket: 'auth:signup',
    limit: 10,
    windowMs: 60 * 60 * 1000,
    windowLabel: 'hour',
}
const SIGNUP_PER_EMAIL: RateLimitRule = {
    bucket: 'auth:signup',
    limit: 5,
    windowMs: 60 * 60 * 1000,
    windowLabel: 'hour',
}

/** Same minimum the change-password route enforces. */
const MIN_PASSWORD_LENGTH = 8

/** Replace any outstanding verification token for `email` with a fresh one. */
async function issueVerificationToken(email: string): Promise<string> {
    const token = crypto.randomUUID()
    await prisma.verificationToken.deleteMany({ where: { identifier: email } })
    await prisma.verificationToken.create({
        data: {
            identifier: email,
            token,
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
    })
    return token
}

const EMAIL_FAILED =
    "Your account is ready, but we couldn't send the verification email. Please try signing up again in a moment to get a new one."

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { password, name } = body
        // Carried across the verification hop so an invited user returns to the
        // invitation instead of the dashboard. Re-validated here because the
        // client's own check is not a trust boundary.
        const callbackUrl = safeCallbackUrl(body.callbackUrl, null)
        // Stored lowercase so `Bob@x.com` and `bob@x.com` can never become two
        // accounts, and so invitations (also lowercase) always match the user.
        const email = normalizeEmail(body.email)

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            )
        }

        // A malformed address used to create the account and then fail inside the
        // mailer, answering 500 with the account already saved.
        if (!isValidEmail(email)) {
            return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
        }

        if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
            return NextResponse.json(
                { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
                { status: 400 }
            )
        }

        // After validation, so a malformed request costs nothing; before any
        // lookup or email, so a blocked one does no work.
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
        const limit = await consumeRateLimits(
            [
                { subject: `ip:${ip}`, rule: SIGNUP_PER_IP },
                { subject: `email:${email}`, rule: SIGNUP_PER_EMAIL },
            ],
            1
        )
        if (!limit.allowed) {
            return NextResponse.json(
                { error: 'Too many sign-up attempts. Please try again later.' },
                { status: 429, headers: rateLimitHeaders(limit) }
            )
        }

        // Case-insensitive, so it also catches accounts created before
        // normalisation, which may still be stored mixed-case.
        const existingUser = await findUserByEmail(email, { select: { id: true, emailVerified: true } })

        if (existingUser?.emailVerified) {
            return NextResponse.json(
                { error: 'User already exists' },
                { status: 400 }
            )
        }

        // An unverified account for this address is a sign-up that never finished,
        // usually because its verification email didn't arrive. Signing up again
        // re-sends the email. The password is deliberately left unchanged, so
        // someone who doesn't control the inbox can't take over the pending account.
        if (existingUser) {
            const token = await issueVerificationToken(email)
            try {
                await sendVerificationEmail(email, token, callbackUrl)
            } catch (error) {
                console.error('Resend verification error:', error)
                return NextResponse.json({ error: EMAIL_FAILED }, { status: 503 })
            }
            return NextResponse.json(
                { message: 'Verification email sent. Check your inbox to finish signing up.' },
                { status: 200 }
            )
        }

        const hashedPassword = await bcrypt.hash(password, 12)

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name || null,
            },
        })

        const token = await issueVerificationToken(email)

        // If delivery fails the account still exists, but it is no longer stuck:
        // signing up again re-sends the email (above).
        try {
            await sendVerificationEmail(email, token, callbackUrl)
        } catch (error) {
            console.error('Verification email error:', error)
            return NextResponse.json({ error: EMAIL_FAILED }, { status: 503 })
        }

        return NextResponse.json(
            {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                },
            },
            { status: 201 }
        )
    } catch (error) {
        console.error('Registration error:', error)
        return NextResponse.json(
            { error: 'Something went wrong' },
            { status: 500 }
        )
    }
}
