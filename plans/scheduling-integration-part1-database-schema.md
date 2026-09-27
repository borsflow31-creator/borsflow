# Scheduling Integration Module - Database Schema Design

## Overview
This document outlines the database schema modifications required to support the scheduling integration module for Cal.com, Zoom, and Google Meet within the existing CRM system.

## Design Principles
- **Multi-tenant architecture**: All scheduling data must be scoped to workspaces
- **Data integrity**: Foreign key constraints and proper relationships
- **Audit trail**: Track all changes and sync operations
- **Scalability**: Optimize for queries and real-time updates
- **Security**: Store sensitive credentials securely

## New Models

### 1. Calendar Integration
Stores OAuth credentials and configuration for external calendar services.

```prisma
model CalendarIntegration {
  id                String   @id @default(cuid())
  workspaceId       String
  workspace         Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  type              String   // 'calcom', 'google_calendar', 'outlook_calendar'
  name              String   // User-defined name for this integration
  isActive          Boolean  @default(true)
  
  // OAuth 2.0 Credentials (encrypted)
  accessToken       String?  // Encrypted access token
  refreshToken      String?  // Encrypted refresh token
  tokenExpiresAt    DateTime?
  scope             String?  // Granted OAuth scopes
  
  // Provider-specific configuration
  providerUserId    String?  // External user ID from provider
  providerEmail     String?  // Email from provider
  calendarId        String?  // Specific calendar ID to sync
  
  // Sync configuration
  syncEnabled       Boolean  @default(true)
  syncDirection     String   @default("bidirectional") // 'import_only', 'export_only', 'bidirectional'
  lastSyncAt        DateTime?
  syncFrequency     String   @default("hourly") // 'realtime', 'hourly', 'daily', 'manual'
  
  // Sync status tracking
  syncStatus        String   @default("active") // 'active', 'error', 'paused', 'disabled'
  lastSyncError     String?
  lastSyncErrorAt   DateTime?
  
  // Audit
  createdBy         String
  updatedBy         String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  meetings          Meeting[]
  syncLogs          CalendarSyncLog[]
  
  @@unique([workspaceId, type, providerUserId])
  @@index([workspaceId])
  @@index([type])
  @@index([isActive])
  @@index([syncEnabled])
}
```

### 2. Meeting
Represents scheduled meetings from any calendar integration.

```prisma
model Meeting {
  id                    String   @id @default(cuid())
  workspaceId           String
  workspace             Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  
  // Meeting details
  title                 String
  description           String?
  startTime             DateTime
  endTime               DateTime
  duration              Int      // Duration in minutes
  timezone              String   @default("UTC")
  
  // Meeting location/platform
  meetingType           String   // 'in_person', 'online', 'phone'
  location              String?  // Physical address or phone number
  
  // Platform-specific data
  platform              String   // 'calcom', 'zoom', 'google_meet', 'microsoft_teams'
  platformMeetingId     String?  // External meeting ID
  platformEventId       String?  // External event ID (for Cal.com events)
  calendarIntegrationId String?
  calendarIntegration   CalendarIntegration? @relation(fields: [calendarIntegrationId], references: [id], onDelete: SetNull)
  
  // Meeting links
  meetingUrl            String?  // Join URL
  hostUrl               String?  // Host/Start URL
  password              String?  // Meeting password (encrypted)
  
  // Conference details
  conferenceProvider    String?  // 'zoom', 'google_meet', 'microsoft_teams'
  conferenceId          String?  // Conference ID
  conferencePhone       String?  // Dial-in numbers
  
  // Meeting status
  status                String   @default("scheduled") // 'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'
  cancellationReason    String?
  cancelledAt           DateTime?
  
  // CRM Integration
  leadId                String?
  lead                  Lead?    @relation(fields: [leadId], references: [id], onDelete: SetNull)
  userId                String?  // Internal user who is the meeting host
  user                  User?    @relation("MeetingHost", fields: [userId], references: [id], onDelete: SetNull)
  
  // Attendees
  attendees             MeetingAttendee[]
  
  // Recurrence
  isRecurring           Boolean  @default(false)
  recurringPattern      String?  // JSON object with recurrence rules
  recurringEventId      String?  // ID of the parent recurring event
  recurringInstanceId   String?  // ID for this specific instance
  
  // Reminders
  reminderEnabled       Boolean  @default(true)
  reminderTimes         String?  // JSON array of minutes before meeting (e.g., [15, 60, 1440])
  
  // Sync tracking
  externalSyncId        String?  // External sync identifier
  lastSyncedAt          DateTime?
  isExternal            Boolean  @default(false) // True if created externally (Cal.com)
  syncStatus            String   @default("synced") // 'synced', 'pending', 'error', 'conflict'
  syncError             String?
  
  // Audit
  createdBy             String
  updatedBy             String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  // Relations
  notes                 MeetingNote[]
  activities            Activity[]
  
  @@unique([platformEventId, platform])
  @@index([workspaceId])
  @@index([leadId])
  @@index([userId])
  @@index([startTime])
  @@index([status])
  @@index([platform])
  @@index([calendarIntegrationId])
  @@index([isExternal])
}
```

