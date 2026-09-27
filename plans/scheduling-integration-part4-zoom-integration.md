# Scheduling Integration Module - Zoom Integration Architecture

## Overview
This document details the architecture for integrating with Zoom, a leading video conferencing platform. The integration enables users to create, manage, and initiate Zoom meetings directly from the CRM interface, with automatic logging against client profiles.

## Zoom API Overview

### API Endpoints
- **Base URL**: `https://api.zoom.us/v2`
- **Authentication**: Bearer token (OAuth 2.0 or JWT)
- **Rate Limiting**: Varies by endpoint (typically 100-200 requests per minute)

### Key API Capabilities
1. **Meeting Management**: Create, update, delete, and retrieve meetings
2. **User Management**: Get user information and settings
3. **Meeting Reports**: Track attendance and participation
4. **Webhooks**: Real-time event notifications
5. **Recording Management**: Access meeting recordings

## Integration Architecture

### Components
1. **Zoom Client Service**: Direct API interaction with Zoom
2. **Meeting Manager**: Handle Zoom meeting lifecycle
3. **Webhook Handler**: Process real-time Zoom events
4. **Recording Manager**: Access and manage meeting recordings
5. **Participant Tracker**: Track meeting attendance

### Data Flow
```
CRM User Interface
    ↓ (Create Meeting Request)
Meeting Manager
    ↓ (API Call)
Zoom Client Service
    ↓ (OAuth 2.0)
Zoom API
    ↓ (Meeting Created)
CRM Database (Meetings, Attendees)
    ↓ (Notifications)
Frontend UI
```

## Zoom Client Service

