# Scheduling Integration Module - Cal.com Integration Architecture

## Overview
This document details the architecture for integrating with Cal.com, a modern scheduling platform. The integration enables bidirectional synchronization of calendar events and bookings between Cal.com and the CRM system.

## Cal.com API Overview

### API Endpoints
- **Base URL**: `https://api.cal.com/v2`
- **Authentication**: Bearer token (OAuth 2.0)
- **Rate Limiting**: 100 requests per minute per user

### Key API Capabilities
1. **Calendar Management**: Read and write calendar events
2. **Booking Management**: Create, read, update, and cancel bookings
3. **Event Types**: Manage available event types for scheduling
4. **Availability**: Check user availability
5. **Webhooks**: Real-time event notifications

## Integration Architecture

### Components
1. **Cal.com Client Service**: Direct API interaction with Cal.com
2. **Event Synchronizer**: Bidirectional sync of calendar events
3. **Booking Manager**: Handle booking lifecycle
4. **Webhook Handler**: Process real-time Cal.com events
5. **Availability Checker**: Check user availability for scheduling

### Data Flow
```
Cal.com Platform
    ↓ (OAuth 2.0)
OAuth Service
    ↓ (Access Token)
Cal.com Client Service
    ↓ (API Calls)
Event Synchronizer
    ↓ (Transform Data)
CRM Database (Meetings, Attendees)
    ↓ (Notifications)
Frontend UI
```

## Cal.com Client Service