### 3. MeetingAttendee
Tracks attendees for each meeting.

```prisma
model MeetingAttendee {
  id                String   @id @default(cuid())
  meetingId         String
  meeting           Meeting  @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  
  // Attendee details
  name              String
  email             String
  phone             String?
  
  // Attendee type
  type              String   @default("external") // 'internal', 'external', 'lead', 'contact'
  userId            String?  // If internal user
  leadId            String?  // If lead
  
  // Attendance status
  status            String   @default("invited") // 'invited', 'accepted', 'declined', 'tentative', 'attended', 'no_show'
  responseAt        DateTime?
  
  // External attendee ID
  externalAttendeeId String?  // ID from calendar provider
  
  // Join tracking
  joinedAt          DateTime?
  leftAt            DateTime?
  joinUrl           String?  // Personal join URL if available
  
  // Reminder status
  reminderSent      Boolean  @default(false)
  reminderSentAt    DateTime?
  
  // Audit
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([meetingId, email])
  @@index([meetingId])
  @@index([email])
  @@index([status])
}
```

### 4. MeetingNote
Notes and documentation for meetings.

```prisma
model MeetingNote {
  id                String   @id @default(cuid())
  meetingId         String
  meeting           Meeting  @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  
  // Note content
  content           String
  noteType          String   @default("general") // 'general', 'action_item', 'decision', 'follow_up'
  
  // Visibility
  isPrivate         Boolean  @default(false)
  
  // Author
  createdBy         String
  creator           User     @relation("MeetingNoteCreator", fields: [createdBy], references: [id])
  
  // Audit
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([meetingId])
  @@index([createdBy])
}
```

### 5. CalendarSyncLog
Tracks synchronization operations for debugging and monitoring.

```prisma
model CalendarSyncLog {
  id                    String   @id @default(cuid())
  calendarIntegrationId String
  calendarIntegration   CalendarIntegration @relation(fields: [calendarIntegrationId], references: [id], onDelete: Cascade)
  
  // Sync operation details
  operationType         String   // 'full_sync', 'incremental_sync', 'event_create', 'event_update', 'event_delete'
  status                String   // 'started', 'completed', 'failed', 'partial'
  
  // Sync statistics
  eventsProcessed       Int      @default(0)
  eventsCreated         Int      @default(0)
  eventsUpdated         Int      @default(0)
  eventsDeleted         Int      @default(0)
  eventsSkipped         Int      @default(0)
  
  // Error handling
  errorMessage          String?
  errorDetails          String?  // JSON object with detailed error info
  
  // Performance metrics
  durationMs            Int?
  startedAt             DateTime @default(now())
  completedAt           DateTime?
  
  // Sync range
  syncStartDate         DateTime?
  syncEndDate           DateTime?
  
  @@index([calendarIntegrationId])
  @@index([status])
  @@index([startedAt])
}
```

### 6. VideoConferenceConfig
Configuration for video conferencing platforms.

```prisma
model VideoConferenceConfig {
  id                String   @id @default(cuid())
  workspaceId       String
  workspace         Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  
  // Platform configuration
  platform          String   // 'zoom', 'google_meet', 'microsoft_teams'
  name              String   // User-friendly name
  
  // OAuth credentials
  accessToken       String?  // Encrypted
  refreshToken      String?  // Encrypted
  tokenExpiresAt    DateTime?
  
  // Provider-specific settings
  providerUserId    String?
  providerEmail     String?
  
  // Default meeting settings
  defaultSettings   String?  // JSON object with default meeting settings
  
  // Status
  isActive          Boolean  @default(true)
  isDefault         Boolean  @default(false) // Is this the default platform?
  
  // Audit
  createdBy         String
  updatedBy         String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([workspaceId, platform])
  @@index([workspaceId])
  @@index([platform])
  @@index([isActive])
}
```