```typescript
// src/lib/zoom/zoom-client.ts
interface ZoomUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  type: number;
  role_name: string;
  pmi: number;
  use_pmi: boolean;
  personal_meeting_url: string;
  timezone: string;
  verified: number;
  created_at: string;
  last_login_time: string;
}

interface ZoomMeeting {
  uuid: string;
  id: number;
  host_id: string;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  timezone: string;
  agenda: string;
  created_at: string;
  start_url: string;
  join_url: string;
  password: string;
  h323_password: string;
  pstn_password: string;
  encrypted_password: string;
  status: string;
  settings: ZoomMeetingSettings;
  host_email: string;
}

interface ZoomMeetingSettings {
  host_video: boolean;
  participant_video: boolean;
  cn_meeting: boolean;
  in_meeting: boolean;
  join_before_host: boolean;
  jbh_time: number;
  mute_upon_entry: boolean;
  watermark: boolean;
  use_pmi: boolean;
  approval_type: number;
  audio: string;
  auto_recording: string;
  enforce_login: boolean;
  enforce_login_domains: string;
  alternative_hosts: string;
  close_registration: boolean;
  waiting_room: boolean;
  global_dial_in_countries: string[];
  global_dial_in_numbers: any[];
  contact_name: string;
  contact_email: string;
  registrants_email_notification: boolean;
  meeting_authentication: boolean;
  breakout_room: boolean;
  alternative_hosts_email_notification: boolean;
  show_share_button: boolean;
  allow_multiple_devices: boolean;
  registrants_confirmation_email: boolean;
  registrants_email_notification: boolean;
}

interface ZoomParticipant {
  id: string;
  name: string;
  user_email: string;
  join_time: string;
  leave_time: string;
  duration: number;
  share_screen_time: number;
  video_send_time: number;
  video_recv_time: number;
  audio_send_time: number;
  audio_recv_time: number;
  status: string;
  customer_key: string;
}

interface ZoomRecording {
  uuid: string;
  meeting_number: string;
  topic: string;
  start_time: string;
  timezone: string;
  host_id: string;
  duration: number;
  total_size: number;
  recording_count: number;
  recording_files: ZoomRecordingFile[];
  share_url: string;
}

interface ZoomRecordingFile {
  id: string;
  file_type: string;
  file_extension: string;
  download_url: string;
  play_url: string;
  recording_start: string;
  recording_end: string;
  file_size: number;
  status: string;
}

class ZoomClient {
  private baseUrl: string;
  private accessToken: string;
  
  constructor(accessToken: string) {
    this.baseUrl = 'https://api.zoom.us/v2';
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
      throw new ZoomError(error.message || 'Zoom API error', response.status);
    }
    
    return response.json();
  }
  
  // User Management
  async getUser(userId: string): Promise<ZoomUser> {
    return this.request<ZoomUser>(`/users/${userId}`);
  }
  
  async getCurrentUser(): Promise<ZoomUser> {
    return this.request<ZoomUser>('/users/me');
  }
  
  // Meeting Management
  async createMeeting(
    userId: string,
    meetingData: Partial<ZoomMeeting>
  ): Promise<ZoomMeeting> {
    return this.request<ZoomMeeting>(`/users/${userId}/meetings`, {
      method: 'POST',
      body: JSON.stringify(meetingData),
    });
  }
  
  async getMeeting(meetingId: number): Promise<ZoomMeeting> {
    return this.request<ZoomMeeting>(`/meetings/${meetingId}`);
  }
  
  async updateMeeting(
    meetingId: number,
    meetingData: Partial<ZoomMeeting>
  ): Promise<ZoomMeeting> {
    return this.request<ZoomMeeting>(`/meetings/${meetingId}`, {
      method: 'PATCH',
      body: JSON.stringify(meetingData),
    });
  }
  
  async deleteMeeting(meetingId: number): Promise<void> {
    await this.request(`/meetings/${meetingId}`, {
      method: 'DELETE',
    });
  }
  
  async listMeetings(
    userId: string,
    options: {
      type?: 'scheduled' | 'live' | 'upcoming' | 'previous';
      from?: string;
      to?: string;
      page_size?: number;
      next_page_token?: string;
    } = {}
  ): Promise<{ meetings: ZoomMeeting[]; next_page_token: string }> {
    const params = new URLSearchParams();
    
    if (options.type) params.append('type', options.type);
    if (options.from) params.append('from', options.from);
    if (options.to) params.append('to', options.to);
    if (options.page_size) params.append('page_size', options.page_size.toString());
    if (options.next_page_token) params.append('next_page_token', options.next_page_token);
    
    return this.request(`/users/${userId}/meetings?${params.toString()}`);
  }
  
  // Meeting Status
  async getMeetingStatus(meetingId: number): Promise<{ status: string }> {
    return this.request(`/meetings/${meetingId}/status`);
  }
  
  async endMeeting(meetingId: number): Promise<void> {
    await this.request(`/meetings/${meetingId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ action: 'end' }),
    });
  }
  
  // Participants
  async getMeetingParticipants(
    meetingId: number,
    options: {
      page_size?: number;
      next_page_token?: string;
      include_custom_fields?: boolean;
    } = {}
  ): Promise<{
    participants: ZoomParticipant[];
    next_page_token: string;
  }> {
    const params = new URLSearchParams();
    
    if (options.page_size) params.append('page_size', options.page_size.toString());
    if (options.next_page_token) params.append('next_page_token', options.next_page_token);
    if (options.include_custom_fields) params.append('include_custom_fields', 'true');
    
    return this.request(`/past_meetings/${meetingId}/participants?${params.toString()}`);
  }
  
  // Registrants
  async addRegistrant(
    meetingId: number,
    registrantData: {
      email: string;
      first_name: string;
      last_name: string;
    }
  ): Promise<any> {
    return this.request(`/meetings/${meetingId}/registrants`, {
      method: 'POST',
      body: JSON.stringify(registrantData),
    });
  }
  
  async getRegistrants(
    meetingId: number,
    options: {
      occurrence_id?: string;
      status?: 'pending' | 'approved' | 'denied';
      page_size?: number;
      next_page_token?: string;
    } = {}
  ): Promise<any> {
    const params = new URLSearchParams();
    
    if (options.occurrence_id) params.append('occurrence_id', options.occurrence_id);
    if (options.status) params.append('status', options.status);
    if (options.page_size) params.append('page_size', options.page_size.toString());
    if (options.next_page_token) params.append('next_page_token', options.next_page_token);
    
    return this.request(`/meetings/${meetingId}/registrants?${params.toString()}`);
  }
  
  // Recordings
  async getMeetingRecordings(
    meetingId: number,
    options: {
      from?: string;
      to?: string;
      page_size?: number;
      next_page_token?: string;
    } = {}
  ): Promise<ZoomRecording> {
    const params = new URLSearchParams();
    
    if (options.from) params.append('from', options.from);
    if (options.to) params.append('to', options.to);
    if (options.page_size) params.append('page_size', options.page_size.toString());
    if (options.next_page_token) params.append('next_page_token', options.next_page_token);
    
    return this.request(`/meetings/${meetingId}/recordings?${params.toString()}`);
  }
  
  async getUserRecordings(
    userId: string,
    options: {
      from?: string;
      to?: string;
      page_size?: number;
      next_page_token?: string;
    } = {}
  ): Promise<{ meetings: ZoomRecording[]; next_page_token: string }> {
    const params = new URLSearchParams();
    
    if (options.from) params.append('from', options.from);
    if (options.to) params.append('to', options.to);
    if (options.page_size) params.append('page_size', options.page_size.toString());
    if (options.next_page_token) params.append('next_page_token', options.next_page_token);
    
    return this.request(`/users/${userId}/recordings?${params.toString()}`);
  }
  
  // Webhooks
  async createWebhook(
    webhookUrl: string,
    eventTypes: string[],
    authToken?: string
  ): Promise<any> {
    return this.request('/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        endpoint_url: webhookUrl,
        event_types: eventTypes,
        auth_token: authToken,
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

class ZoomError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ZoomError';
  }
}
```

## Meeting Manager

```typescript
// src/lib/zoom/meeting-manager.ts
import { ZoomClient } from './zoom-client';
import { TokenManager } from '@/lib/oauth/token-manager';
import { EncryptionService } from '@/lib/oauth/encryption-service';

