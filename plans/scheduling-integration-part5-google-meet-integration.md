# Scheduling Integration Module - Google Meet Integration Architecture

## Overview
This document details the architecture for integrating with Google Meet through Google Calendar API. The integration enables users to create, manage, and initiate Google Meet meetings directly from the CRM interface, with automatic logging against client profiles.

## Google Calendar API Overview

### API Endpoints
- **Base URL**: `https://www.googleapis.com/calendar/v3`
- **Authentication**: OAuth 2.0
- **Rate Limiting**: 10,000 queries per day per user

### Key API Capabilities
1. **Calendar Events**: Create, update, delete, and retrieve calendar events
2. **Conference Data**: Create and manage Google Meet conferences
3. **Calendar Management**: Access multiple calendars
4. **Event Reminders**: Set up event reminders
5. **Webhooks**: Real-time event notifications via Push Notifications

## Integration Architecture

### Components
1. **Google Calendar Client Service**: Direct API interaction with Google Calendar
2. **Meeting Manager**: Handle Google Meet meeting lifecycle
3. **Webhook Handler**: Process real-time Google Calendar events
4. **Conference Manager**: Manage Google Meet conference details
5. **Calendar Sync**: Synchronize calendar events with CRM

### Data Flow
```
CRM User Interface
    ↓ (Create Meeting Request)
Meeting Manager
    ↓ (API Call)
Google Calendar Client Service
    ↓ (OAuth 2.0)
Google Calendar API
    ↓ (Event Created with Meet Link)
CRM Database (Meetings, Attendees)
    ↓ (Notifications)
Frontend UI
```

## Google Calendar Client Service

```typescript
// src/lib/google/google-calendar-client.ts
interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    comment?: string;
  }>;
  conferenceData?: {
    createRequest?: {
      requestId: string;
      conferenceSolutionKey?: {
        type: string;
      };
    };
    conferenceSolution?: {
      key: {
        type: string;
      };
      name: string;
      iconUri: string;
    };
    entryPoints: Array<{
      entryPointType: string;
      uri: string;
      label?: string;
      pin?: string;
      accessCode?: string;
      meetingCode?: string;
      password?: string;
    }>;
    conferenceId: string;
    signature: string;
    notes?: string;
  };
  recurrence?: string[];
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
  status: string;
  created: string;
  updated: string;
  creator: {
    email: string;
    self?: boolean;
  };
  organizer: {
    email: string;
    self?: boolean;
  };
  hangoutLink?: string;
  iCalUID: string;
  sequence: number;
}

interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  timeZone: string;
  primary?: boolean;
  accessRole: string;
  kind: string;
  etag: string;
}

class GoogleCalendarClient {
  private baseUrl: string;
  private accessToken: string;
  
  constructor(accessToken: string) {
    this.baseUrl = 'https://www.googleapis.com/calendar/v3';
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
      throw new GoogleCalendarError(
        error.error?.message || 'Google Calendar API error',
        response.status
      );
    }
    
    return response.json();
  }
  
  // Calendar Management
  async getCalendars(): Promise<GoogleCalendar[]> {
    const response = await this.request<{ items: GoogleCalendar[] }>('/users/me/calendarList');
    return response.items;
  }
  
  async getCalendar(calendarId: string = 'primary'): Promise<GoogleCalendar> {
    return this.request<GoogleCalendar>(`/calendars/${calendarId}`);
  }
  
  // Event Management
  async createEvent(
    calendarId: string,
    eventData: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    return this.request<GoogleCalendarEvent>(`/calendars/${calendarId}/events`, {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }
  
  async getEvent(
    calendarId: string,
    eventId: string
  ): Promise<GoogleCalendarEvent> {
    return this.request<GoogleCalendarEvent>(`/calendars/${calendarId}/events/${eventId}`);
  }
  
  async updateEvent(
    calendarId: string,
    eventId: string,
    eventData: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    return this.request<GoogleCalendarEvent>(`/calendars/${calendarId}/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(eventData),
    });
  }
  
  async deleteEvent(
    calendarId: string,
    eventId: string
  ): Promise<void> {
    await this.request(`/calendars/${calendarId}/events/${eventId}`, {
      method: 'DELETE',
    });
  }
  
  async listEvents(
    calendarId: string = 'primary',
    options: {
      timeMin?: Date;
      timeMax?: Date;
      q?: string;
      maxResults?: number;
      pageToken?: string;
    } = {}
  ): Promise<{
    items: GoogleCalendarEvent[];
    nextPageToken?: string;
    summary: string;
    description?: string;
    updated: string;
  }> {
    const params = new URLSearchParams();
    
    if (options.timeMin) params.append('timeMin', options.timeMin.toISOString());
    if (options.timeMax) params.append('timeMax', options.timeMax.toISOString());
    if (options.q) params.append('q', options.q);
    if (options.maxResults) params.append('maxResults', options.maxResults.toString());
    if (options.pageToken) params.append('pageToken', options.pageToken);
    
    return this.request(`/calendars/${calendarId}/events?${params.toString()}`);
  }
  
  // Quick Add
  async quickAdd(
    calendarId: string,
    text: string
  ): Promise<GoogleCalendarEvent> {
    return this.request<GoogleCalendarEvent>(
      `/calendars/${calendarId}/events/quickAdd?text=${encodeURIComponent(text)}`,
      {
        method: 'POST',
      }
    );
  }
  
  // Move Event
  async moveEvent(
    sourceCalendarId: string,
    eventId: string,
    destinationCalendarId: string
  ): Promise<GoogleCalendarEvent> {
    return this.request<GoogleCalendarEvent>(
      `/calendars/${sourceCalendarId}/events/${eventId}/move?destination=${destinationCalendarId}`,
      {
        method: 'POST',
      }
    );
  }
  
  // Import Event
  async importEvent(
    calendarId: string,
    eventData: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    return this.request<GoogleCalendarEvent>(`/calendars/${calendarId}/events/import`, {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }
  
  // Watch for Changes (Webhook)
  async watchCalendar(
    calendarId: string,
    webhookUrl: string,
    channelId: string,
    token?: string
  ): Promise<any> {
    return this.request(`/calendars/${calendarId}/watch`, {
      method: 'POST',
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        token,
      }),
    });
  }
  
  async stopWatch(channelId: string, resourceId: string): Promise<void> {
    await this.request('/channels/stop', {
      method: 'POST',
      body: JSON.stringify({
        id: channelId,
        resourceId,
      }),
    });
  }
}