### 7. Activity
Activity log for meeting-related actions.

```prisma
model Activity {
  id                String   @id @default(cuid())
  workspaceId       String
  workspace         Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  
  // Activity details
  type              String   // 'meeting_created', 'meeting_updated', 'meeting_cancelled', 'meeting_completed', 'attendee_added', 'note_added'
  entityType        String   // 'meeting', 'attendee', 'note'
  entityId          String
  
  // Activity description
  description       String
  metadata          String?  // JSON object with additional context
  
  // User who performed the action
  userId            String
  user              User     @relation("ActivityUser", fields: [userId], references: [id])
  
  // Related entities
  meetingId         String?
  meeting           Meeting? @relation(fields: [meetingId], references: [id], onDelete: SetNull)
  leadId            String?
  
  // Audit
  createdAt         DateTime @default(now())
  
  @@index([workspaceId])
  @@index([userId])
  @@index([meetingId])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

## Model Relationships

### User Model Updates
Add relationships to User model:

```prisma
model User {
  // ... existing fields ...
  
  // Meeting relationships
  hostedMeetings     Meeting[]         @relation("MeetingHost")
  createdMeetingNotes MeetingNote[]     @relation("MeetingNoteCreator")
  activities         Activity[]        @relation("ActivityUser")
}
```

### Workspace Model Updates
Add relationships to Workspace model:

```prisma
model Workspace {
  // ... existing fields ...
  
  // Scheduling relationships
  calendarIntegrations CalendarIntegration[]
  meetings            Meeting[]
  videoConferenceConfigs VideoConferenceConfig[]
  activities           Activity[]
}
```

### Lead Model Updates
Add relationships to Lead model:

```prisma
model Lead {
  // ... existing fields ...
  
  // Meeting relationships
  meetings            Meeting[]
  meetingAttendees    MeetingAttendee[]
}
```

## Database Migration Strategy

### Phase 1: Core Models
1. Create `CalendarIntegration` table
2. Create `Meeting` table
3. Create `MeetingAttendee` table
4. Create `MeetingNote` table

### Phase 2: Sync & Config Models
1. Create `CalendarSyncLog` table
2. Create `VideoConferenceConfig` table
3. Create `Activity` table

### Phase 3: Relationship Updates
1. Update `User` model with new relationships
2. Update `Workspace` model with new relationships
3. Update `Lead` model with new relationships

## Indexes for Performance

### Query Optimization
- **Meeting queries**: Index on `startTime`, `status`, `workspaceId`, `leadId`
- **Sync operations**: Index on `calendarIntegrationId`, `startedAt`, `status`
- **Activity logs**: Index on `workspaceId`, `userId`, `createdAt`
- **Attendee queries**: Index on `meetingId`, `email`, `status`

## Security Considerations

### Data Encryption
- Encrypt all OAuth tokens (`accessToken`, `refreshToken`)
- Encrypt meeting passwords
- Use application-level encryption with database encryption

### Access Control
- All queries must include workspace filtering
- Row-level security for sensitive data
- Audit trail for all access to encrypted fields

## Data Retention Policy

### Sync Logs
- Retain for 90 days
- Archive older logs to cold storage

### Activity Logs
- Retain for 1 year
- Archive older logs

### Meeting Data
- Retain indefinitely (business records)
- Soft delete for cancelled meetings
- Hard delete after 7 years (compliance)

## Scalability Considerations

### Partitioning Strategy
- Partition `Meeting` table by `workspaceId` or date ranges
- Partition `CalendarSyncLog` by `created_at`

### Caching Strategy
- Cache active meeting data
- Cache calendar integration configurations
- Use Redis for real-time sync status

## Next Steps
1. Review and approve schema design
2. Create Prisma migration files
3. Implement seed data for testing
4. Set up database encryption utilities
5. Create data access layer (DAL) for new models