interface CreateMeetingRequest {
  workspaceId: string;
  leadId?: string;
  userId: string;
  title: string;
  description?: string;
  startTime: Date;
  duration: number;
  timezone?: string;
  password?: string;
  settings?: Partial<ZoomMeetingSettings>;
}

class MeetingManager {
  private tokenManager: TokenManager;
  private encryptionService: EncryptionService;
  
  constructor() {
    this.tokenManager = new TokenManager();
    this.encryptionService = new EncryptionService();
  }
  
  async createMeeting(
    integrationId: string,
    request: CreateMeetingRequest
  ): Promise<Meeting> {
    const accessToken = await this.tokenManager.getValidAccessToken(integrationId);
    const zoomClient = new ZoomClient(accessToken);
    
    // Get Zoom user ID
    const zoomUser = await zoomClient.getCurrentUser();
    
    // Create meeting in Zoom
    const zoomMeeting = await zoomClient.createMeeting(zoomUser.id, {
      topic: request.title,
      agenda: request.description,
      type: 2, // Scheduled meeting
      start_time: request.startTime.toISOString(),
      duration: request.duration,
      timezone: request.timezone || 'UTC',
      password: request.password,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: false,
        waiting_room: true,
        auto_recording: 'cloud',
        ...request.settings,
      },
    });
    
    // Encrypt meeting password
    const encryptedPassword = zoomMeeting.password 
      ? await this.encryptionService.encrypt(zoomMeeting.password)
      : null;
    
