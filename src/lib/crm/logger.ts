import { prisma } from '../prisma';

/**
 * CRM activity logging.
 *
 * Mirrors SchedulingLogger (src/lib/scheduling/logger.ts), which types its `type`
 * parameter as a closed union of meeting events. `Activity.type` and
 * `entityType` are free-form String columns, so CRM events need no migration.
 *
 * Writes are best-effort: a failed audit row must never fail the user's action.
 */
export class CrmLogger {
  static async logActivity(
    workspaceId: string,
    userId: string,
    type: 'lead_stage_changed' | 'lead_created' | 'lead_deleted',
    entityId: string,
    description: string,
    metadata?: any,
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
}
