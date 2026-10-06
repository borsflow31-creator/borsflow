import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWorkspaceRole, requireWorkspaceAccess, requireWorkspacePermission } from '@/lib/api/workspace'
import type { Role } from '@/lib/workspace'

/**
 * Access checks for the real-estate records.
 *
 * The same convention as getLeadAccess in src/lib/crm/lead-access.ts: access is
 * derived from the record (a property -> its workspace), never from a
 * `workspaceId` the client sends alongside it, so a caller cannot reach another
 * agency's data by lying about which workspace an id belongs to. `write` also
 * requires content permission, because viewers belong to the workspace but are
 * read-only.
 *
 * Each helper returns `{ access }` or `{ error }`, where `error` is a ready
 * NextResponse, so a route is two lines:
 *
 *   const result = await getPropertyAccess(params.id, { write: true })
 *   if ('error' in result) return result.error
 */

export interface WorkspaceAccess {
  workspaceId: string
  userId: string
  role: Role
  /** Owner and admins can act on other people's records. */
  canModerate: boolean
}

export interface RecordAccess<T> extends WorkspaceAccess {
  record: T
}

type Failure = { error: NextResponse }

/** Membership (or, for `write`, content permission) in a workspace. */
export async function getWorkspaceAccess(
  workspaceId: string,
  opts: { write?: boolean } = {}
): Promise<{ access: WorkspaceAccess } | Failure> {
  const result = opts.write
    ? await requireWorkspacePermission(workspaceId, 'content:create')
    : await requireWorkspaceAccess(workspaceId)

  if ('error' in result) {
    return { error: NextResponse.json({ error: result.error }, { status: result.status }) }
  }

  const userId = result.session.user.id
  const role: Role = 'role' in result && result.role ? (result.role as Role) : await getWorkspaceRole(workspaceId, userId)

  return {
    access: { workspaceId, userId, role, canModerate: role === 'owner' || role === 'admin' },
  }
}

async function viaRecord<T extends { workspaceId: string }>(
  record: T | null,
  notFound: string,
  opts: { write?: boolean }
): Promise<{ access: RecordAccess<T> } | Failure> {
  if (!record) return { error: NextResponse.json({ error: notFound }, { status: 404 }) }
  const result = await getWorkspaceAccess(record.workspaceId, opts)
  if ('error' in result) return result
  return { access: { ...result.access, record } }
}

export async function getPropertyAccess(id: string, opts: { write?: boolean } = {}) {
  return viaRecord(
    await prisma.property.findUnique({
      where: { id },
      select: {
        id: true, workspaceId: true, title: true, reference: true, status: true, stage: true,
        pipelineId: true, price: true, currency: true, vendorId: true, ownerId: true, listedAt: true,
        publicToken: true,
      },
    }),
    'Property not found',
    opts
  )
}

export async function getInterestAccess(id: string, opts: { write?: boolean } = {}) {
  return viaRecord(
    await prisma.interest.findUnique({
      where: { id },
      select: {
        id: true, workspaceId: true, pipelineId: true, stage: true, status: true,
        leadId: true, propertyId: true, ownerId: true,
        lead: { select: { id: true, firstName: true, lastName: true, email: true } },
        property: { select: { id: true, title: true, reference: true } },
      },
    }),
    'Interest not found',
    opts
  )
}

export async function getMandateAccess(id: string, opts: { write?: boolean } = {}) {
  return viaRecord(
    await prisma.mandate.findUnique({
      where: { id },
      select: {
        id: true, workspaceId: true, reference: true, status: true, propertyId: true, leadId: true,
        askingPrice: true, endDate: true, ownerId: true, publicToken: true,
        property: { select: { id: true, title: true, currency: true, price: true } },
      },
    }),
    'Mandate not found',
    opts
  )
}

export async function getOfferAccess(id: string, opts: { write?: boolean } = {}) {
  return viaRecord(
    await prisma.offer.findUnique({
      where: { id },
      select: {
        id: true, workspaceId: true, propertyId: true, interestId: true, leadId: true,
        amount: true, currency: true, status: true, expiresAt: true, publicToken: true,
      },
    }),
    'Offer not found',
    opts
  )
}

export async function getProgramAccess(id: string, opts: { write?: boolean } = {}) {
  return viaRecord(
    await prisma.program.findUnique({
      where: { id },
      select: {
        id: true, workspaceId: true, reference: true, name: true, status: true,
        city: true, publicToken: true, createdById: true,
      },
    }),
    'Project not found',
    opts
  )
}

/**
 * The people a record can be assigned to: owner and members of the workspace.
 * Assigning an agent from another workspace would hand them a record they could
 * not open, so every `ownerId` a client sends is checked against this.
 */
export async function isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    select: { id: true },
  })
  return !!workspace
}