    // Create meeting in CRM
    const meeting = await prisma.meeting.create({
      data: {
        workspaceId: request.workspaceId,
        leadId: request.leadId,
        userId: request.userId,
        title: zoomMeeting.topic,
        description: zoomMeeting.agenda,
        startTime: new Date(zoomMeeting.start_time),
        endTime: new Date(
          new Date(zoomMeeting.start_time).getTime() + zoomMeeting.duration * 60000
        ),
        duration: zoomMeeting.duration,
        timezone: zoomMeeting.timezone,
        meetingType: 'online',
        platform: 'zoom',
        platformMeetingId: zoomMeeting.id.toString(),
        meetingUrl: zoomMeeting.join_url,
        hostUrl: zoomMeeting.start_url,
        password: encryptedPassword,
        conferenceProvider: 'zoom',
        conferenceId: zoomMeeting.id.toString(),
        status: 'scheduled',
        isExternal: false,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        createdBy: request.userId,
      },
    });
    
    // Log activity
    await prisma.activity.create({
      data: {
        workspaceId: request.workspaceId,
        type: 'meeting_created',
        entityType: 'meeting',
        entityId: meeting.id,
        description: `Created Zoom meeting: ${meeting.title}`,
        metadata: JSON.stringify({
          platform: 'zoom',
          meetingId: zoomMeeting.id,
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
    const zoomClient = new ZoomClient(accessToken);
    
    // Get existing meeting
    const existingMeeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });
    
    if (!existingMeeting) {
      throw new Error('Meeting not found');
    }
    
    // Update meeting in Zoom
    const zoomMeeting = await zoomClient.updateMeeting(
      parseInt(existingMeeting.platformMeetingId!),
      {
        topic: updates.title,
        agenda: updates.description,
        start_time: updates.startTime?.toISOString(),
        duration: updates.duration,
        timezone: updates.timezone,
        password: updates.password,
        settings: updates.settings,
      }
    );
    
    // Update meeting in CRM
    const meeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        title: zoomMeeting.topic,
        description: zoomMeeting.agenda,
        startTime: new Date(zoomMeeting.start_time),
        endTime: new Date(
          new Date(zoomMeeting.start_time).getTime() + zoomMeeting.duration * 60000
        ),
        duration: zoomMeeting.duration,
        timezone: zoomMeeting.timezone,
        meetingUrl: zoomMeeting.join_url,
        hostUrl: zoomMeeting.start_url,
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
        description: `Updated Zoom meeting: ${meeting.title}`,
        metadata: JSON.stringify({
          platform: 'zoom',
          meetingId: zoomMeeting.id,
        }),
        userId: updates.userId!,
        meetingId: meeting.id,
      },
    });
    
