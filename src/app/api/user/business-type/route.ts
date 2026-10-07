import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDeveloperPipeline } from '@/lib/services/pipelines'

const BUSINESS_TYPES = ['AGENCY', 'DEVELOPER'] as const
type BusinessType = (typeof BUSINESS_TYPES)[number]

function isBusinessType(v: unknown): v is BusinessType {
    return typeof v === 'string' && (BUSINESS_TYPES as readonly string[]).includes(v)
}

/**
 * The one-time choice made in the sign-up popup, which decides whether the
 * account gets the agency or the developer dashboard.
 *
 * The choice is permanent, and that is enforced here rather than in the UI: the
 * update is conditional on `businessType` still being null, so a second request
 * -- a replayed fetch, a second tab, or a hand-rolled call -- changes nothing and
 * answers 409. A plain `update` would have let anyone flip an established
 * account's whole experience.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let body: unknown
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const businessType = (body as { businessType?: unknown })?.businessType
        if (!isBusinessType(businessType)) {
            return NextResponse.json(
                { error: 'Business type must be AGENCY or DEVELOPER' },
                { status: 400 }
            )
        }

        const updated = await prisma.user.updateMany({
            where: { id: session.user.id, businessType: null },
            data: { businessType },
        })

        if (updated.count === 0) {
            return NextResponse.json(
                { error: 'Your business type has already been set and cannot be changed' },
                { status: 409 }
            )
        }

        // A developer sells units off a different funnel, so their workspaces get
        // the buyer-sales board now rather than on next workspace creation. Only
        // workspaces they own: a board is workspace-wide, and adding one to someone
        // else's workspace is not this request's business.
        if (businessType === 'DEVELOPER') {
            const owned = await prisma.workspace.findMany({
                where: { ownerId: session.user.id },
                select: { id: true },
            })
            // Sequential on purpose: each call reads the workspace's boards before
            // writing, and these run at most a handful of times per account.
            for (const workspace of owned) {
                await ensureDeveloperPipeline(workspace.id)
            }
        }

        return NextResponse.json({ businessType })
    } catch (error) {
        console.error('Error setting business type:', error)
        return NextResponse.json({ error: 'Failed to save your business type' }, { status: 500 })
    }
}
