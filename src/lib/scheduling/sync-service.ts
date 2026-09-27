import { prisma } from '../prisma';
import { CalComClient } from './calcom-client';
import { ZoomClient } from './zoom-client';
import { GoogleCalendarClient } from './google-calendar-client';
import { SchedulingLogger } from './logger';
import { decrypt } from '../encryption';

export class SyncService {
  /**
   * Orchestrates a full sync for a specific calendar integration
   */
  async fullSyncCalendar(integrationId: string) {
    const integration = await prisma.calendarIntegration.findUnique({
      where: { id: integrationId },
      include: { workspace: true }
    });

    if (!integration || !integration.isActive || !integration.accessToken) return;

    const startTime = Date.now();
    let stats = { processed: 0, created: 0, updated: 0, deleted: 0, skipped: 0 };
    
    try {
      const accessToken = decrypt(integration.accessToken);
      
      if (integration.type === 'calcom') {
        stats = await this.syncCalCom(integration, accessToken);
      } else if (integration.type === 'google_calendar') {
        stats = await this.syncGoogleCalendar(integration, accessToken);
      }
      
      // Update integration state
      await prisma.calendarIntegration.update({
        where: { id: integrationId },
        data: {
          lastSyncAt: new Date(),
          syncStatus: 'active',
          lastSyncError: undefined
        }
      });
      
      await SchedulingLogger.logSync(
        integration.workspaceId,
        integrationId,
        'full_sync',
        'completed',
        stats,
        undefined,
        undefined,
        Date.now() - startTime
      );
      
    } catch (error: any) {
      console.error(`Sync failed for integration ${integrationId}:`, error);
      
      await prisma.calendarIntegration.update({
        where: { id: integrationId },
        data: {
          syncStatus: 'error',
          lastSyncError: error.message
        }
      });
      
      await SchedulingLogger.logSync(
        integration.workspaceId,
        integrationId,
        'full_sync',
        'failed',
        stats,
        error.message,
        error,
        Date.now() - startTime
      );
    }
  }

  /**
   * Helper for Cal.com synchronization
   */
  private async syncCalCom(integration: any, accessToken: string) {
    const client = new CalComClient(accessToken);
    const bookings = await client.getBookings();
    
    let created = 0, updated = 0, skipped = 0;
    
    for (const booking of bookings) {
      const existing = await prisma.meeting.findUnique({
        where: { platformEventId_platform: { platformEventId: booking.uid, platform: 'calcom' } }
      });
      
      const meetingData = {
        workspaceId: integration.workspaceId,
        title: booking.title,
        description: booking.description,
        startTime: new Date(booking.startTime),
        endTime: new Date(booking.endTime),
        duration: Math.round((new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 60000),
        meetingType: 'online',
        platform: 'calcom',
        platformEventId: booking.uid,
        status: booking.status === 'cancelled' ? 'cancelled' : booking.status === 'accepted' ? 'scheduled' : 'scheduled',
        calendarIntegrationId: integration.id,
        isExternal: true,
        createdBy: integration.createdBy,
        updatedBy: integration.createdBy
      };
      
      if (existing) {
        await prisma.meeting.update({ where: { id: existing.id }, data: meetingData });
        updated++;
      } else {
        await prisma.meeting.create({ data: meetingData });
        created++;
      }
    }
    
    return { processed: bookings.length, created, updated, deleted: 0, skipped };
  }

  /**
   * Helper for Google Calendar synchronization
   */
  private async syncGoogleCalendar(integration: any, accessToken: string) {
    const client = new GoogleCalendarClient(accessToken);
    const events = await client.listEvents(integration.calendarId || 'primary', {
      timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // sync from 30 days ago
      singleEvents: true
    });
    
    let created = 0, updated = 0, skipped = 0;
    
    for (const event of events) {
      if (!event.start?.dateTime || !event.end?.dateTime) continue;
      
      const existing = await prisma.meeting.findUnique({
        where: { platformEventId_platform: { platformEventId: event.id, platform: 'google_calendar' } }
      });
      
      const meetingData = {
        workspaceId: integration.workspaceId,
        title: event.summary || 'Google Meet',
        description: event.description,
        startTime: new Date(event.start.dateTime),
        endTime: new Date(event.end.dateTime),
        duration: Math.round((new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / 60000),
        meetingType: event.conferenceData ? 'online' : 'in_person',
        platform: 'google_calendar',
        platformEventId: event.id,
        status: event.status === 'cancelled' ? 'cancelled' : 'scheduled',
        calendarIntegrationId: integration.id,
        isExternal: true,
        meetingUrl: event.conferenceData?.entryPoints?.find(p => p.entryPointType === 'video')?.uri,
        createdBy: integration.createdBy,
        updatedBy: integration.createdBy
      };
      
      if (existing) {
        await prisma.meeting.update({ where: { id: existing.id }, data: meetingData });
        updated++;
      } else {
        await prisma.meeting.create({ data: meetingData });
        created++;
      }
    }
    
    return { processed: events.length, created, updated, deleted: 0, skipped };
  }
}
