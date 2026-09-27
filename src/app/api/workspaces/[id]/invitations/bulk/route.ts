import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  checkWorkspacePermission,
  generateSecureToken,
  getInvitationExpiration,
  isValidInvitationRole,
} from '@/lib/workspace'
import { isValidEmail } from '@/lib/email'
import {
  consumeRateLimits,
  invitationLimitTargets,
  rateLimitedResponse,
} from '@/lib/api/rate-limit'
import { normalizeEmail } from '@/lib/email/normalize'
import { filterSendableTransactional } from '@/lib/email/suppression'
import { deliverInvitationEmail } from '@/lib/invitation-delivery'

// Every accepted row can fire an outbound email, and they are sent one at a time.
export const maxDuration = 60

const MAX_INVITEES = 100

interface BulkError {
  index: number
  email: string
  message: string
}

interface Undelivered {
  email: string
  reason: 'suppressed' | 'provider_error'
}

/**
 * POST /api/workspaces/[id]/invitations/bulk
 * Body: { invitees: Array<{ email: string; role: 'admin' | 'member' | 'viewer' }> }
 *
 * Sends many invitations in one request. Kept separate from the single-invite
 * route on purpose: that one answers 400 for any problem with its one email,
 * whereas a batch reports per-row problems and returns 201 even when some rows
 * failed (the same convention as the products/leads importers).
 *
 * A row can end three ways: not created (`errors`), created and emailed (`sent`),
 * or created but not delivered (`undelivered`) - the invitation exists and its
 * link still works, the admin just has to pass it on themselves.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = params.id
    const body = await request.json().catch(() => null)
    const invitees: unknown = body?.invitees

    if (!Array.isArray(invitees) || invitees.length === 0) {
      return NextResponse.json(
        { error: 'invitees array is required' },
        { status: 400 }
      )
    }

    if (invitees.length > MAX_INVITEES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_INVITEES} invitations per request` },
        { status: 400 }
      )
    }

    const hasPermission = await checkWorkspacePermission(
      workspaceId,
      session.user.id,
      'workspace:invite'
    )

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to send invitations" },
        { status: 403 }
      )
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { owner: true },
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const entries = invitees.map((entry: any) => ({
      email: normalizeEmail(typeof entry?.email === 'string' ? entry.email : ''),
      role: typeof entry?.role === 'string' ? entry.role : '',
    }))

    const candidates = Array.from(
      new Set(entries.map(e => e.email).filter(email => email && isValidEmail(email)))
    )

    // Charge the whole batch up front, as one unit of cost per distinct valid
    // address, and refuse the request as a whole if it does not fit. Counting
    // requests instead would make this endpoint a way around the per-invitation
    // limit. Rows that are later rejected (already a member, ...) are still
    // counted, which errs on the side of the limit.
    if (candidates.length > 0) {
      const limit = await consumeRateLimits(
        invitationLimitTargets(session.user.id, workspaceId),
        candidates.length
      )
      if (!limit.allowed) {
        return rateLimitedResponse(limit, candidates.length)
      }
    }

    // One round of lookups up front instead of several queries per row.
    const [members, existingInvitations, sendable] = await Promise.all([
      // The whole member list rather than `email IN (...)`: Prisma has no
      // case-insensitive `in`, and stored user emails may not be lowercase yet.
      // Comparing in JS is exact whether or not the normalisation migration has run.
      prisma.workspaceMember.findMany({
        where: { workspaceId },
        select: { user: { select: { email: true } } },
      }),
      prisma.invitation.findMany({
        where: { workspaceId, email: { in: candidates } },
      }),
      filterSendableTransactional(candidates, workspaceId),
    ])

    const memberEmails = new Set(members.map(m => normalizeEmail(m.user.email)))
    const ownerEmail = normalizeEmail(workspace.owner.email)
    const senderEmail = normalizeEmail(session.user.email)
    const invitationsByEmail = new Map(
      existingInvitations.map(inv => [inv.email, inv])
    )

    const result = {
      created: 0,
      sent: 0,
      skipped: 0,
      undelivered: [] as Undelivered[],
      errors: [] as BulkError[],
    }

    const reject = (index: number, email: string, message: string) => {
      result.skipped++
      result.errors.push({ index, email, message })
    }

    const seen = new Set<string>()
    const now = new Date()

    // Sequential on purpose: it keeps the mail provider from being hit with a
    // burst, and one failing row cannot affect the others.
    for (const [index, entry] of entries.entries()) {
      const { email, role } = entry

      try {
        if (!email || !isValidEmail(email)) {
          reject(index, email, 'Valid email is required')
          continue
        }

        if (!role || !isValidInvitationRole(role)) {
          reject(index, email, 'Valid role is required (admin, member, or viewer)')
          continue
        }

        if (seen.has(email)) {
          reject(index, email, 'Duplicate email in this request')
          continue
        }
        seen.add(email)

        // The owner has no WorkspaceMember row, so check them separately.
        if (ownerEmail === email) {
          reject(index, email, 'This user already owns this workspace')
          continue
        }

        if (senderEmail === email) {
          reject(index, email, 'You are already a member of this workspace')
          continue
        }

        if (memberEmails.has(email)) {
          reject(index, email, 'User is already a member of this workspace')
          continue
        }

        // Only a *live* pending invitation blocks a new one; expired and declined
        // rows are revived by the upsert below.
        const existing = invitationsByEmail.get(email)
        if (existing && existing.status === 'pending' && existing.expiresAt > now) {
          reject(index, email, 'Invitation already sent to this email')
          continue
        }

        const token = generateSecureToken()
        const expiresAt = getInvitationExpiration(7)

        // [workspaceId, email] is unique, so an old invitation is revived rather
        // than re-created (see the single-invite route for the reasoning).
        const invitation = await prisma.invitation.upsert({
          where: { workspaceId_email: { workspaceId, email } },
          create: {
            email,
            role,
            workspaceId,
            senderId: session.user.id,
            token,
            expiresAt,
          },
          update: {
            role,
            senderId: session.user.id,
            token,
            expiresAt,
            status: 'pending',
            respondedAt: null,
          },
          include: {
            workspace: { select: { name: true, icon: true } },
            sender: { select: { name: true, email: true } },
          },
        })
        result.created++

        const delivery = await deliverInvitationEmail(invitation, sendable.has(email))
        if (delivery.emailSent) {
          result.sent++
        } else {
          result.undelivered.push({ email, reason: delivery.reason })
        }
      } catch (error) {
        // Raw driver messages can leak schema details, so log them and give the
        // client something generic.
        console.error(`Bulk invitation failed for row ${index}:`, error)
        reject(index, email, 'Could not be saved')
      }
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating bulk invitations:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
