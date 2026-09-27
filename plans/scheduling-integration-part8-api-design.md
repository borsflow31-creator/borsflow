# Scheduling Integration Module - API Design

## Overview
This document details the REST API design for the scheduling integration module. The API provides endpoints for managing meetings, attendees, integrations, sync operations, and real-time updates.

## API Architecture

### Design Principles
1. **RESTful**: Follow REST conventions
2. **Versioned**: API versioning for backward compatibility
3. **Consistent**: Uniform response formats
4. **Secure**: Authentication and authorization
5. **Documented**: OpenAPI/Swagger specification

### Base URL
```
https://api.yourapp.com/api/v1
```

### Authentication
All endpoints require authentication via NextAuth session or API key.

### Response Format
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
}
```

## Endpoints

### 1. Calendar Integrations

#### Get All Integrations
```typescript
GET /api/v1/calendar-integrations

Query Parameters:
- workspaceId (required): string
- type (optional): 'calcom' | 'zoom' | 'google'
- isActive (optional): boolean

Response:
{
  success: true,
  data: [
    {
      id: string,
      workspaceId: string,
      type: 'calcom' | 'zoom' | 'google',
      name: string,
      isActive: boolean,
      syncEnabled: boolean,
      syncDirection: 'import_only' | 'export_only' | 'bidirectional',
      lastSyncAt: string,
      syncStatus: 'active' | 'error' | 'paused' | 'disabled',
      providerEmail: string,
      createdAt: string,
      updatedAt: string
    }
  ]
}
```

#### Get Integration by ID
```typescript
GET /api/v1/calendar-integrations/:id

Response:
{
  success: true,
  data: {
    id: string,
    workspaceId: string,
    type: 'calcom' | 'zoom' | 'google',
    name: string,
    isActive: boolean,
    syncEnabled: boolean,
    syncDirection: string,
    lastSyncAt: string,
    syncFrequency: 'realtime' | 'hourly' | 'daily' | 'manual',
    syncStatus: string,
    lastSyncError: string,
    lastSyncErrorAt: string,
    providerUserId: string,
    providerEmail: string,
    calendarId: string,
    createdAt: string,
    updatedAt: string
  }
}
```

#### Create Integration
```typescript
POST /api/v1/calendar-integrations

Request Body:
{
  workspaceId: string,
  type: 'calcom' | 'zoom' | 'google',
  name: string,
  syncEnabled: boolean,
  syncDirection: 'import_only' | 'export_only' | 'bidirectional',
  syncFrequency: 'realtime' | 'hourly' | 'daily' | 'manual',
  calendarId?: string
}

Response:
{
  success: true,
  data: {
    id: string,
    // ... integration fields
  }
}
```

#### Update Integration
```typescript
PATCH /api/v1/calendar-integrations/:id

Request Body:
{
  name?: string,
  syncEnabled?: boolean,
  syncDirection?: string,
  syncFrequency?: string,
  calendarId?: string
}

Response:
{
  success: true,
  data: {
    id: string,
    // ... updated integration fields
  }
}
```

#### Delete Integration
```typescript
DELETE /api/v1/calendar-integrations/:id

Response:
{
  success: true,
  data: {
    id: string,
    deleted: true
  }
}
```

#### Get OAuth Authorization URL
```typescript
POST /api/v1/calendar-integrations/:id/authorize

Request Body:
{
  workspaceId: string
}

Response:
{
  success: true,
  data: {
    authUrl: string
  }
}
```

#### Test Integration Connection
```typescript
POST /api/v1/calendar-integrations/:id/test

Response:
{
  success: true,
  data: {
    connected: boolean,
    message: string,
    details?: any
  }
}
```

### 2. Meetings

#### Get All Meetings
```typescript
GET /api/v1/meetings

Query Parameters:
- workspaceId (required): string
- leadId (optional): string
- userId (optional): string
- status (optional): 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
- platform (optional): 'calcom' | 'zoom' | 'google_meet'
- startDate (optional): string (ISO 8601)
- endDate (optional): string (ISO 8601)
- page (optional): number
- pageSize (optional): number

