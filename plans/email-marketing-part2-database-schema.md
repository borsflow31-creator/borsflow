# Email Marketing Integration - Part 2: Database Schema Extensions

## Executive Summary

This document details the database schema extensions required to support email marketing and automated email sending capabilities in the CRM system. The schema builds upon the existing Prisma schema and adds models for campaigns, emails, templates, tracking, and automation.

## 1. Schema Overview

### 1.1 New Models to Add

The following new models will be added to the existing [`schema.prisma`](../prisma/schema.prisma:1-401):

1. **EmailCampaign** - Main campaign entity
2. **EmailTemplate** - Reusable email templates
3. **Email** - Individual email messages
4. **EmailRecipient** - Email-to-lead mapping
5. **EmailTracking** - Email engagement tracking
6. **EmailAutomation** - Automated email sequences
7. **AutomationTrigger** - Trigger conditions for automation
8. **AutomationStep** - Individual steps in automation
9. **SegmentationRule** - Customer segmentation rules
10. **SegmentMember** - Lead-to-segment mapping
11. **EmailProvider** - Email service provider configuration
12. **EmailQueue** - Email sending queue
13. **EmailBounce** - Bounced email tracking
14. **EmailUnsubscribe** - Unsubscribe management
15. **EmailSuppression** - Suppression list management

## 2. Detailed Schema Definitions

### 2.1 Email Campaign Model

```prisma
model EmailCampaign {
  id                String            @id @default(cuid())
  name              String
  description       String?
  type              String            @default("broadcast") // 'broadcast', 'drip', 'automation', 'transactional'
  status            String            @default("draft") // 'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'
  workspaceId       String
  workspace         Workspace         @relation(fields: [workspaceId], references: [id])
  templateId        String?
  template          EmailTemplate?    @relation(fields: [templateId], references: [id])
  subject           String
  fromName          String?
  fromEmail         String?
  replyTo           String?
  segmentationRuleId String?
  segmentationRule  SegmentationRule? @relation(fields: [segmentationRuleId], references: [id])
  scheduledAt       DateTime?
  startedAt         DateTime?
  completedAt       DateTime?
  totalRecipients   Int               @default(0)
  sentCount         Int               @default(0)
  deliveredCount    Int               @default(0)
  openedCount       Int               @default(0)
  clickedCount      Int               @default(0)
  bouncedCount      Int               @default(0)
  unsubscribedCount Int               @default(0)
  tags              String?           // JSON array of tags
  metadata          String?           // JSON object for additional data
  createdBy         String
  updatedBy         String?
  emails            Email[]
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@index([workspaceId])
  @@index([status])
  @@index([scheduledAt])
  @@index([type])
}
```

### 2.2 Email Template Model

```prisma
model EmailTemplate {
  id          String          @id @default(cuid())
  name        String
  description String?
  type        String          @default("marketing") // 'marketing', 'transactional', 'automation'
  workspaceId String
  workspace   Workspace       @relation(fields: [workspaceId], references: [id])
  subject     String
  htmlContent String
  textContent String?
  variables   String?         // JSON array of available variables
  isDefault   Boolean         @default(false)
  isActive    Boolean         @default(true)
  tags        String?         // JSON array of tags
  campaigns   EmailCampaign[]
  createdBy   String
  updatedBy   String?
  automationSteps AutomationStep[]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([workspaceId])
  @@index([type])
  @@index([isActive])
}
```

### 2.3 Email Model

```prisma
model Email {
  id                String            @id @default(cuid())
  campaignId        String?
  campaign          EmailCampaign?    @relation(fields: [campaignId], references: [id])
  automationStepId  String?
  automationStep    AutomationStep?   @relation(fields: [automationStepId], references: [id])
  workspaceId       String
  workspace         Workspace         @relation(fields: [workspaceId], references: [id])
  subject           String
  fromName          String?
  fromEmail         String?
  replyTo           String?
  htmlContent       String
  textContent       String?
  status            String            @default("pending") // 'pending', 'queued', 'sending', 'sent', 'failed', 'cancelled'
  providerMessageId String?           // External provider message ID
  providerType      String?           // 'sendgrid', 'ses', 'resend', etc.
  error             String?
  sentAt            DateTime?
  deliveredAt       DateTime?
  recipients        EmailRecipient[]
  tracking          EmailTracking?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@index([workspaceId])
  @@index([campaignId])
  @@index([status])
  @@index([sentAt])
}
```

### 2.4 Email Recipient Model

