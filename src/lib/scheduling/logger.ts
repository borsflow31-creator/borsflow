import { prisma } from '../prisma';

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

export class SchedulingLogger {
  /**
   * Logs a synchronization event into the database for audit tracking
   */
  static async logSync(
    workspaceId: string,
    integrationId: string,
    operationType: 'full_sync' | 'incremental_sync' | 'event_create' | 'event_update' | 'event_delete',
    status: 'started' | 'completed' | 'failed' | 'partial',
    stats: {
      processed?: number;
      created?: number;
      updated?: number;
      deleted?: number;
      skipped?: number;
    } = {},
    errorMessage?: string,
    errorDetails?: any,
    durationMs?: number
  ) {
    try {
      return await prisma.calendarSyncLog.create({
        data: {
          calendarIntegrationId: integrationId,
          operationType,
          status,
          eventsProcessed: stats.processed || 0,
          eventsCreated: stats.created || 0,
          eventsUpdated: stats.updated || 0,
          eventsDeleted: stats.deleted || 0,
          eventsSkipped: stats.skipped || 0,
          errorMessage,
          errorDetails: errorDetails ? JSON.stringify(errorDetails) : undefined,
          durationMs,
          completedAt: status !== 'started' ? new Date() : undefined,
        }
      });
    } catch (e) {
      console.error('Failed to write sync log to DB:', e);
    }
  }

  /**
   * Logs a scheduling-related activity to the generic activity log
   */
  static async logActivity(
    workspaceId: string,
    userId: string,
    type: 'meeting_created' | 'meeting_updated' | 'meeting_cancelled' | 'meeting_completed' | 'attendee_added' | 'note_added',
    entityType: 'meeting' | 'attendee' | 'note',
    entityId: string,
    description: string,
    metadata?: any,
    meetingId?: string,
    leadId?: string
  ) {
    try {
      return await prisma.activity.create({
        data: {
          workspaceId,
          userId,
          type,
          entityType,
          entityId,
          description,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
          meetingId,
          leadId,
        }
      });
    } catch (e) {
      console.error('Failed to write activity log to DB:', e);
    }
  }
}