Response:
{
  success: true,
  data: [
    {
      id: string,
      workspaceId: string,
      leadId: string,
      userId: string,
      title: string,
      description: string,
      startTime: string,
      endTime: string,
      duration: number,
      timezone: string,
      meetingType: 'in_person' | 'online' | 'phone',
      location: string,
      platform: 'calcom' | 'zoom' | 'google_meet',
      platformMeetingId: string,
      platformEventId: string,
      meetingUrl: string,
      hostUrl: string,
      conferenceProvider: 'zoom' | 'google_meet' | 'microsoft_teams',
      conferenceId: string,
      status: string,
      isExternal: boolean,
      syncStatus: string,
      lastSyncedAt: string,
      createdAt: string,
      updatedAt: string,
      attendees: MeetingAttendee[],
      _count: {
        attendees: number
      }
    }
  ],
  meta: {
    page: 1,
    pageSize: 20,
    total: 100,
    totalPages: 5
  }
}
```

#### Get Meeting by ID
```typescript
GET /api/v1/meetings/:id

Response:
{
  success: true,
  data: {
    id: string,
    // ... meeting fields
    attendees: MeetingAttendee[],
    notes: MeetingNote[],
    activities: Activity[]
  }
}
```

#### Create Meeting
```typescript
POST /api/v1/meetings

Request Body:
{
  workspaceId: string,
  leadId?: string,
  userId?: string,
  title: string,
  description?: string,
  startTime: string,
  endTime: string,
  timezone?: string,
  meetingType: 'in_person' | 'online' | 'phone',
  location?: string,
  platform?: 'calcom' | 'zoom' | 'google_meet',
  calendarIntegrationId?: string,
  reminderEnabled?: boolean,
  reminderTimes?: number[],
  attendees?: Array<{
    name: string,
    email: string,
    leadId?: string
  }>,
  notes?: string
}

Response:
{
  success: true,
  data: {
    id: string,
    // ... meeting fields
    meetingUrl: string,
    hostUrl: string
  }
}
```

#### Update Meeting
```typescript
PATCH /api/v1/meetings/:id

Request Body:
{
  title?: string,
  description?: string,
  startTime?: string,
  endTime?: string,
  timezone?: string,
  location?: string,
  status?: string,
  reminderEnabled?: boolean,
  reminderTimes?: number[]
}

Response:
{
  success: true,
  data: {
    id: string,
    // ... updated meeting fields
  }
}
```

#### Delete Meeting
```typescript
DELETE /api/v1/meetings/:id

Response:
{
  success: true,
  data: {
    id: string,
    deleted: true
  }
}
```

#### Cancel Meeting
```typescript
POST /api/v1/meetings/:id/cancel

Request Body:
{
  reason?: string
}

Response:
{
  success: true,
  data: {
    id: string,
    status: 'cancelled',
    cancellationReason: string,
    cancelledAt: string
  }
}
```

#### Get Meeting Notes
```typescript
GET /api/v1/meetings/:id/notes

Response:
{
  success: true,
  data: [
    {
      id: string,
      meetingId: string,
      content: string,
      noteType: 'general' | 'action_item' | 'decision' | 'follow_up',
      isPrivate: boolean,
      createdBy: string,
      creator: User,
      createdAt: string,
      updatedAt: string
    }
  ]
}
```

#### Add Meeting Note
```typescript
POST /api/v1/meetings/:id/notes

Request Body:
{
  content: string,
  noteType?: 'general' | 'action_item' | 'decision' | 'follow_up',
  isPrivate?: boolean
}

Response:
{
  success: true,
  data: {
    id: string,
    // ... note fields
  }
}
```

#### Get Meeting Activities
```typescript
GET /api/v1/meetings/:id/activities