```prisma
model EmailRecipient {
  id              String         @id @default(cuid())
  emailId         String
  email           Email          @relation(fields: [emailId], references: [id], onDelete: Cascade)
  leadId          String?
  lead            Lead?          @relation(fields: [leadId], references: [id])
  recipientEmail  String
  recipientName   String?
  status          String         @default("pending") // 'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed', 'failed'
  sentAt          DateTime?
  deliveredAt     DateTime?
  openedAt        DateTime?
  clickCount      Int            @default(0)
  lastClickAt     DateTime?
  bouncedAt       DateTime?
  bounceReason    String?
  unsubscribedAt  DateTime?
  unsubscribeReason String?
  metadata        String?        // JSON object for additional data
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([emailId])
  @@index([leadId])
  @@index([status])
  @@index([recipientEmail])
}
```

### 2.5 Email Tracking Model

```prisma
model EmailTracking {
  id              String         @id @default(cuid())
  emailId         String         @unique
  email           Email          @relation(fields: [emailId], references: [id], onDelete: Cascade)
  trackingId      String         @unique // Unique tracking identifier
  openCount       Int            @default(0)
  firstOpenAt     DateTime?
  lastOpenAt      DateTime?
  clickCount      Int            @default(0)
  firstClickAt    DateTime?
  lastClickAt     DateTime?
  links           String?        // JSON array of tracked links with click counts
  deviceInfo      String?        // JSON object with device/browser info
  ipAddress       String?
  userAgent       String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([trackingId])
}
```

### 2.6 Email Automation Model

```prisma
model EmailAutomation {
  id              String            @id @default(cuid())
  name            String
  description     String?
  type            String            @default("drip") // 'drip', 'trigger', 'behavioral'
  status          String            @default("draft") // 'draft', 'active', 'paused', 'completed'
  workspaceId     String
  workspace       Workspace         @relation(fields: [workspaceId], references: [id])
  triggers        AutomationTrigger[]
  steps           AutomationStep[]
  entryCriteria   String?           // JSON array of criteria for entering automation
  exitCriteria    String?           // JSON array of criteria for exiting automation
  totalEnrolled   Int               @default(0)
  activeEnrolled  Int               @default(0)
  completedCount  Int               @default(0)
  tags            String?           // JSON array of tags
  metadata        String?           // JSON object for additional data
  createdBy       String
  updatedBy       String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([workspaceId])
  @@index([status])
  @@index([type])
}
```

### 2.7 Automation Trigger Model

```prisma
model AutomationTrigger {
  id              String            @id @default(cuid())
  automationId    String
  automation      EmailAutomation    @relation(fields: [automationId], references: [id], onDelete: Cascade)
  type            String            // 'lead_created', 'stage_changed', 'status_changed', 'tag_added', 'custom_event', 'time_based'
  conditions      String            // JSON array of trigger conditions
  isActive        Boolean           @default(true)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([automationId])
  @@index([type])
}
```

### 2.8 Automation Step Model

```prisma
model AutomationStep {
  id              String            @id @default(cuid())
  automationId    String
  automation      EmailAutomation    @relation(fields: [automationId], references: [id], onDelete: Cascade)
  templateId      String?
  template        EmailTemplate?     @relation(fields: [templateId], references: [id])
  order           Int
  name            String
  description     String?
  delayMinutes    Int               @default(0) // Delay before sending this step
  sendCondition   String?           // JSON array of conditions for sending
  emails          Email[]
  totalSent       Int               @default(0)
  totalOpened     Int               @default(0)
  totalClicked    Int               @default(0)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@unique([automationId, order])
  @@index([automationId])
}
```

### 2.9 Segmentation Rule Model

```prisma
model SegmentationRule {
  id              String            @id @default(cuid())
  name            String
  description     String?
  workspaceId     String
  workspace       Workspace         @relation(fields: [workspaceId], references: [id])
  criteria        String            // JSON array of criteria
  logicOperator   String            @default("AND") // 'AND' or 'OR'
  isActive        Boolean           @default(true)
  estimatedSize   Int?              // Cached estimate of segment size
  lastCalculated  DateTime?
  members         SegmentMember[]
  campaigns       EmailCampaign[]
  tags            String?           // JSON array of tags
  createdBy       String
  updatedBy       String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([workspaceId])
  @@index([isActive])
}
```

### 2.10 Segment Member Model