    return meeting;
  }
  
  async deleteMeeting(integrationId: string, meetingId: string): Promise<void> {
    const accessToken = await this.tokenManager.getValidAccessToken(integrationId);
    const zoomClient = new ZoomClient(accessToken);
    
    // Get existing meeting
    const existingMeeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });
    
    if (!existingMeeting) {
      throw new Error('Meeting not found');
    }
    
    // Delete meeting in Zoom
    await zoomClient.deleteMeeting(parseInt(existingMeeting.platformMeetingId!));
    
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
        description: `Cancelled Zoom meeting: ${existingMeeting.title}`,
        metadata: JSON.stringify({
          platform: 'zoom',
        }),
        userId: existingMeeting.userId!,
        meetingId: meetingId,
      },
    });
  }
  
  async getMeetingDetails(integrationId: string, meetingId: string): Promise<Meeting> {
    const accessToken = await this.tokenManager.getValidAccessToken(integrationId);
    const zoomClient = new ZoomClient(accessToken);
    
    // Get meeting from CRM
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { attendees: true },
    });
    
    if (!meeting) {
      throw new Error('Meeting not found');
    }
    
    // Get fresh data from Zoom
    const zoomMeeting = await zoomClient.getMeeting(parseInt(meeting.platformMeetingId!));
    
    // Decrypt password if needed
    let decryptedPassword = null;
    if (meeting.password) {
      decryptedPassword = await this.encryptionService.decrypt(meeting.password);
    }
    
    return {
      ...meeting,
      password: decryptedPassword,
      zoomMeeting,
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
    
    // Optionally register in Zoom if meeting requires registration
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });
    
    if (meeting?.platformMeetingId) {
      try {
        const integration = await prisma.videoConferenceConfig.findFirst({
          where: {
            workspaceId: meeting.workspaceId,
            platform: 'zoom',
            isActive: true,
          },
        });
        
        if (integration) {
          const accessToken = await this.tokenManager.getValidAccessToken(integration.id);
          const zoomClient = new ZoomClient(accessToken);
          
          await zoomClient.addRegistrant(parseInt(meeting.platformMeetingId), {
            email: attendee.email,
            first_name: attendee.name.split(' ')[0],
            last_name: attendee.name.split(' ').slice(1).join(' '),
          });
        }
      } catch (error) {
        console.error('Failed to register attendee in Zoom:', error);
      }
    }
    
    return meetingAttendee;
  }
}
```

## Recording Manager

```typescript
// src/lib/zoom/recording-manager.ts
import { ZoomClient } from './zoom-client';
import { TokenManager } from '@/lib/oauth/token-manager';

class RecordingManager {
  private tokenManager: TokenManager;
  
  constructor() {
    this.tokenManager = new TokenManager();
  }
  
  async getMeetingRecordings(
    integrationId: string,
    meetingId: string
  ): Promise<ZoomRecording> {
    const accessToken = await this.tokenManager.getValidAccessToken(integrationId);
    const zoomClient = new ZoomClient(accessToken);
    
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });
    
    if (!meeting?.platformMeetingId) {
      throw new Error('Meeting not found or not a Zoom meeting');
    }
    
    return zoomClient.getMeetingRecordings(parseInt(meeting.platformMeetingId));
  }
  
  async downloadRecording(
    integrationId: string,
    downloadUrl: string
  ): Promise<Buffer> {
    const accessToken = await this.tokenManager.getValidAccessToken(integrationId);
    
    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to download recording');
    }
    
    return Buffer.from(await response.arrayBuffer());
  }
  
  async getUserRecordings(
    integrationId: string,
    options: {
      from?: Date;
      to?: Date;
    } = {}
  ): Promise<ZoomRecording[]> {
    const accessToken = await this.tokenManager.getValidAccessToken(integrationId);
    const zoomClient = new ZoomClient(accessToken);
    
    const response = await zoomClient.getUserRecordings('me', {
      from: options.from?.toISOString(),
      to: options.to?.toISOString(),
    });
    
    return response.meetings;
  }
}
```

## Webhook Handler

```typescript
// src/app/api/webhooks/zoom/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.ZOOM_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const signature = request.headers.get('x-zm-signature');
    const timestamp = request.headers.get('x-zm-request-timestamp');
    const body = await request.text();
    
    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Missing signature or timestamp' }, { status: 401 });
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .concat(`v0:${timestamp}:${body}`)
      .digest('hex');
    
    if (signature !== `v0=${expectedSignature}`) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    const payload = JSON.parse(body);
    
    // Process webhook event
    await processZoomWebhook(payload);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Zoom webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

async function processZoomWebhook(payload: any): Promise<void> {
  const { event, payload: data } = payload;
  
  switch (event) {
    case 'meeting.started':
      await handleMeetingStarted(data);
      break;
    case 'meeting.ended':
      await handleMeetingEnded(data);
      break;
    case 'meeting.participant_joined':
      await handleParticipantJoined(data);
      break;
    case 'meeting.participant_left':
      await handleParticipantLeft(data);
      break;
    case 'meeting.recording_completed':
      await handleRecordingCompleted(data);
      break;
    default:
      console.log(`Unhandled webhook event: ${event}`);
  }
}