Response:
{
  success: true,
  data: [
    {
      id: string,
      workspaceId: string,
      type: string,
      entityType: string,
      entityId: string,
      description: string,
      metadata: any,
      userId: string,
      user: User,
      meetingId: string,
      leadId: string,
      createdAt: string
    }
  ]
}
```

### 3. Attendees

#### Get Meeting Attendees
```typescript
GET /api/v1/meetings/:id/attendees

Response:
{
  success: true,
  data: [
    {
      id: string,
      meetingId: string,
      name: string,
      email: string,
      phone: string,
      type: 'internal' | 'external' | 'lead' | 'contact',
      userId: string,
      leadId: string,
      status: 'invited' | 'accepted' | 'declined' | 'tentative' | 'attended' | 'no_show',
      responseAt: string,
      externalAttendeeId: string,
      joinedAt: string,
      leftAt: string,
      joinUrl: string,
      reminderSent: boolean,
      reminderSentAt: string,
      createdAt: string,
      updatedAt: string
    }
  ]
}
```

#### Add Attendee
```typescript
POST /api/v1/meetings/:id/attendees

Request Body:
{
  name: string,
  email: string,
  phone?: string,
  leadId?: string
}

Response:
{
  success: true,
  data: {
    id: string,
    // ... attendee fields
  }
}
```

#### Update Attendee
```typescript
PATCH /api/v1/meetings/:meetingId/attendees/:id

Request Body:
{
  status?: 'invited' | 'accepted' | 'declined' | 'tentative' | 'attended' | 'no_show'
}

Response:
{
  success: true,
  data: {
    id: string,
    // ... updated attendee fields
  }
}
```

#### Remove Attendee
```typescript
DELETE /api/v1/meetings/:meetingId/attendees/:id

Response:
{
  success: true,
  data: {
    id: string,
    deleted: true
  }
}
```

### 4. Sync Operations

#### Trigger Manual Sync
```typescript
POST /api/v1/sync/trigger

Request Body:
{
  integrationId: string,
  meetingId?: string,
  direction?: 'import' | 'export' | 'bidirectional',
  startDate?: string,
  endDate?: string
}

Response:
{
  success: true,
  data: {
    operationId: string,
    status: 'started',
    message: string
  }
}
```

#### Get Sync Status
```typescript
GET /api/v1/sync/status

Query Parameters:
- integrationId (optional): string

Response:
{
  success: true,
  data: {
    health: {
      healthy: boolean,
      issues: string[]
    },
    metrics: {
      total: number,
      successful: number,
      failed: number,
      successRate: number,
      avgDuration: number,
      lastSync: string
    },
    activeOperations: [
      {
        operationId: string,
        type: string,
        status: string,
        startedAt: string
      }
    ]
  }
}
```

#### Get Sync Logs
```typescript
GET /api/v1/sync/logs

Query Parameters:
- integrationId (optional): string
- status (optional): 'started' | 'completed' | 'failed' | 'partial'
- startDate (optional): string
- endDate (optional): string
- page (optional): number
- pageSize (optional): number

Response:
{
  success: true,
  data: [
    {
      id: string,
      calendarIntegrationId: string,
      operationType: string,
      status: string,
      eventsProcessed: number,
      eventsCreated: number,
      eventsUpdated: number,
      eventsDeleted: number,
      eventsSkipped: number,
      errorMessage: string,
      errorDetails: string,
      durationMs: number,
      startedAt: string,
      completedAt: string,
      syncStartDate: string,
      syncEndDate: string
    }
  ],
  meta: {
    page: 1,
    pageSize: 20,
    total: 100,
    totalPages: 5
  }
}
```

### 5. Platform-Specific Endpoints

#### Cal.com Endpoints

##### Get Cal.com Event Types
```typescript
GET /api/v1/calcom/event-types

Query Parameters:
- integrationId (required): string

Response:
{
  success: true,
  data: [
    {
      id: number,
      title: string,
      slug: string,
      length: number,
      type: string,
      positions: string[],
      schedulingType: string,
      price: number,
      currency: string,
      hidden: boolean
    }
  ]
}
```

##### Check Cal.com Availability
```typescript
POST /api/v1/calcom/availability

