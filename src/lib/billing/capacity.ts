import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { capacityLimit, type CapacityResource } from './plans'
import { getWorkspacePlan, planLimitResponse } from './entitlements'
import { CLOSED_PROPERTY_STATUSES } from '@/lib/crm/lifecycle'

/**
 * Stock limits: how many contacts, properties, mandates, boards and feeds a workspace
 * holds at once.
 *
 * These are counted live rather than metered. A monthly counter (UsageCounter) measures
 * flow, and forcing a listing through it would leave a workspace that created and sold
 * 25 homes in January permanently full. Counting what exists means a sold or withdrawn
 * listing frees its place the moment it closes.
 *
 * The check is a count followed by a write, so two simultaneous creates can overshoot by
 * one, exactly as `memberCapacityError` does. Accepted: the limit is a plan boundary,
 * not a safety invariant.
 */

const LABELS: Record<CapacityResource, string> = {
  contacts: 'contacts',
  properties: 'properties',
  activeMandates: 'active mandates',
  pipelines: 'boards of this kind',
  portalFeeds: 'portal feeds',
}

export async function usedCapacity(
  workspaceId: string,
  resource: CapacityResource,
  opts: { subjectType?: string } = {}
): Promise<number> {
  switch (resource) {
    case 'contacts':
      return prisma.lead.count({ where: { pipeline: { workspaceId } } })
    case 'properties':
      return prisma.property.count({ where: { workspaceId, status: { notIn: [...CLOSED_PROPERTY_STATUSES] } } })
    case 'activeMandates':
      return prisma.mandate.count({ where: { workspaceId, status: 'active' } })
    case 'pipelines':
      // Per kind of record, so the boards every workspace is seeded with do not eat
      // into the allowance for the ones it creates itself.
      return prisma.pipeline.count({ where: { workspaceId, subjectType: opts.subjectType ?? 'Lead' } })
    case 'portalFeeds':
      return prisma.portalFeed.count({ where: { workspaceId } })
  }
}

/**
 * A 402 PLAN_LIMIT response when adding `adding` more would pass the plan's limit,
 * otherwise null.
 */
export async function capacityError(
  workspaceId: string,
  resource: CapacityResource,
  opts: { adding?: number; subjectType?: string } = {}
): Promise<NextResponse | null> {
  const { plan } = await getWorkspacePlan(workspaceId)
  const limit = capacityLimit(plan.limits, resource)
  if (limit === null) return null

  const used = await usedCapacity(workspaceId, resource, opts)
  if (used + (opts.adding ?? 1) <= limit) return null

  return planLimitResponse({
    kind: resource,
    limit,
    used,
    message: limit === 0
      ? `Your plan does not include ${LABELS[resource]}.`
      : `Your plan includes ${limit} ${LABELS[resource]}, and you have ${used}.`,
  })
}