async function handleMeetingStarted(data: any): Promise<void> {
  await prisma.meeting.updateMany({
    where: {
      platformMeetingId: data.id.toString(),
      platform: 'zoom',
    },
    data: {
      status: 'in_progress',
    },
  });
}

async function handleMeetingEnded(data: any): Promise<void> {
  await prisma.meeting.updateMany({
    where: {
      platformMeetingId: data.id.toString(),
      platform: 'zoom',
    },
    data: {
      status: 'completed',
    },
  });
}

async function handleParticipantJoined(data: any): Promise<void> {
  await prisma.meetingAttendee.updateMany({
    where: {
      meeting: {
        platformMeetingId: data.id.toString(),
        platform: 'zoom',
      },
      email: data.participant.email,
    },
    data: {
      status: 'attended',
      joinedAt: new Date(),
    },
  });
}

async function handleParticipantLeft(data: any): Promise<void> {
  await prisma.meetingAttendee.updateMany({
    where: {
      meeting: {
        platformMeetingId: data.id.toString(),
        platform: 'zoom',
      },
      email: data.participant.email,
    },
    data: {
      leftAt: new Date(),
    },
  });
}

async function handleRecordingCompleted(data: any): Promise<void> {
  // Update meeting with recording info
  await prisma.meeting.updateMany({
    where: {
      platformMeetingId: data.id.toString(),
      platform: 'zoom',
    },
    data: {
      metadata: JSON.stringify({
        recordingAvailable: true,
        recordingFiles: data.recording_files,
      }),
    },
  });
}
```

## API Endpoints

### Create Zoom Meeting
```typescript
// src/app/api/zoom/meetings/route.ts
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
// src/app/api/zoom/meetings/[id]/route.ts
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

### Get Meeting Recordings
```typescript
// src/app/api/zoom/meetings/[id]/recordings/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const integrationId = searchParams.get('integrationId');
  
  if (!integrationId) {
    return NextResponse.json({ error: 'Integration ID required' }, { status: 400 });
  }
  
  const recordingManager = new RecordingManager();
  const recordings = await recordingManager.getMeetingRecordings(integrationId, params.id);
  
  return NextResponse.json(recordings);
}
```

## Testing Strategy

### Unit Tests
- Zoom client methods
- Meeting transformation logic
- Password encryption/decryption
- Webhook signature verification

### Integration Tests
- Complete meeting lifecycle
- Recording management
- Webhook processing
- Error handling

### End-to-End Tests
- User creates Zoom meeting → Appears in CRM
- Meeting starts → Status updates
- Participant joins → Attendance tracked
- Recording completes → Available in CRM

## Error Handling

### Common Errors
1. **Authentication failures**: Token expired, invalid credentials
2. **Meeting not found**: Invalid meeting ID
3. **Permission denied**: User lacks permissions
4. **Rate limiting**: Too many requests

### Error Recovery
- Automatic token refresh
- Exponential backoff for retries
- Graceful degradation
- Detailed error logging

## Performance Considerations

### Optimization Strategies
1. **Caching**: Cache meeting details and user info
2. **Batch Operations**: Process multiple attendees at once
3. **Async Processing**: Handle webhooks asynchronously
4. **Pagination**: Use pagination for large datasets

### Monitoring
- Track API usage
- Monitor error rates
- Alert on failures
- Track meeting statistics

## Security Considerations

### Best Practices
1. **Encrypt meeting passwords**
2. **Validate all webhook signatures**
3. **Implement rate limiting**
4. **Use HTTPS for all communications**
5. **Log all access and changes**

## Next Steps
1. Implement Zoom client service
2. Create meeting manager
3. Build recording manager
4. Set up webhook handler
5. Create API endpoints
6. Implement error handling
7. Write comprehensive tests
8. Set up monitoring and logging