Request Body:
{
  integrationId: string,
  eventTypeId: number,
  startTime: string,
  endTime: string,
  timeZone: string
}

Response:
{
  success: true,
  data: {
    available: boolean,
    slots?: Array<{
      start: string,
      end: string
    }>
  }
}
```

#### Zoom Endpoints

##### Create Zoom Meeting
```typescript
POST /api/v1/zoom/meetings

Request Body:
{
  integrationId: string,
  workspaceId: string,
  leadId?: string,
  userId: string,
  title: string,
  description?: string,
  startTime: string,
  duration: number,
  timezone?: string,
  password?: string,
  settings?: {
    hostVideo?: boolean,
    participantVideo?: boolean,
    joinBeforeHost?: boolean,
    muteUponEntry?: boolean,
    waitingRoom?: boolean,
    autoRecording?: 'none' | 'local' | 'cloud'
  }
}

Response:
{
  success: true,
  data: {
    id: string,
    // ... meeting fields
    meetingUrl: string,
    hostUrl: string,
    password: string
  }
}
```

##### Get Zoom Meeting Recordings
```typescript
GET /api/v1/zoom/meetings/:id/recordings

Query Parameters:
- integrationId (required): string

Response:
{
  success: true,
  data: {
    uuid: string,
    meetingNumber: string,
    topic: string,
    startTime: string,
    duration: number,
    totalSize: number,
    recordingCount: number,
    recordingFiles: [
      {
        id: string,
        fileType: string,
        fileExtension: string,
        downloadUrl: string,
        playUrl: string,
        recordingStart: string,
        recordingEnd: string,
        fileSize: number,
        status: string
      }
    ]
  }
}
```

#### Google Meet Endpoints

##### Create Google Meet
```typescript
POST /api/v1/google/meet

Request Body:
{
  integrationId: string,
  workspaceId: string,
  leadId?: string,
  userId: string,
  title: string,
  description?: string,
  startTime: string,
  endTime: string,
  timezone?: string,
  location?: string,
  attendees?: Array<{
    email: string,
    name?: string
  }>,
  reminders?: Array<{
    method: 'email' | 'popup',
    minutes: number
  }>
}

Response:
{
  success: true,
  data: {
    id: string,
    // ... meeting fields
    meetingUrl: string,
    conferenceId: string
  }
}
```

### 6. Video Conference Config

#### Get All Video Conference Configs
```typescript
GET /api/v1/video-conference-configs

Query Parameters:
- workspaceId (required): string
- platform (optional): 'zoom' | 'google_meet' | 'microsoft_teams'

Response:
{
  success: true,
  data: [
    {
      id: string,
      workspaceId: string,
      platform: string,
      name: string,
      isActive: boolean,
      isDefault: boolean,
      createdAt: string,
      updatedAt: string
    }
  ]
}
```

#### Create Video Conference Config
```typescript
POST /api/v1/video-conference-configs

Request Body:
{
  workspaceId: string,
  platform: 'zoom' | 'google_meet' | 'microsoft_teams',
  name: string,
  defaultSettings?: any
}

Response:
{
  success: true,
  data: {
    id: string,
    // ... config fields
  }
}
```

#### Update Video Conference Config
```typescript
PATCH /api/v1/video-conference-configs/:id

Request Body:
{
  name?: string,
  isActive?: boolean,
  isDefault?: boolean,
  defaultSettings?: any
}

Response:
{
  success: true,
  data: {
    id: string,
    // ... updated config fields
  }
}
```

#### Delete Video Conference Config
```typescript
DELETE /api/v1/video-conference-configs/:id

Response:
{
  success: true,
  data: {
    id: string,
    deleted: true
  }
}
```

### 7. Notifications

#### Get Notifications
```typescript
GET /api/v1/notifications

Query Parameters:
- unreadOnly (optional): boolean
- page (optional): number
- pageSize (optional): number

