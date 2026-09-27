import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findUserByEmail } from '@/lib/api/user'
import { createStarterWorkspace } from '@/lib/onboarding'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { token } = body

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 })
        }

        const verificationToken = await prisma.verificationToken.findUnique({
            where: { token }
        })

        if (!verificationToken) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
        }

        if (verificationToken.expires < new Date()) {
            await prisma.verificationToken.delete({ where: { token } })
            return NextResponse.json({ error: 'Token has expired' }, { status: 400 })
        }

        // `identifier` is value-joined to User.email, and either side may still be
        // mixed-case if it predates normalisation - match insensitively.
        const user = await findUserByEmail(verificationToken.identifier)

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        if (user.emailVerified) {
            return NextResponse.json({ message: 'Email already verified' }, { status: 200 })
        }

        // Update user
        await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: new Date() }
        })

        // Delete token
        await prisma.verificationToken.delete({ where: { token } })

        // Create the initial workspace and its welcome page
        await createStarterWorkspace(user.id)

        return NextResponse.json({ message: 'Email verified successfully' }, { status: 200 })
    } catch (error) {
        console.error('Verification error:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}