```typescript
// src/lib/calcom/calcom-client.ts
interface CalcomEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees: Array<{
    email: string;
    name: string;
    status: string;
  }>;
  status: string;
  metadata?: Record<string, any>;
}

interface CalcomBooking {
  uid: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees: Array<{
    email: string;
    name: string;
    timeZone: string;
  }>;
  location: string;
  status: 'ACCEPTED' | 'CANCELLED' | 'PENDING' | 'REJECTED';
  eventType: {
    id: number;
    title: string;
    slug: string;
  };
  metadata?: Record<string, any>;
}

class CalcomClient {
  private baseUrl: string;
  private accessToken: string;
  
  constructor(accessToken: string) {
    this.baseUrl = 'https://api.cal.com/v2';
    this.accessToken = accessToken;
  }
  
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new CalcomError(error.message || 'Cal.com API error', response.status);
    }
    
    return response.json();
  }
  
  // Calendar Events
  async getEvents(startDate: Date, endDate: Date): Promise<CalcomEvent[]> {
    const params = new URLSearchParams({
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    });
    
    const response = await this.request<{ events: CalcomEvent[] }>(
      `/calendars/events?${params.toString()}`
    );
    
    return response.events;
  }
  
  async createEvent(event: Partial<CalcomEvent>): Promise<CalcomEvent> {
    return this.request<CalcomEvent>('/calendars/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }
  
  async updateEvent(eventId: string, event: Partial<CalcomEvent>): Promise<CalcomEvent> {
    return this.request<CalcomEvent>(`/calendars/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(event),
    });
  }
  
  async deleteEvent(eventId: string): Promise<void> {
    await this.request(`/calendars/events/${eventId}`, {
      method: 'DELETE',
    });
  }
  
  // Bookings
  async getBookings(startDate: Date, endDate: Date): Promise<CalcomBooking[]> {
    const params = new URLSearchParams({
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    });
    
    const response = await this.request<{ bookings: CalcomBooking[] }>(
      `/bookings?${params.toString()}`
    );
    
    return response.bookings;
  }
  
  async getBooking(bookingUid: string): Promise<CalcomBooking> {
    return this.request<CalcomBooking>(`/bookings/${bookingUid}`);
  }
  
  async createBooking(booking: Partial<CalcomBooking>): Promise<CalcomBooking> {
    return this.request<CalcomBooking>('/bookings', {
      method: 'POST',
      body: JSON.stringify(booking),
    });
  }
  
  async updateBooking(bookingUid: string, booking: Partial<CalcomBooking>): Promise<CalcomBooking> {
    return this.request<CalcomBooking>(`/bookings/${bookingUid}`, {
      method: 'PATCH',
      body: JSON.stringify(booking),
    });
  }
  
  async cancelBooking(bookingUid: string, reason?: string): Promise<CalcomBooking> {
    return this.request<CalcomBooking>(`/bookings/${bookingUid}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }
  
  // Event Types
  async getEventTypes(): Promise<any[]> {
    const response = await this.request<{ eventTypes: any[] }>('/event-types');
    return response.eventTypes;
  }
  
  async getEventType(eventTypeId: number): Promise<any> {
    return this.request<any>(`/event-types/${eventTypeId}`);
  }
  
  // Availability
  async checkAvailability(
    eventTypeId: number,
    startTime: Date,
    endTime: Date,
    timeZone: string
  ): Promise<boolean> {
    const params = new URLSearchParams({
      eventTypeId: eventTypeId.toString(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      timeZone,
    });
    
    const response = await this.request<{ available: boolean }>(
      `/availability?${params.toString()}`
    );
    
    return response.available;
  }
  
  // Webhooks
  async createWebhook(
    webhookUrl: string,
    eventTypes: string[],
    active: boolean = true
  ): Promise<any> {
    return this.request<any>('/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        webhookUrl,
        eventTypes,
        active,
      }),
    });
  }
  
  async getWebhooks(): Promise<any[]> {
    const response = await this.request<{ webhooks: any[] }>('/webhooks');
    return response.webhooks;
  }
  
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request(`/webhooks/${webhookId}`, {
      method: 'DELETE',
    });
  }
}

class CalcomError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'CalcomError';
  }
}
```

## Event Synchronizer

```typescript
// src/lib/calcom/event-synchronizer.ts
import { CalcomClient } from './calcom-client';
import { TokenManager } from '@/lib/oauth/token-manager';

interface SyncOptions {
  startDate: Date;
  endDate: Date;
  direction: 'import' | 'export' | 'bidirectional';
  dryRun?: boolean;
}

class EventSynchronizer {
  private tokenManager: TokenManager;
  
  constructor() {
    this.tokenManager = new TokenManager();
  }
  
  async syncEvents(
    integrationId: string,
    options: SyncOptions
  ): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      // Get access token
      const accessToken = await this.tokenManager.getValidAccessToken(integrationId);
      
      // Initialize Cal.com client
      const calcomClient = new CalcomClient(accessToken);
      
      // Get integration details
      const integration = await prisma.calendarIntegration.findUnique({
        where: { id: integrationId },
        include: { workspace: true },
      });
      
      if (!integration) {
        throw new Error('Integration not found');
      }
      
      const result: SyncResult = {
        eventsProcessed: 0,
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsDeleted: 0,
        eventsSkipped: 0,
        errors: [],
        duration: 0,
      };
      
      // Import events from Cal.com
      if (options.direction === 'import' || options.direction === 'bidirectional') {
        const importResult = await this.importEvents(
          calcomClient,
          integration,
          options
        );
        result.eventsProcessed += importResult.eventsProcessed;
        result.eventsCreated += importResult.eventsCreated;
        result.eventsUpdated += importResult.eventsUpdated;
        result.eventsSkipped += importResult.eventsSkipped;
        result.errors.push(...importResult.errors);
      }
      
      // Export events to Cal.com
      if (options.direction === 'export' || options.direction === 'bidirectional') {
        const exportResult = await this.exportEvents(
          calcomClient,
          integration,
          options
        );
        result.eventsProcessed += exportResult.eventsProcessed;
        result.eventsCreated += exportResult.eventsCreated;
        result.eventsUpdated += exportResult.eventsUpdated;
        result.eventsSkipped += exportResult.eventsSkipped;
        result.errors.push(...exportResult.errors);
      }
      
      result.duration = Date.now() - startTime;
      
      // Update sync status
      await prisma.calendarIntegration.update({
        where: { id: integrationId },
        data: {
          lastSyncAt: new Date(),
          syncStatus: result.errors.length > 0 ? 'error' : 'active',
          lastSyncError: result.errors.length > 0 ? result.errors[0].message : null,
          lastSyncErrorAt: result.errors.length > 0 ? new Date() : null,
        },
      });
      
      // Log sync operation
      await prisma.calendarSyncLog.create({
        data: {
          calendarIntegrationId: integrationId,
          operationType: options.direction === 'bidirectional' ? 'full_sync' : 'incremental_sync',
          status: result.errors.length > 0 ? 'failed' : 'completed',
          eventsProcessed: result.eventsProcessed,
          eventsCreated: result.eventsCreated,
          eventsUpdated: result.eventsUpdated,
          eventsDeleted: result.eventsDeleted,
          eventsSkipped: result.eventsSkipped,
          errorMessage: result.errors.length > 0 ? result.errors[0].message : null,
          errorDetails: JSON.stringify(result.errors),
          durationMs: result.duration,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          syncStartDate: options.startDate,
          syncEndDate: options.endDate,
        },
      });
      
      return result;
    } catch (error) {
      // Log sync failure
      await prisma.calendarSyncLog.create({
        data: {
          calendarIntegrationId: integrationId,
          operationType: 'incremental_sync',
          status: 'failed',
          errorMessage: error.message,
          errorDetails: JSON.stringify({ stack: error.stack }),
          durationMs: Date.now() - startTime,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          syncStartDate: options.startDate,
          syncEndDate: options.endDate,
        },
      });
      
      throw error;
    }
  }
  
  private async importEvents(
    calcomClient: CalcomClient,
    integration: CalendarIntegration,
    options: SyncOptions
  ): Promise<SyncResult> {
    const result: SyncResult = {
      eventsProcessed: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      eventsSkipped: 0,
      errors: [],
      duration: 0,
    };
    
    try {
      // Fetch events from Cal.com
      const calcomEvents = await calcomClient.getEvents(
        options.startDate,
        options.endDate
      );
      
      result.eventsProcessed = calcomEvents.length;
      
      for (const calcomEvent of calcomEvents) {
        try {
          // Check if event already exists
          const existingMeeting = await prisma.meeting.findUnique({
            where: {
              platformEventId_platform: {
                platformEventId: calcomEvent.id,
                platform: 'calcom',
              },
            },
          });
          
          const meetingData = this.transformCalcomEventToMeeting(
            calcomEvent,
            integration
          );
          
          if (existingMeeting) {
            // Update existing meeting
            await prisma.meeting.update({
              where: { id: existingMeeting.id },
              data: meetingData,
            });
            result.eventsUpdated++;
          } else {
            // Create new meeting
            await prisma.meeting.create({
              data: meetingData,
            });
            result.eventsCreated++;
          }
        } catch (error) {
          result.errors.push({
            eventId: calcomEvent.id,
            message: error.message,
          });
        }
      }
    } catch (error) {
      result.errors.push({
        message: `Failed to import events: ${error.message}`,
      });
    }
    
    return result;
  }
  
  private async exportEvents(
    calcomClient: CalcomClient,
    integration: CalendarIntegration,
    options: SyncOptions
  ): Promise<SyncResult> {
    const result: SyncResult = {
      eventsProcessed: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      eventsSkipped: 0,
      errors: [],
      duration: 0,
    };
    
    try {
      // Fetch meetings from CRM that need to be synced
      const meetings = await prisma.meeting.findMany({
        where: {
          workspaceId: integration.workspaceId,
          platform: 'calcom',
          syncStatus: 'pending',
          startTime: {
            gte: options.startDate,
            lte: options.endDate,
          },
        },
      });
      
      result.eventsProcessed = meetings.length;
      
      for (const meeting of meetings) {
        try {
          const calcomEventData = this.transformMeetingToCalcomEvent(meeting);
          
          if (meeting.platformEventId) {
            // Update existing event
            await calcomClient.updateEvent(meeting.platformEventId, calcomEventData);
            result.eventsUpdated++;
          } else {
            // Create new event
            const calcomEvent = await calcomClient.createEvent(calcomEventData);
            
            // Update meeting with external ID
            await prisma.meeting.update({
              where: { id: meeting.id },
              data: {
                platformEventId: calcomEvent.id,
                syncStatus: 'synced',
                lastSyncedAt: new Date(),
              },
            });
            
            result.eventsCreated++;
          }
        } catch (error) {
          result.errors.push({
            meetingId: meeting.id,
            message: error.message,
          });
        }
      }
    } catch (error) {
      result.errors.push({
        message: `Failed to export events: ${error.message}`,
      });
    }
    
    return result;
  }
  
  private transformCalcomEventToMeeting(
    calcomEvent: CalcomEvent,
    integration: CalendarIntegration
  ): any {
    return {
      workspaceId: integration.workspaceId,
      title: calcomEvent.title,
      description: calcomEvent.description,
      startTime: new Date(calcomEvent.startTime),
      endTime: new Date(calcomEvent.endTime),
      duration: Math.round(
        (new Date(calcomEvent.endTime).getTime() - new Date(calcomEvent.startTime).getTime()) / 60000
      ),
      timezone: 'UTC',
      meetingType: calcomEvent.location ? 'online' : 'in_person',
      location: calcomEvent.location,
      platform: 'calcom',
      platformEventId: calcomEvent.id,
      calendarIntegrationId: integration.id,
      status: calcomEvent.status === 'CANCELLED' ? 'cancelled' : 'scheduled',
      isExternal: true,
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
      attendees: {
        create: calcomEvent.attendees.map(attendee => ({
          name: attendee.name,
          email: attendee.email,
          type: 'external',
          status: attendee.status.toLowerCase(),
        })),
      },
    };
  }
  
  private transformMeetingToCalcomEvent(meeting: Meeting): Partial<CalcomEvent> {
    return {
      title: meeting.title,
      description: meeting.description,
      startTime: meeting.startTime.toISOString(),
      endTime: meeting.endTime.toISOString(),
      location: meeting.meetingUrl || meeting.location,
      attendees: meeting.attendees.map(attendee => ({
        email: attendee.email,
        name: attendee.name,
        status: attendee.status.toUpperCase(),
      })),
    };
  }
}

interface SyncResult {
  eventsProcessed: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  eventsSkipped: number;
  errors: Array<{ eventId?: string; meetingId?: string; message: string }>;
  duration: number;
}
```

## Booking Manager

```typescript
// src/lib/calcom/booking-manager.ts
import { CalcomClient } from './calcom-client';
import { TokenManager } from '@/lib/oauth/token-manager';

class BookingManager {
  private tokenManager: TokenManager;
  
  constructor() {
    this.tokenManager = new TokenManager();
  }
  
  async createBooking(
    integrationId: string,
    bookingData: CreateBookingRequest
  ): Promise<Meeting> {
    const accessToken = await this.tokenManager.getValidAccessToken(integrationId);
    const calcomClient = new CalcomClient(accessToken);
    
    // Create booking in Cal.com
    const calcomBooking = await calcomClient.createBooking({
      eventTypeId: bookingData.eventTypeId,
      startTime: bookingData.startTime.toISOString(),
      endTime: bookingData.endTime.toISOString(),
      attendees: bookingData.attendees,
      title: bookingData.title,
      description: bookingData.description,
      location: bookingData.location,
    });
    
    // Create meeting in CRM
    const meeting = await prisma.meeting.create({
      data: {
        workspaceId: bookingData.workspaceId,
        leadId: bookingData.leadId,
        userId: bookingData.userId,
        title: calcomBooking.title,
        description: calcomBooking.description,
        startTime: new Date(calcomBooking.startTime),
        endTime: new Date(calcomBooking.endTime),
        duration: Math.round(
          (new Date(calcomBooking.endTime).getTime() - new Date(calcomBooking.startTime).getTime()) / 60000
        ),
        meetingType: 'online',
        location: calcomBooking.location,
        platform: 'calcom',
        platformEventId: calcomBooking.uid,
        calendarIntegrationId: integrationId,
        status: this.mapCalcomStatus(calcomBooking.status),
        isExternal: true,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        attendees: {
          create: calcomBooking.attendees.map(attendee => ({
            name: attendee.name,
            email: attendee.email,
            type: bookingData.leadId ? 'lead' : 'external',
            status: this.mapCalcomAttendeeStatus(calcomBooking.status),
          })),
        },
      },
    });
    
    return meeting;
  }
  
  async updateBooking(
    integrationId: string,
    bookingUid: string,
    updates: Partial<Meeting>
  ): Promise<Meeting> {
    const accessToken = await this.tokenManager.getValidAccessToken(integrationId);
    const calcomClient = new CalcomClient(accessToken);
    
    // Update booking in Cal.com
    const calcomBooking = await calcomClient.updateBooking(bookingUid, {
      startTime: updates.startTime?.toISOString(),
      endTime: updates.endTime?.toISOString(),
      attendees: updates.attendees?.map(a => ({
        email: a.email,
        name: a.name,
        timeZone: 'UTC',
      })),
      title: updates.title,
      description: updates.description,
      location: updates.meetingUrl || updates.location,
    });
    
    // Update meeting in CRM
    const meeting = await prisma.meeting.update({
      where: { platformEventId: bookingUid },
      data: {
        title: calcomBooking.title,
        description: calcomBooking.description,
        startTime: new Date(calcomBooking.startTime),
        endTime: new Date(calcomBooking.endTime),
        duration: Math.round(
          (new Date(calcomBooking.endTime).getTime() - new Date(calcomBooking.startTime).getTime()) / 60000
        ),
        location: calcomBooking.location,
        status: this.mapCalcomStatus(calcomBooking.status),
        lastSyncedAt: new Date(),
      },
    });
    
    return meeting;
  }
  
  async cancelBooking(
    integrationId: string,
    bookingUid: string,
    reason?: string
  ): Promise<void> {
    const accessToken = await this.tokenManager.getValidAccessToken(integrationId);
    const calcomClient = new CalcomClient(accessToken);
    
    // Cancel booking in Cal.com
    await calcomClient.cancelBooking(bookingUid, reason);
    
    // Update meeting status in CRM
    await prisma.meeting.update({
      where: { platformEventId: bookingUid },
      data: {
        status: 'cancelled',
        cancellationReason: reason,
        cancelledAt: new Date(),
      },
    });
  }
  
  private mapCalcomStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'ACCEPTED': 'scheduled',
      'CANCELLED': 'cancelled',
      'PENDING': 'scheduled',
      'REJECTED': 'cancelled',
    };
    
    return statusMap[status] || 'scheduled';
  }
  
  private mapCalcomAttendeeStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'ACCEPTED': 'accepted',
      'CANCELLED': 'cancelled',
      'PENDING': 'invited',
      'REJECTED': 'declined',
    };
    
    return statusMap[status] || 'invited';
  }
}

interface CreateBookingRequest {
  workspaceId: string;
  leadId?: string;
  userId: string;
  eventTypeId: number;
  startTime: Date;
  endTime: Date;
  attendees: Array<{ email: string; name: string }>;
  title: string;
  description?: string;
  location?: string;
}
```

## Webhook Handler

```typescript
// src/app/api/webhooks/calcom/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.CALCOM_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const signature = request.headers.get('x-calcom-signature');
    const body = await request.text();
    
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(body)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    const payload = JSON.parse(body);
    
    // Process webhook event
    await processCalcomWebhook(payload);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cal.com webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

async function processCalcomWebhook(payload: any): Promise<void> {
  const { type, data } = payload;
  
  switch (type) {
    case 'BOOKING_CREATED':
      await handleBookingCreated(data);
      break;
    case 'BOOKING_CANCELLED':
      await handleBookingCancelled(data);
      break;
    case 'BOOKING_RESCHEDULED':
      await handleBookingRescheduled(data);
      break;
    case 'ATTENDEE_ACCEPTED':
      await handleAttendeeAccepted(data);
      break;
    case 'ATTENDEE_DECLINED':
      await handleAttendeeDeclined(data);
      break;
    default:
      console.log(`Unhandled webhook type: ${type}`);
  }
}

async function handleBookingCreated(data: any): Promise<void> {
  // Find integration by provider user ID
  const integration = await prisma.calendarIntegration.findFirst({
    where: {
      type: 'calcom',
      providerUserId: data.userId,
    },
  });
  
  if (!integration) {
    console.error('Integration not found for user:', data.userId);
    return;
  }
  
  // Create meeting in CRM
  await prisma.meeting.create({
    data: {
      workspaceId: integration.workspaceId,
      title: data.title,
      description: data.description,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      duration: data.duration,
      meetingType: 'online',
      location: data.location,
      platform: 'calcom',
      platformEventId: data.uid,
      calendarIntegrationId: integration.id,
      status: 'scheduled',
      isExternal: true,
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
      attendees: {
        create: data.attendees.map((attendee: any) => ({
          name: attendee.name,
          email: attendee.email,
          type: 'external',
          status: 'invited',
        })),
      },
    },
  });
}

async function handleBookingCancelled(data: any): Promise<void> {
  await prisma.meeting.update({
    where: { platformEventId: data.uid },
    data: {
      status: 'cancelled',
      cancellationReason: data.cancellationReason,
      cancelledAt: new Date(),
    },
  });
}

async function handleBookingRescheduled(data: any): Promise<void> {
  await prisma.meeting.update({
    where: { platformEventId: data.uid },
    data: {
      startTime: new Date(data.newStartTime),
      endTime: new Date(data.newEndTime),
      duration: data.newDuration,
      lastSyncedAt: new Date(),
    },
  });
}

async function handleAttendeeAccepted(data: any): Promise<void> {
  await prisma.meetingAttendee.updateMany({
    where: {
      meeting: { platformEventId: data.bookingUid },
      email: data.attendee.email,
    },
    data: {
      status: 'accepted',
      responseAt: new Date(),
    },
  });
}

async function handleAttendeeDeclined(data: any): Promise<void> {
  await prisma.meetingAttendee.updateMany({
    where: {
      meeting: { platformEventId: data.bookingUid },
      email: data.attendee.email,
    },
    data: {
      status: 'declined',
      responseAt: new Date(),
    },
  });
}
```

## API Endpoints

### Sync Events
```typescript
// src/app/api/calcom/sync/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { integrationId, startDate, endDate, direction } = body;
  
  const synchronizer = new EventSynchronizer();
  const result = await synchronizer.syncEvents(integrationId, {
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    direction,
  });
  
  return NextResponse.json(result);
}
```

### Get Event Types
```typescript
// src/app/api/calcom/event-types/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const integrationId = searchParams.get('integrationId');
  
  const accessToken = await tokenManager.getValidAccessToken(integrationId);
  const calcomClient = new CalcomClient(accessToken);
  
  const eventTypes = await calcomClient.getEventTypes();
  
  return NextResponse.json(eventTypes);
}
```

### Check Availability
```typescript
// src/app/api/calcom/availability/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { integrationId, eventTypeId, startTime, endTime, timeZone } = body;
  
  const accessToken = await tokenManager.getValidAccessToken(integrationId);
  const calcomClient = new CalcomClient(accessToken);
  
  const available = await calcomClient.checkAvailability(
    eventTypeId,
    new Date(startTime),
    new Date(endTime),
    timeZone
  );
  
  return NextResponse.json({ available });
}
```

## Testing Strategy

### Unit Tests
- Cal.com client methods
- Event transformation logic
- Status mapping functions
- Webhook signature verification

### Integration Tests
- Complete sync flow
- Booking lifecycle
- Webhook processing
- Error handling

### End-to-End Tests
- User creates booking in Cal.com → Appears in CRM
- User creates meeting in CRM → Synced to Cal.com
- Booking cancelled in Cal.com → Updated in CRM
- Real-time webhook processing

## Error Handling

### Common Errors
1. **Authentication failures**: Token expired, invalid credentials
2. **Rate limiting**: Too many requests
3. **Validation errors**: Invalid event data
4. **Network errors**: Connection issues

### Error Recovery
- Automatic token refresh
- Exponential backoff for retries
- Fallback to manual sync
- Detailed error logging

## Performance Considerations

### Optimization Strategies
1. **Batch Processing**: Process events in batches
2. **Caching**: Cache event types and user info
3. **Incremental Sync**: Only sync changes
4. **Parallel Processing**: Process multiple events concurrently

### Monitoring
- Track sync duration
- Monitor error rates
- Alert on sync failures
- Track API usage

## Security Considerations

### Best Practices
1. **Validate all webhook signatures**
2. **Encrypt sensitive data**
3. **Implement rate limiting**
4. **Log all access**
5. **Use HTTPS for all communications**

## Next Steps
1. Implement Cal.com client service
2. Create event synchronizer
3. Build booking manager
4. Set up webhook handler
5. Create API endpoints
6. Implement error handling
7. Write comprehensive tests
8. Set up monitoring and logging
