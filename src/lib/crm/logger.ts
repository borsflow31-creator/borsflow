import { prisma } from '../prisma';

/**
 * CRM activity logging: the source of a prospect's history timeline.
 *
 * Mirrors SchedulingLogger (src/lib/scheduling/logger.ts). `Activity.type` and
 * `entityType` are free-form String columns, so new CRM events need no migration.
 *
 * Writes are best-effort: a failed audit row must never fail the user's action.
 */
export type CrmActivityType =
  | 'lead_created'
  | 'lead_updated'
  | 'lead_stage_changed'
  | 'lead_deleted'
  | 'lead_imported'
  | 'file_added'
  | 'file_deleted'
  | 'note_added'
  // Real estate
  | 'property_created'
  | 'property_updated'
  | 'property_status_changed'
  | 'property_stage_changed'
  | 'interest_created'
  | 'interest_stage_changed'
  | 'interest_status_changed'
  | 'mandate_created'
  | 'mandate_status_changed'
  | 'mandate_renewed'
  | 'price_changed'
  | 'offer_made'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'offer_withdrawn'
  | 'viewing_booked'
  | 'viewing_feedback'
  // Developer CRM
  | 'call_logged'
  | 'task_created'
  | 'task_completed'
  | 'site_visit_booked'
  | 'site_visit_completed'
  | 'sales_document_sent'
  | 'sales_document_accepted';

/** What an Activity row is about. The default, for the original lead events, is 'lead'. */
export type CrmEntityType = 'lead' | 'property' | 'interest' | 'mandate' | 'offer' | 'viewing';

/** Fields whose before/after values are worth showing in the history. */
export const TRACKED_LEAD_FIELDS = [
  'firstName', 'lastName', 'email', 'phone', 'company', 'position',
  'status', 'value', 'source', 'notes', 'tags',
  'ownerId', 'campaign', 'interestedProgramId', 'interestedTypology',
  'budgetMin', 'budgetMax', 'preferredLocation',
] as const;

/** One activity row. Every id is optional so an event can appear on each timeline it belongs to. */
export interface CrmActivityInput {
  workspaceId: string;
  userId: string;
  type: CrmActivityType;
  entityType: CrmEntityType;
  entityId: string;
  description: string;
  metadata?: Record<string, unknown>;
  /** The buyer or vendor; puts the event on that contact's timeline. */
  leadId?: string;
  /** Puts the event on the property's timeline. */
  propertyId?: string;
  /** Puts the event on the buyer's interest timeline. */
  interestId?: string;
  meetingId?: string;
}

export class CrmLogger {
  /**
   * Record an event against any entity. A viewing's feedback, for example, is one
   * row that shows on the property (propertyId), on the buyer's interest
   * (interestId) and on the buyer's lead timeline (leadId) -- not three copies.
   */
  static async logEntity(input: CrmActivityInput) {
    try {
      return await prisma.activity.create({
        data: {
          workspaceId: input.workspaceId,
          userId: input.userId,
          type: input.type,
          entityType: input.entityType,
          entityId: input.entityId,
          description: input.description,
          metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
          leadId: input.leadId,
          propertyId: input.propertyId,
          interestId: input.interestId,
          meetingId: input.meetingId,
        },
      });
    } catch (e) {
      console.error('Failed to write CRM activity log to DB:', e);
    }
  }

  static async logActivity(
    workspaceId: string,
    userId: string,
    type: CrmActivityType,
    entityId: string,
    description: string,
    metadata?: Record<string, unknown>,
    leadId?: string
  ) {
    return CrmLogger.logEntity({
      workspaceId,
      userId,
      type,
      entityType: 'lead',
      entityId,
      description,
      metadata,
      leadId,
    });
  }

  static async logStageChange(params: {
    workspaceId: string;
    userId: string;
    leadId: string;
    leadName: string;
    pipelineId: string;
    from: string;
    to: string;
  }) {
    const { workspaceId, userId, leadId, leadName, pipelineId, from, to } = params;
    return CrmLogger.logActivity(
      workspaceId,
      userId,
      'lead_stage_changed',
      leadId,
      `${leadName} moved from "${from}" to "${to}"`,
      { from, to, pipelineId },
      leadId
    );
  }

  static logCreated(params: { workspaceId: string; userId: string; leadId: string; leadName: string; source?: string }) {
    const { workspaceId, userId, leadId, leadName, source } = params;
    return CrmLogger.logActivity(workspaceId, userId, 'lead_created', leadId, `${leadName} was added`, source ? { source } : undefined, leadId);
  }

  /**
   * One entry per save listing what changed. Long free-text fields (notes) only
   * record that they changed, not their content.
   */
  static logUpdated(params: {
    workspaceId: string;
    userId: string;
    leadId: string;
    leadName: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }) {
    const { workspaceId, userId, leadId, leadName, before, after } = params;
    const changes: Array<{ field: string; from?: unknown; to?: unknown }> = [];
    for (const field of TRACKED_LEAD_FIELDS) {
      if (!(field in after)) continue;
      const norm = (v: unknown) => (v === undefined || v === '' ? null : v);
      const from = norm(before[field]);
      const to = norm(after[field]);
      if (JSON.stringify(from) === JSON.stringify(to)) continue;
      changes.push(field === 'notes' ? { field } : { field, from, to });
    }
    if (changes.length === 0) return Promise.resolve(undefined);
    return CrmLogger.logActivity(
      workspaceId,
      userId,
      'lead_updated',
      leadId,
      `${leadName} updated: ${changes.map((c) => c.field).join(', ')}`,
      { changes },
      leadId
    );
  }

  static logFile(params: {
    workspaceId: string;
    userId: string;
    leadId: string;
    fileId: string;
    fileName: string;
    fileType: string;
    size: number;
    action: 'added' | 'deleted';
    /** A managers-only file's history is managers-only too. Omitted means the team. */
    visibility?: string;
  }) {
    const { workspaceId, userId, leadId, fileId, fileName, fileType, size, action, visibility } = params;
    return CrmLogger.logActivity(
      workspaceId,
      userId,
      action === 'added' ? 'file_added' : 'file_deleted',
      fileId,
      `${action === 'added' ? 'Added' : 'Deleted'} file ${fileName}`,
      { fileId, fileName, fileType, size, ...(visibility && visibility !== 'team' ? { visibility } : {}) },
      leadId
    );
  }
}
