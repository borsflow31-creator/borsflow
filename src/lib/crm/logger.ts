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
  | 'note_added';

/** Fields whose before/after values are worth showing in the history. */
export const TRACKED_LEAD_FIELDS = [
  'firstName', 'lastName', 'email', 'phone', 'company', 'position',
  'status', 'value', 'source', 'notes', 'tags',
] as const;

export class CrmLogger {
  static async logActivity(
    workspaceId: string,
    userId: string,
    type: CrmActivityType,
    entityId: string,
    description: string,
    metadata?: Record<string, unknown>,
    leadId?: string
  ) {
    try {
      return await prisma.activity.create({
        data: {
          workspaceId,
          userId,
          type,
          entityType: 'lead',
          entityId,
          description,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
          leadId,
        },
      });
    } catch (e) {
      console.error('Failed to write CRM activity log to DB:', e);
    }
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
  }) {
    const { workspaceId, userId, leadId, fileId, fileName, fileType, size, action } = params;
    return CrmLogger.logActivity(
      workspaceId,
      userId,
      action === 'added' ? 'file_added' : 'file_deleted',
      fileId,
      `${action === 'added' ? 'Added' : 'Deleted'} file ${fileName}`,
      { fileId, fileName, fileType, size },
      leadId
    );
  }
}