Response:
{
  success: true,
  data: [
    {
      id: string,
      userId: string,
      workspaceId: string,
      type: string,
      title: string,
      body: string,
      data?: any,
      read: boolean,
      createdAt: string
    }
  ],
  meta: {
    page: 1,
    pageSize: 20,
    total: 50,
    totalPages: 3
  }
}
```

#### Mark Notification as Read
```typescript
PATCH /api/v1/notifications/:id/read

Response:
{
  success: true,
  data: {
    id: string,
    read: true
  }
}
```

#### Mark All Notifications as Read
```typescript
POST /api/v1/notifications/read-all

Response:
{
  success: true,
  data: {
    count: number
  }
}
```

#### Delete Notification
```typescript
DELETE /api/v1/notifications/:id

Response:
{
  success: true,
  data: {
    id: string,
    deleted: true
  }
}
```

## Error Codes

```typescript
enum ErrorCode {
  // General Errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  
  // Integration Errors
  INTEGRATION_NOT_FOUND = 'INTEGRATION_NOT_FOUND',
  INTEGRATION_DISABLED = 'INTEGRATION_DISABLED',
  INTEGRATION_ERROR = 'INTEGRATION_ERROR',
  OAUTH_ERROR = 'OAUTH_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Meeting Errors
  MEETING_NOT_FOUND = 'MEETING_NOT_FOUND',
  MEETING_ALREADY_EXISTS = 'MEETING_ALREADY_EXISTS',
  MEETING_CONFLICT = 'MEETING_CONFLICT',
  MEETING_CANNOT_CANCEL = 'MEETING_CANNOT_CANCEL',
  
  // Sync Errors
  SYNC_IN_PROGRESS = 'SYNC_IN_PROGRESS',
  SYNC_FAILED = 'SYNC_FAILED',
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  
  // Attendee Errors
  ATTENDEE_NOT_FOUND = 'ATTENDEE_NOT_FOUND',
  ATTENDEE_ALREADY_EXISTS = 'ATTENDEE_ALREADY_EXISTS',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}
```

## Rate Limiting

- **Authenticated Users**: 1000 requests per hour
- **Anonymous Users**: 100 requests per hour
- **Webhooks**: No rate limiting

## Pagination

All list endpoints support pagination with the following query parameters:
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20, max: 100)

Response includes `meta` object with pagination information.

## Filtering and Sorting

List endpoints support filtering via query parameters:
- Filter by specific fields (e.g., `status=scheduled`)
- Date range filtering (e.g., `startDate=2024-01-01&endDate=2024-12-31`)
- Text search (e.g., `q=meeting title`)

Sorting via query parameters:
- `sortBy`: Field to sort by
- `sortOrder`: `asc` or `desc` (default: `desc`)

## Webhooks

### Webhook Endpoints
- `POST /api/v1/webhooks/calcom` - Cal.com webhooks
- `POST /api/v1/webhooks/zoom` - Zoom webhooks
- `POST /api/v1/webhooks/google` - Google Calendar webhooks

### Webhook Signature Verification
All webhook endpoints verify signatures using platform-specific methods:
- Cal.com: HMAC-SHA256
- Zoom: HMAC-SHA256
- Google: HMAC-SHA256

## Testing

### Example Requests

#### Create a Zoom Meeting
```bash
curl -X POST https://api.yourapp.com/api/v1/zoom/meetings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "integrationId": "integration-123",
    "workspaceId": "workspace-456",
    "userId": "user-789",
    "title": "Client Meeting",
    "startTime": "2024-01-15T10:00:00Z",
    "duration": 60,
    "timezone": "America/New_York"
  }'
```

#### Get Meetings
```bash
curl -X GET "https://api.yourapp.com/api/v1/meetings?workspaceId=workspace-456&status=scheduled" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Next Steps
1. Implement API endpoints
2. Create OpenAPI/Swagger documentation
3. Set up API versioning
4. Implement rate limiting
5. Create API tests
6. Set up monitoring and logging
7. Document API usage examples