```prisma
model SegmentMember {
  id                String            @id @default(cuid())
  segmentationRuleId String
  segmentationRule  SegmentationRule  @relation(fields: [segmentationRuleId], references: [id], onDelete: Cascade)
  leadId            String
  lead              Lead              @relation(fields: [leadId], references: [id], onDelete: Cascade)
  matchedAt         DateTime          @default(now())
  score             Float?            // Lead score within segment
  metadata          String?           // JSON object for additional data

  @@unique([segmentationRuleId, leadId])
  @@index([segmentationRuleId])
  @@index([leadId])
}
```

### 2.11 Email Provider Model

```prisma
model EmailProvider {
  id              String            @id @default(cuid())
  workspaceId     String
  workspace       Workspace         @relation(fields: [workspaceId], references: [id])
  name            String
  type            String            // 'sendgrid', 'ses', 'resend', 'mailgun', 'postmark', 'custom'
  apiKey          String?           // Encrypted API key
  apiKeyEncrypted String?           // Encrypted version for security
  region          String?           // For AWS SES
  fromEmail       String
  fromName        String?
  replyTo         String?
  config          String?           // JSON object for provider-specific config
  isActive        Boolean           @default(true)
  isDefault       Boolean           @default(false)
  dailyLimit      Int?              // Daily sending limit
  monthlyLimit    Int?              // Monthly sending limit
  lastUsedAt      DateTime?
  createdBy       String
  updatedBy       String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([workspaceId])
  @@index([type])
  @@index([isActive])
}
```

### 2.12 Email Queue Model

```prisma
model EmailQueue {
  id              String            @id @default(cuid())
  emailId         String            @unique
  email           Email             @relation(fields: [emailId], references: [id], onDelete: Cascade)
  priority        Int               @default(5) // 1-10, 1 is highest
  scheduledFor    DateTime          @default(now())
  attempts        Int               @default(0)
  maxAttempts     Int               @default(3)
  lastAttemptAt   DateTime?
  nextAttemptAt   DateTime?
  status          String            @default("pending") // 'pending', 'processing', 'completed', 'failed'
  error           String?
  providerId      String?
  processedAt     DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([scheduledFor])
  @@index([status])
  @@index([priority])
}
```

### 2.13 Email Bounce Model

```prisma
model EmailBounce {
  id              String            @id @default(cuid())
  email           String
  recipientEmail  String
  recipientId     String?           // Lead ID if available
  type            String            // 'hard', 'soft', 'spam', 'blocked'
  subType         String?           // More specific bounce type
  reason          String?
  providerType    String?
  providerMessage String?
  occurredAt      DateTime          @default(now())
  createdAt       DateTime          @default(now())

  @@index([email])
  @@index([recipientEmail])
  @@index([type])
  @@index([occurredAt])
}
```

### 2.14 Email Unsubscribe Model

```prisma
model EmailUnsubscribe {
  id              String            @id @default(cuid())
  email           String
  leadId          String?
  campaignId      String?
  reason          String?
  source          String            // 'link', 'reply', 'admin', 'api'
  unsubscribedAt  DateTime          @default(now())
  createdAt       DateTime          @default(now())

  @@unique([email])
  @@index([email])
  @@index([leadId])
  @@index([campaignId])
}
```

### 2.15 Email Suppression Model

```prisma
model EmailSuppression {
  id              String            @id @default(cuid())
  email           String
  type            String            // 'bounce', 'complaint', 'manual', 'spam'
  reason          String?
  source          String?
  isActive        Boolean           @default(true)
  suppressedAt    DateTime          @default(now())
  expiresAt       DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@unique([email, type])
  @@index([email])
  @@index([type])
  @@index([isActive])
}
```

## 3. Model Relationships

### 3.1 Workspace Model Updates

Add the following relations to the existing [`Workspace`](../prisma/schema.prisma:31-50) model:

```prisma
model Workspace {
  // ... existing fields ...
  
  // New email marketing relations
  emailCampaigns    EmailCampaign[]
  emailTemplates    EmailTemplate[]
  emails            Email[]
  emailAutomations  EmailAutomation[]
  segmentationRules SegmentationRule[]
  emailProviders    EmailProvider[]
}
```

### 3.2 Lead Model Updates

Add the following relations to the existing [`Lead`](../prisma/schema.prisma:150-172) model:

```prisma
model Lead {
  // ... existing fields ...
  
  // New email marketing relations
  emailRecipients  EmailRecipient[]
  segmentMembers   SegmentMember[]
}
```

## 4. Database Indexes

### 4.1 Performance-Critical Indexes

The following indexes are critical for performance:

```prisma
// EmailCampaign indexes
@@index([workspaceId, status])
@@index([workspaceId, type])
@@index([scheduledAt, status])

// Email indexes
@@index([workspaceId, status, sentAt])
@@index([campaignId, status])

// EmailRecipient indexes
@@index([emailId, status])
@@index([leadId, status])
@@index([recipientEmail, status])

// SegmentMember indexes
@@index([segmentationRuleId, matchedAt])
@@index([leadId])

// EmailQueue indexes
@@index([status, scheduledFor])
@@index([priority, scheduledFor])

// EmailBounce indexes
@@index([email, type])
@@index([recipientEmail, occurredAt])
```

## 5. Data Migration Strategy

### 5.1 Migration Steps

1. **Create Migration File**
   ```bash
   npx prisma migrate dev --name add_email_marketing_models
   ```

2. **Seed Initial Data**
   - Create default email templates
   - Set up default email provider configuration
   - Create sample segmentation rules

3. **Backfill Existing Data**
   - Map existing leads to default segments
   - Create suppression lists from existing bounce data (if any)

### 5.2 Rollback Strategy

```prisma
// Migration rollback script
// 1. Disable all email campaigns
// 2. Archive email tracking data
// 3. Drop new tables
// 4. Remove new indexes
```

## 6. Data Validation Rules

### 6.1 Email Validation

```typescript
// Email format validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Domain validation
const validDomains = ['gmail.com', 'yahoo.com', 'outlook.com']

// Disposable email detection
const disposableDomains = ['tempmail.com', 'throwaway.com']
```

### 6.2 Campaign Validation

- Campaign must have at least one recipient
- Campaign must have a valid template or custom content
- Scheduled campaigns must have future scheduled date
- Campaign status transitions must follow valid workflow

### 6.3 Automation Validation

- Automation must have at least one trigger
- Automation must have at least one step
- Steps must be ordered correctly
- Delays must be non-negative

## 7. Security Considerations

### 7.1 API Key Encryption

```typescript
// Encrypt API keys before storing
import crypto from 'crypto'

const encryptApiKey = (apiKey: string, encryptionKey: string): string => {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv)
  let encrypted = cipher.update(apiKey, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}
```

### 7.2 Data Access Control

- Workspace-level isolation for all email marketing data
- Role-based access control for campaign management
- Audit logging for all email operations
- PII protection for recipient data

### 7.3 GDPR Compliance

- Right to be forgotten (delete all email data)
- Data export functionality
- Consent tracking for marketing emails
- Unsubscribe management

## 8. Performance Optimization

### 8.1 Query Optimization

```typescript
// Efficient segment calculation
const calculateSegment = async (ruleId: string) => {
  // Use batch queries
  // Leverage database indexes
  // Cache results
  // Use pagination for large segments
}
```

### 8.2 Caching Strategy

- Cache segmentation results (15-60 minutes)
- Cache template content
- Cache provider configurations
- Use Redis for distributed caching

### 8.3 Batch Operations

```typescript
// Batch email sending
const sendBatchEmails = async (emailIds: string[]) => {
  const batchSize = 100
  for (let i = 0; i < emailIds.length; i += batchSize) {
    const batch = emailIds.slice(i, i + batchSize)
    await processBatch(batch)
  }
}
```

## 9. Backup and Recovery

### 9.1 Backup Strategy

- Daily automated backups of email marketing tables
- Separate backup for tracking data (larger dataset)
- Point-in-time recovery capability
- Cross-region backup replication

### 9.2 Recovery Procedures

1. Identify affected time period
2. Restore from backup
3. Replay transaction logs
4. Validate data integrity
5. Update caches

## 10. Monitoring and Maintenance

### 10.1 Database Health Checks

- Monitor table sizes
- Track index usage
- Monitor query performance
- Check for data anomalies

### 10.2 Maintenance Tasks

- Weekly index rebuild
- Monthly statistics update
- Quarterly data archival
- Annual schema review

## 11. Next Steps

This database schema provides the foundation for:
1. Email campaign management
2. Automated email sequences
3. Customer segmentation
4. Performance tracking and analytics

The next part will detail the third-party email service provider integration architecture.

---

**Document Status**: Part 2 of 8
**Related Documents**: 
- Part 1: Customer Segmentation Strategies and Logic
- Part 3: Email Service Provider Integration
- Part 4: Campaign Management Workflow
- Part 5: Performance Tracking Metrics
- Part 6: API Endpoints and Service Layer
- Part 7: Frontend Components and UI Design
- Part 8: Implementation Roadmap