class GoogleCalendarError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'GoogleCalendarError';
  }
}
```

## Meeting Manager

```typescript
// src/lib/google/meeting-manager.ts
import { GoogleCalendarClient } from './google-calendar-client';
import { TokenManager } from '@/lib/oauth/token-manager';

interface CreateMeetingRequest {
  workspaceId: string;
  leadId?: string;
  userId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timezone?: string;
  location?: string;
  attendees?: Array<{
    email: string;
    name?: string;
  }>;
  reminders?: Array<{
    method: 'email' | 'popup';
    minutes: number;
  }>;
  recurrence?: string[];
}

class MeetingManager {
  private tokenManager: TokenManager;
  
  constructor() {
    this.tokenManager = new TokenManager();
  }
  
  async createMeeting(
    integrationId: string,
    request: CreateMeetingRequest
  ): Promise<Meeting> {
    const accessToken = await this.tokenManager.getValidAccessToken(integrationId);
    const googleClient = new GoogleCalendarClient(accessToken);
    
    // Generate unique request ID for conference creation
    const requestId = `crm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create event with Google Meet conference
    const googleEvent = await googleClient.createEvent('primary', {
      summary: request.title,
      description: request.description,
      location: request.location,
      start: {
        dateTime: request.startTime.toISOString(),
        timeZone: request.timezone || 'UTC',
      },
      end: {
        dateTime: request.endTime.toISOString(),
        timeZone: request.timezone || 'UTC',
      },
      attendees: request.attendees?.map(attendee => ({
        email: attendee.email,
        displayName: attendee.name,
      })),
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
      reminders: {
        useDefault: false,
        overrides: request.reminders,
      },
      recurrence: request.recurrence,
    });
    
    // Extract Google Meet details
    const meetDetails = this.extractMeetDetails(googleEvent);
    
    // Calculate duration
    const duration = Math.round(
      (request.endTime.getTime() - request.startTime.getTime()) / 60000
    );
    
    // Create meeting in CRM
    const meeting = await prisma.meeting.create({
      data: {
        workspaceId: request.workspaceId,
        leadId: request.leadId,
        userId: request.userId,
        title: googleEvent.summary,
        description: googleEvent.description,
        startTime: new Date(googleEvent.start.dateTime!),
        endTime: new Date(googleEvent.end.dateTime!),
        duration,
        timezone: googleEvent.start.timeZone || 'UTC',
        meetingType: 'online',
        location: googleEvent.location,
        platform: 'google_meet',
        platformEventId: googleEvent.id,
        meetingUrl: meetDetails.joinUrl,
        hostUrl: meetDetails.joinUrl, // Google Meet uses same URL for host and participants
        conferenceProvider: 'google_meet',
        conferenceId: meetDetails.conferenceId,
        status: 'scheduled',
        isExternal: false,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        reminderEnabled: true,
        reminderTimes: JSON.stringify(
          request.reminders?.map(r => r.minutes) || [15, 60, 1440]
        ),
        createdBy: request.userId,
        attendees: {
          create: googleEvent.attendees?.map(attendee => ({
            name: attendee.displayName || attendee.email.split('@')[0],
            email: attendee.email,
            type: request.leadId ? 'lead' : 'external',
            status: this.mapGoogleResponseStatus(attendee.responseStatus),
            joinUrl: meetDetails.joinUrl,
          })) || [],
        },
      },
    });
    
    // Log activity
    await prisma.activity.create({
      data: {
        workspaceId: request.workspaceId,
        type: 'meeting_created',
        entityType: 'meeting',
        entityId: meeting.id,
        description: `Created Google Meet meeting: ${meeting.title}`,
        metadata: JSON.stringify({
          platform: 'google_meet',
          eventId: googleEvent.id,
          conferenceId: meetDetails.conferenceId,
        }),
        userId: request.userId,
        meetingId: meeting.id,
        leadId: request.leadId,
      },
    });
    
    return meeting;
  }
  
  async updateMeeting(
    integrationId: string,
    meetingId: string,
    updates: Partial<Meeting>
  ): Promise<Meeting> {
    const accessToken = await this.tokenManager.getValidAccessToken(integrationId);
    const googleClient = new GoogleCalendarClient(accessToken);
    
    // Get existing meeting
    const existingMeeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });
    
    if (!existingMeeting) {
      throw new Error('Meeting not found');
    }
    
    // Prepare update data
    const updateData: Partial<GoogleCalendarEvent> = {};
    
    if (updates.title) updateData.summary = updates.title;
    if (updates.description) updateData.description = updates.description;
    if (updates.location) updateData.location = updates.location;
    if (updates.startTime || updates.endTime) {
      updateData.start = {
        dateTime: (updates.startTime || existingMeeting.startTime).toISOString(),
        timeZone: updates.timezone || existingMeeting.timezone,
      };
      updateData.end = {
        dateTime: (updates.endTime || existingMeeting.endTime).toISOString(),
        timeZone: updates.timezone || existingMeeting.timezone,
      };
    }
    
    if (updates.attendees) {
      updateData.attendees = updates.attendees.map(attendee => ({
        email: attendee.email,
        displayName: attendee.name,
      }));
    }
    
    // Update event in Google Calendar
    const googleEvent = await googleClient.updateEvent(
      'primary',
      existingMeeting.platformEventId!,
      updateData
    );
    
    // Extract updated Google Meet details
    const meetDetails = this.extractMeetDetails(googleEvent);
    
    // Update meeting in CRM
    const meeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        title: googleEvent.summary,
        description: googleEvent.description,
        startTime: new Date(googleEvent.start.dateTime!),
        endTime: new Date(googleEvent.end.dateTime!),
        duration: Math.round(
          (new Date(googleEvent.end.dateTime!).getTime() - new Date(googleEvent.start.dateTime!).getTime()) / 60000
        ),
        location: googleEvent.location,
        meetingUrl: meetDetails.joinUrl,
        lastSyncedAt: new Date(),
        updatedBy: updates.userId,
      },
    });
    
    // Log activity
    await prisma.activity.create({
      data: {
        workspaceId: existingMeeting.workspaceId,
        type: 'meeting_updated',
        entityType: 'meeting',
        entityId: meeting.id,
        description: `Updated Google Meet meeting: ${meeting.title}`,
        metadata: JSON.stringify({
          platform: 'google_meet',
          eventId: googleEvent.id,
        }),
        userId: updates.userId!,
        meetingId: meeting.id,
      },
    });
    
    return meeting;
  }
  
  async deleteMeeting(integrationId: string, meetingId: string): Promise<void> {
    const accessToken = await this.tokenManager.getValidAccessToken(integrationId);
    const googleClient = new GoogleCalendarClient(accessToken);
    
    // Get existing meeting
    const existingMeeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });
    
    if (!existingMeeting) {
      throw new Error('Meeting not found');
    }
    
    // Delete event in Google Calendar
    await googleClient.deleteEvent('primary', existingMeeting.platformEventId!);
    
    // Update meeting status in CRM
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    });
    
    // Log activity
    await prisma.activity.create({
      data: {
        workspaceId: existingMeeting.workspaceId,
        type: 'meeting_cancelled',
        entityType: 'meeting',
        entityId: meetingId,
        description: `Cancelled Google Meet meeting: ${existingMeeting.title}`,
        metadata: JSON.stringify({
          platform: 'google_meet',
        }),
        userId: existingMeeting.userId!,
        meetingId: meetingId,
      },
    });
  }
  
  async getMeetingDetails(integrationId: string, meetingId: string): Promise<Meeting> {
    const accessToken = await this.tokenManager.getValidAccessToken(integrationId);
    const googleClient = new GoogleCalendarClient(accessToken);
    
    // Get meeting from CRM
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { attendees: true },
    });
    
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    
    // Get fresh data from Google Calendar
    const googleEvent = await googleClient.getEvent('primary', meeting.platformEventId!);
    
    // Extract Google Meet details
    const meetDetails = this.extractMeetDetails(googleEvent);
    
    return {
      ...meeting,
      googleEvent,
      meetDetails,
    };
  }
  
  async addAttendee(
    meetingId: string,
    attendee: {
      name: string;
      email: string;
      leadId?: string;
    }
  ): Promise<MeetingAttendee> {
    // Get meeting
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });
    
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    
    // Add attendee to CRM
    const meetingAttendee = await prisma.meetingAttendee.create({
      data: {
        meetingId,
        name: attendee.name,
        email: attendee.email,
        type: attendee.leadId ? 'lead' : 'external',
        status: 'invited',
      },
    });
    
    // Update event in Google Calendar
    const integration = await prisma.calendarIntegration.findFirst({
      where: {
        workspaceId: meeting.workspaceId,
        type: 'google_calendar',
        isActive: true,
      },
    });
    
    if (integration) {
      try {
        const accessToken = await this.tokenManager.getValidAccessToken(integration.id);
        const googleClient = new GoogleCalendarClient(accessToken);
        
        // Get current attendees
        const googleEvent = await googleClient.getEvent('primary', meeting.platformEventId!);
        const currentAttendees = googleEvent.attendees || [];
        
        // Add new attendee
        await googleClient.updateEvent('primary', meeting.platformEventId!, {
          attendees: [
            ...currentAttendees,
            {
              email: attendee.email,
              displayName: attendee.name,
            },
          ],
        });
      } catch (error) {
        console.error('Failed to add attendee to Google Calendar:', error);
      }
    }
    
    return meetingAttendee;
  }
  
  private extractMeetDetails(event: GoogleCalendarEvent): {
    conferenceId: string;
    joinUrl: string;
    phoneNumbers?: Array<{ region: string; number: string; type: string }>;
  } {
    const conferenceData = event.conferenceData;
    
    if (!conferenceData) {
      throw new Error('No conference data found in event');
    }
    
    const hangoutLink = event.hangoutLink;
    const entryPoints = conferenceData.entryPoints || [];
    const phoneEntryPoint = entryPoints.find(ep => ep.entryPointType === 'phone');
    
    return {
      conferenceId: conferenceData.conferenceId,
      joinUrl: hangoutLink || entryPoints.find(ep => ep.entryPointType === 'video')?.uri || '',
      phoneNumbers: phoneEntryPoint
        ? [
            {
              region: phoneEntryPoint.label || 'Unknown',
              number: phoneEntryPoint.uri,
              type: 'phone',
            },
          ]
        : undefined,
    };
  }
  
  private mapGoogleResponseStatus(status?: string): string {
    const statusMap: Record<string, string> = {
      'accepted': 'accepted',
      'declined': 'declined',
      'tentative': 'tentative',
      'needsAction': 'invited',
    };
    
    return statusMap[status || 'needsAction'] || 'invited';
  }
}
```

## Webhook Handler

```typescript
// src/app/api/webhooks/google/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.GOOGLE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature (if using signature verification)
    const signature = request.headers.get('x-goog-signature');
    const body = await request.text();
    
    if (signature) {
      const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }
    
    const payload = JSON.parse(body);
    
    // Process webhook event
    await processGoogleWebhook(payload);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Google webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

async function processGoogleWebhook(payload: any): Promise<void> {
  const { kind, id, resourceState, resourceUri } = payload;
  
  // Handle Google Calendar push notifications
  if (kind === 'calendar#event' && resourceState === 'exists') {
    // Fetch the actual event data
    await handleCalendarEventUpdate(resourceUri);
  }
}

async function handleCalendarEventUpdate(resourceUri: string): Promise<void> {
  // Extract event ID from resource URI
  const eventIdMatch = resourceUri.match(/\/events\/([^/]+)/);
  const eventId = eventIdMatch ? eventIdMatch[1] : null;
  
  if (!eventId) {
    console.error('Could not extract event ID from resource URI:', resourceUri);
    return;
  }
  
  // Find integration by Google user ID
  const integration = await prisma.calendarIntegration.findFirst({
    where: {
      type: 'google_calendar',
      isActive: true,
    },
  });
  
  if (!integration) {
    console.error('No active Google Calendar integration found');
    return;
  }
  
  try {
    const accessToken = await tokenManager.getValidAccessToken(integration.id);
    const googleClient = new GoogleCalendarClient(accessToken);
    
    // Fetch the event
    const googleEvent = await googleClient.getEvent('primary', eventId);
    
    // Find corresponding meeting in CRM
    const existingMeeting = await prisma.meeting.findUnique({
      where: {
        platformEventId_platform: {
          platformEventId: eventId,
          platform: 'google_meet',
        },
      },
    });
    
    if (existingMeeting) {
      // Update existing meeting
      await updateMeetingFromGoogleEvent(existingMeeting, googleEvent);
    } else {
      // Create new meeting (if it's a future event)
      if (new Date(googleEvent.start.dateTime!) > new Date()) {
        await createMeetingFromGoogleEvent(integration, googleEvent);
      }
    }
  } catch (error) {
    console.error('Error processing calendar event update:', error);
  }
}

async function updateMeetingFromGoogleEvent(
  meeting: Meeting,
  googleEvent: GoogleCalendarEvent
): Promise<void> {
  const meetDetails = extractMeetDetails(googleEvent);
  
  await prisma.meeting.update({
    where: { id: meeting.id },
    data: {
      title: googleEvent.summary,
      description: googleEvent.description,
      startTime: new Date(googleEvent.start.dateTime!),
      endTime: new Date(googleEvent.end.dateTime!),
      duration: Math.round(
        (new Date(googleEvent.end.dateTime!).getTime() - new Date(googleEvent.start.dateTime!).getTime()) / 60000
      ),
      location: googleEvent.location,
      meetingUrl: meetDetails.joinUrl,
      lastSyncedAt: new Date(),
    },
  });
  
  // Update attendees
  if (googleEvent.attendees) {
    for (const attendee of googleEvent.attendees) {
      await prisma.meetingAttendee.upsert({
        where: {
          meetingId_email: {
            meetingId: meeting.id,
            email: attendee.email,
          },
        },
        create: {
          meetingId: meeting.id,
          name: attendee.displayName || attendee.email.split('@')[0],
          email: attendee.email,
          type: 'external',
          status: mapGoogleResponseStatus(attendee.responseStatus),
        },
        update: {
          status: mapGoogleResponseStatus(attendee.responseStatus),
        },
      });
    }
  }
}

async function createMeetingFromGoogleEvent(
  integration: CalendarIntegration,
  googleEvent: GoogleCalendarEvent
): Promise<void> {
  const meetDetails = extractMeetDetails(googleEvent);
  
  await prisma.meeting.create({
    data: {
      workspaceId: integration.workspaceId,
      title: googleEvent.summary,
      description: googleEvent.description,
      startTime: new Date(googleEvent.start.dateTime!),
      endTime: new Date(googleEvent.end.dateTime!),
      duration: Math.round(
        (new Date(googleEvent.end.dateTime!).getTime() - new Date(googleEvent.start.dateTime!).getTime()) / 60000
      ),
      timezone: googleEvent.start.timeZone || 'UTC',
      meetingType: 'online',
      location: googleEvent.location,
      platform: 'google_meet',
      platformEventId: googleEvent.id,
      meetingUrl: meetDetails.joinUrl,
      conferenceProvider: 'google_meet',
      conferenceId: meetDetails.conferenceId,
      status: 'scheduled',
      isExternal: true,
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
      calendarIntegrationId: integration.id,
      createdBy: integration.createdBy,
      attendees: {
        create: googleEvent.attendees?.map(attendee => ({
          name: attendee.displayName || attendee.email.split('@')[0],
          email: attendee.email,
          type: 'external',
          status: mapGoogleResponseStatus(attendee.responseStatus),
          joinUrl: meetDetails.joinUrl,
        })) || [],
      },
    },
  });
}

function extractMeetDetails(event: GoogleCalendarEvent): {
  conferenceId: string;
  joinUrl: string;
  phoneNumbers?: Array<{ region: string; number: string; type: string }>;
} {
  const conferenceData = event.conferenceData;
  
  if (!conferenceData) {
    throw new Error('No conference data found in event');
  }
  
  const hangoutLink = event.hangoutLink;
  const entryPoints = conferenceData.entryPoints || [];
  const phoneEntryPoint = entryPoints.find(ep => ep.entryPointType === 'phone');
  
  return {
    conferenceId: conferenceData.conferenceId,
    joinUrl: hangoutLink || entryPoints.find(ep => ep.entryPointType === 'video')?.uri || '',
    phoneNumbers: phoneEntryPoint
      ? [
          {
            region: phoneEntryPoint.label || 'Unknown',
            number: phoneEntryPoint.uri,
            type: 'phone',
          },
        ]
      : undefined,
  };
}

function mapGoogleResponseStatus(status?: string): string {
  const statusMap: Record<string, string> = {
    'accepted': 'accepted',
    'declined': 'declined',
    'tentative': 'tentative',
    'needsAction': 'invited',
  };
  
  return statusMap[status || 'needsAction'] || 'invited';
}
```

## API Endpoints

### Create Google Meet
```typescript
// src/app/api/google/meet/route.ts
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const body = await request.json();
  const { integrationId, ...meetingData } = body;
  
  const meetingManager = new MeetingManager();
  const meeting = await meetingManager.createMeeting(integrationId, {
    ...meetingData,
    userId: session.user.id,
  });
  
  return NextResponse.json(meeting);
}
```

### Get Meeting Details
```typescript
// src/app/api/google/meet/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const integrationId = searchParams.get('integrationId');
  
  if (!integrationId) {
    return NextResponse.json({ error: 'Integration ID required' }, { status: 400 });
  }
  
  const meetingManager = new MeetingManager();
  const meeting = await meetingManager.getMeetingDetails(integrationId, params.id);
  
  return NextResponse.json(meeting);
}
```

## Testing Strategy

### Unit Tests
- Google Calendar client methods
- Meeting transformation logic
- Meet details extraction
- Status mapping functions

### Integration Tests
- Complete meeting lifecycle
- Attendee management
- Webhook processing
- Error handling

### End-to-End Tests
- User creates Google Meet → Appears in CRM
- Meeting details updated → Synced to Google Calendar
- Attendee responds → Status updated in CRM
- Real-time webhook processing

## Error Handling

### Common Errors
1. **Authentication failures**: Token expired, invalid credentials
2. **Rate limiting**: Too many requests
3. **Invalid event data**: Missing required fields
4. **Permission denied**: User lacks permissions

### Error Recovery
- Automatic token refresh
- Exponential backoff for retries
- Graceful degradation
- Detailed error logging

## Performance Considerations

### Optimization Strategies
1. **Caching**: Cache event details and calendar info
2. **Batch Operations**: Process multiple attendees at once
3. **Incremental Sync**: Only sync changes
4. **Async Processing**: Handle webhooks asynchronously

### Monitoring
- Track API usage
- Monitor error rates
- Alert on failures
- Track sync statistics

## Security Considerations

### Best Practices
1. **Validate all webhook signatures**
2. **Implement rate limiting**
3. **Use HTTPS for all communications**
4. **Log all access and changes**
5. **Handle sensitive data carefully**

## Next Steps
1. Implement Google Calendar client service
2. Create meeting manager
3. Build webhook handler
4. Create API endpoints
5. Implement error handling
6. Write comprehensive tests
7. Set up monitoring and logging
