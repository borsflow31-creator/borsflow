import { prisma } from '@/lib/prisma'
import { CrmLogger } from '@/lib/crm/logger'
import { ServiceError } from '../errors'
import { readBoolean, readNumber, readString } from '../parse'
import type { DeveloperContext } from './programs'
import { touchLead } from './lead-sync'
import { createTask } from './tasks'

export const CALL_DIRECTIONS = ['outbound', 'inbound'] as const

/**
 * Records a phone call with a lead.
 *
 * There is no telephony integration, so a call is logged by the person who made
 * it. It becomes an Activity row (type 'call_logged') -- the same table the lead
 * timeline and the team activity board already read -- rather than a table of its
 * own, so it shows up in both with no extra plumbing.
 *
 * Only an answered call counts as contact: ringing out is worth recording (and
 * counts as a call made), but it does not mean the lead has been spoken to, so it
 * leaves lastContactedAt alone and the lead stays on the "not reached" list.
 *
 * `followUpAt` books the next call-back in the same step, since the moment you
 * hang up is when you know when to call again.
 */
export async function logCall(
  ctx: DeveloperContext,
  leadId: string,
  input: Record<string, unknown>
) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, pipeline: { workspaceId: ctx.workspaceId } },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!lead) throw new ServiceError('Lead not found in this workspace', 404)

  const direction = readString(input, 'direction', 'Direction') ?? 'outbound'
  if (!(CALL_DIRECTIONS as readonly string[]).includes(direction)) {
    throw new ServiceError('Direction must be outbound or inbound')
  }
  const answered = readBoolean(input, 'answered', 'Answered')
  if (answered === undefined) throw new ServiceError('Say whether the call was answered')
  const durationMin = readNumber(input, 'durationMin', 'Duration', { min: 0, integer: true }) ?? null
  if (durationMin !== null && durationMin > 600) throw new ServiceError('Duration is too long')
  const note = readString(input, 'note', 'Note', { max: 1000 }) ?? null

  const name = `${lead.firstName} ${lead.lastName}`.trim()
  const activity = await CrmLogger.logEntity({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    type: 'call_logged',
    entityType: 'lead',
    entityId: lead.id,
    description: `${direction === 'inbound' ? 'Call from' : 'Call to'} ${name}: ${answered ? 'answered' : 'no answer'}`,
    metadata: { direction, answered, durationMin, note },
    leadId: lead.id,
  })

  if (answered) await touchLead(lead.id)

  let task = null
  if (input.followUpAt !== undefined && input.followUpAt !== null && input.followUpAt !== '') {
    task = await createTask(ctx, {
      leadId: lead.id,
      type: 'call',
      title: answered ? `Follow up with ${name}` : `Call ${name} back`,
      dueAt: input.followUpAt as string,
    })
  }

  return { activity, task }
}
