-- Baseline: the schema as it stood before 20260405170000_add_products.
--
-- The migration history was adopted part-way through the project's life: the
-- first migration adds a foreign key to "Workspace", but no migration ever
-- creates it, so `migrate deploy` against an empty database failed at the first
-- step with 42P01. This migration supplies that missing starting point, so the
-- full chain now applies to a fresh database.
--
-- Derived mechanically from prisma/schema.prisma minus everything the 30 later
-- migrations add, then verified with `prisma migrate diff --from-migrations`
-- against the datamodel returning an empty diff.

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT,
    "emailVerified" TIMESTAMP(3),
    "theme" TEXT NOT NULL DEFAULT 'system',
    "notificationsEmail" BOOLEAN NOT NULL DEFAULT true,
    "notificationsPush" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    "stripeAccountId" TEXT,
    "stripeAccountEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "coverImage" TEXT,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL DEFAULT '{}',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "blockId" TEXT,
    "pageId" TEXT,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KanbanProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "workspaceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanbanProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KanbanCard" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "tags" TEXT,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "assignees" TEXT,
    "attachments" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "checklistCompleted" INTEGER NOT NULL DEFAULT 0,
    "checklistTotal" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanbanCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "workspaceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "stages" TEXT NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "position" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "stage" TEXT NOT NULL DEFAULT 'new',
    "value" DOUBLE PRECISION,
    "source" TEXT,
    "notes" TEXT,
    "tags" TEXT,
    "pipelineId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "workspaceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadListLead" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "leadListId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadListLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "token" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "clientCompany" TEXT,
    "clientAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountType" TEXT,
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "internalNotes" TEXT,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteNote" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT,
    "quoteId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "clientCompany" TEXT,
    "clientAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountType" TEXT,
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "notes" TEXT,
    "terms" TEXT,
    "internalNotes" TEXT,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    "stripeCustomerId" TEXT,
    "stripePaymentLink" TEXT,
    "stripePaymentLinkId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeSessionId" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceNote" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'broadcast',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "workspaceId" TEXT NOT NULL,
    "templateId" TEXT,
    "subject" TEXT NOT NULL,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "replyTo" TEXT,
    "segmentationRuleId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "openedCount" INTEGER NOT NULL DEFAULT 0,
    "clickedCount" INTEGER NOT NULL DEFAULT 0,
    "bouncedCount" INTEGER NOT NULL DEFAULT 0,
    "unsubscribedCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT,
    "metadata" TEXT,
    "createdById" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'marketing',
    "workspaceId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "textContent" TEXT,
    "variables" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT,
    "createdById" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "automationStepId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "replyTo" TEXT,
    "htmlContent" TEXT NOT NULL,
    "textContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerMessageId" TEXT,
    "providerType" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailRecipient" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "leadId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "bounceReason" TEXT,
    "unsubscribedAt" TIMESTAMP(3),
    "unsubscribeReason" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailTracking" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "firstOpenAt" TIMESTAMP(3),
    "lastOpenAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "firstClickAt" TIMESTAMP(3),
    "lastClickAt" TIMESTAMP(3),
    "links" TEXT,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTracking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailAutomation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'drip',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "workspaceId" TEXT NOT NULL,
    "entryCriteria" TEXT,
    "exitCriteria" TEXT,
    "totalEnrolled" INTEGER NOT NULL DEFAULT 0,
    "activeEnrolled" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT,
    "metadata" TEXT,
    "createdById" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAutomation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationTrigger" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationTrigger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationStep" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "templateId" TEXT,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "sendCondition" TEXT,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalOpened" INTEGER NOT NULL DEFAULT 0,
    "totalClicked" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SegmentationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workspaceId" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "logicOperator" TEXT NOT NULL DEFAULT 'AND',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "estimatedSize" INTEGER,
    "lastCalculated" TIMESTAMP(3),
    "tags" TEXT,
    "createdById" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SegmentationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SegmentMember" (
    "id" TEXT NOT NULL,
    "segmentationRuleId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION,
    "metadata" TEXT,

    CONSTRAINT "SegmentMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailProvider" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "apiKey" TEXT,
    "apiKeyEncrypted" TEXT,
    "region" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "replyTo" TEXT,
    "config" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "dailyLimit" INTEGER,
    "monthlyLimit" INTEGER,
    "lastUsedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailQueue" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "providerId" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailQueue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailBounce" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientId" TEXT,
    "type" TEXT NOT NULL,
    "subType" TEXT,
    "reason" TEXT,
    "providerType" TEXT,
    "providerMessage" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailBounce_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailUnsubscribe" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "leadId" TEXT,
    "campaignId" TEXT,
    "reason" TEXT,
    "source" TEXT NOT NULL,
    "unsubscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailUnsubscribe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailSuppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "suppressedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarIntegration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "providerUserId" TEXT,
    "providerEmail" TEXT,
    "calendarId" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncDirection" TEXT NOT NULL DEFAULT 'bidirectional',
    "lastSyncAt" TIMESTAMP(3),
    "syncFrequency" TEXT NOT NULL DEFAULT 'hourly',
    "syncStatus" TEXT NOT NULL DEFAULT 'active',
    "lastSyncError" TEXT,
    "lastSyncErrorAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "meetingType" TEXT NOT NULL,
    "location" TEXT,
    "platform" TEXT NOT NULL,
    "platformMeetingId" TEXT,
    "platformEventId" TEXT,
    "calendarIntegrationId" TEXT,
    "meetingUrl" TEXT,
    "hostUrl" TEXT,
    "password" TEXT,
    "conferenceProvider" TEXT,
    "conferenceId" TEXT,
    "conferencePhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "leadId" TEXT,
    "userId" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringPattern" TEXT,
    "recurringEventId" TEXT,
    "recurringInstanceId" TEXT,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderTimes" TEXT,
    "externalSyncId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "syncStatus" TEXT NOT NULL DEFAULT 'synced',
    "syncError" TEXT,
    "createdById" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingAttendee" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "type" TEXT NOT NULL DEFAULT 'external',
    "userId" TEXT,
    "leadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "responseAt" TIMESTAMP(3),
    "externalAttendeeId" TEXT,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "joinUrl" TEXT,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingNote" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "noteType" TEXT NOT NULL DEFAULT 'general',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarSyncLog" (
    "id" TEXT NOT NULL,
    "calendarIntegrationId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "eventsProcessed" INTEGER NOT NULL DEFAULT 0,
    "eventsCreated" INTEGER NOT NULL DEFAULT 0,
    "eventsUpdated" INTEGER NOT NULL DEFAULT 0,
    "eventsDeleted" INTEGER NOT NULL DEFAULT 0,
    "eventsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorDetails" TEXT,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "syncStartDate" TIMESTAMP(3),
    "syncEndDate" TIMESTAMP(3),

    CONSTRAINT "CalendarSyncLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoConferenceConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "providerUserId" TEXT,
    "providerEmail" TEXT,
    "defaultSettings" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoConferenceConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "userId" TEXT NOT NULL,
    "meetingId" TEXT,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PageAccess" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TemplateCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UniversalTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "categoryId" TEXT,
    "workspaceId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL DEFAULT '{}',
    "previewImage" TEXT,
    "icon" TEXT,
    "tags" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UniversalTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

CREATE INDEX "Page_createdById_idx" ON "Page"("createdById");

CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

CREATE INDEX "Block_createdById_idx" ON "Block"("createdById");

CREATE INDEX "Comment_blockId_idx" ON "Comment"("blockId");

CREATE INDEX "Comment_pageId_idx" ON "Comment"("pageId");

CREATE INDEX "Comment_workspaceId_idx" ON "Comment"("workspaceId");

CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");

CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

CREATE INDEX "KanbanProject_createdById_idx" ON "KanbanProject"("createdById");

CREATE INDEX "KanbanCard_createdById_idx" ON "KanbanCard"("createdById");

CREATE INDEX "Pipeline_createdById_idx" ON "Pipeline"("createdById");

CREATE INDEX "Lead_email_idx" ON "Lead"("email");

CREATE INDEX "Lead_status_idx" ON "Lead"("status");

CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");

CREATE INDEX "Lead_createdById_idx" ON "Lead"("createdById");

CREATE INDEX "LeadList_createdById_idx" ON "LeadList"("createdById");

CREATE UNIQUE INDEX "LeadListLead_leadId_leadListId_key" ON "LeadListLead"("leadId", "leadListId");

CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

CREATE INDEX "Invitation_token_idx" ON "Invitation"("token");

CREATE INDEX "Invitation_status_idx" ON "Invitation"("status");

CREATE UNIQUE INDEX "Invitation_workspaceId_email_key" ON "Invitation"("workspaceId", "email");

CREATE INDEX "Quote_workspaceId_idx" ON "Quote"("workspaceId");

CREATE INDEX "Quote_leadId_idx" ON "Quote"("leadId");

CREATE INDEX "Quote_status_idx" ON "Quote"("status");

CREATE INDEX "Quote_quoteNumber_idx" ON "Quote"("quoteNumber");

CREATE INDEX "Quote_createdById_idx" ON "Quote"("createdById");

CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

CREATE INDEX "QuoteNote_quoteId_idx" ON "QuoteNote"("quoteId");

CREATE INDEX "QuoteNote_createdById_idx" ON "QuoteNote"("createdById");

CREATE INDEX "Invoice_workspaceId_idx" ON "Invoice"("workspaceId");

CREATE INDEX "Invoice_leadId_idx" ON "Invoice"("leadId");

CREATE INDEX "Invoice_quoteId_idx" ON "Invoice"("quoteId");

CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

CREATE INDEX "Invoice_createdById_idx" ON "Invoice"("createdById");

CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

CREATE INDEX "InvoiceNote_invoiceId_idx" ON "InvoiceNote"("invoiceId");

CREATE INDEX "InvoiceNote_createdById_idx" ON "InvoiceNote"("createdById");

CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");

CREATE INDEX "Payment_createdById_idx" ON "Payment"("createdById");

CREATE INDEX "EmailCampaign_workspaceId_idx" ON "EmailCampaign"("workspaceId");

CREATE INDEX "EmailCampaign_status_idx" ON "EmailCampaign"("status");

CREATE INDEX "EmailCampaign_scheduledAt_idx" ON "EmailCampaign"("scheduledAt");

CREATE INDEX "EmailCampaign_type_idx" ON "EmailCampaign"("type");

CREATE INDEX "EmailCampaign_createdById_idx" ON "EmailCampaign"("createdById");

CREATE INDEX "EmailTemplate_workspaceId_idx" ON "EmailTemplate"("workspaceId");

CREATE INDEX "EmailTemplate_type_idx" ON "EmailTemplate"("type");

CREATE INDEX "EmailTemplate_isActive_idx" ON "EmailTemplate"("isActive");

CREATE INDEX "EmailTemplate_createdById_idx" ON "EmailTemplate"("createdById");

CREATE INDEX "Email_workspaceId_idx" ON "Email"("workspaceId");

CREATE INDEX "Email_campaignId_idx" ON "Email"("campaignId");

CREATE INDEX "Email_status_idx" ON "Email"("status");

CREATE INDEX "Email_sentAt_idx" ON "Email"("sentAt");

CREATE INDEX "EmailRecipient_emailId_idx" ON "EmailRecipient"("emailId");

CREATE INDEX "EmailRecipient_leadId_idx" ON "EmailRecipient"("leadId");

CREATE INDEX "EmailRecipient_status_idx" ON "EmailRecipient"("status");

CREATE INDEX "EmailRecipient_recipientEmail_idx" ON "EmailRecipient"("recipientEmail");

CREATE UNIQUE INDEX "EmailTracking_emailId_key" ON "EmailTracking"("emailId");

CREATE UNIQUE INDEX "EmailTracking_trackingId_key" ON "EmailTracking"("trackingId");

CREATE INDEX "EmailTracking_trackingId_idx" ON "EmailTracking"("trackingId");

CREATE INDEX "EmailAutomation_workspaceId_idx" ON "EmailAutomation"("workspaceId");

CREATE INDEX "EmailAutomation_status_idx" ON "EmailAutomation"("status");

CREATE INDEX "EmailAutomation_type_idx" ON "EmailAutomation"("type");

CREATE INDEX "EmailAutomation_createdById_idx" ON "EmailAutomation"("createdById");

CREATE INDEX "AutomationTrigger_automationId_idx" ON "AutomationTrigger"("automationId");

CREATE INDEX "AutomationTrigger_type_idx" ON "AutomationTrigger"("type");

CREATE INDEX "AutomationStep_automationId_idx" ON "AutomationStep"("automationId");

CREATE UNIQUE INDEX "AutomationStep_automationId_order_key" ON "AutomationStep"("automationId", "order");

CREATE INDEX "SegmentationRule_workspaceId_idx" ON "SegmentationRule"("workspaceId");

CREATE INDEX "SegmentationRule_isActive_idx" ON "SegmentationRule"("isActive");

CREATE INDEX "SegmentationRule_createdById_idx" ON "SegmentationRule"("createdById");

CREATE INDEX "SegmentMember_segmentationRuleId_idx" ON "SegmentMember"("segmentationRuleId");

CREATE INDEX "SegmentMember_leadId_idx" ON "SegmentMember"("leadId");

CREATE INDEX "EmailProvider_workspaceId_idx" ON "EmailProvider"("workspaceId");

CREATE INDEX "EmailProvider_type_idx" ON "EmailProvider"("type");

CREATE INDEX "EmailProvider_isActive_idx" ON "EmailProvider"("isActive");

CREATE INDEX "EmailProvider_createdById_idx" ON "EmailProvider"("createdById");

CREATE UNIQUE INDEX "EmailQueue_emailId_key" ON "EmailQueue"("emailId");

CREATE INDEX "EmailQueue_scheduledFor_idx" ON "EmailQueue"("scheduledFor");

CREATE INDEX "EmailQueue_status_idx" ON "EmailQueue"("status");

CREATE INDEX "EmailQueue_priority_idx" ON "EmailQueue"("priority");

CREATE INDEX "EmailBounce_email_idx" ON "EmailBounce"("email");

CREATE INDEX "EmailBounce_recipientEmail_idx" ON "EmailBounce"("recipientEmail");

CREATE INDEX "EmailBounce_type_idx" ON "EmailBounce"("type");

CREATE INDEX "EmailBounce_occurredAt_idx" ON "EmailBounce"("occurredAt");

CREATE INDEX "EmailUnsubscribe_email_idx" ON "EmailUnsubscribe"("email");

CREATE INDEX "EmailUnsubscribe_leadId_idx" ON "EmailUnsubscribe"("leadId");

CREATE INDEX "EmailUnsubscribe_campaignId_idx" ON "EmailUnsubscribe"("campaignId");

CREATE INDEX "EmailSuppression_email_idx" ON "EmailSuppression"("email");

CREATE INDEX "EmailSuppression_type_idx" ON "EmailSuppression"("type");

CREATE INDEX "EmailSuppression_isActive_idx" ON "EmailSuppression"("isActive");

CREATE INDEX "CalendarIntegration_workspaceId_idx" ON "CalendarIntegration"("workspaceId");

CREATE INDEX "CalendarIntegration_type_idx" ON "CalendarIntegration"("type");

CREATE INDEX "CalendarIntegration_isActive_idx" ON "CalendarIntegration"("isActive");

CREATE INDEX "CalendarIntegration_syncEnabled_idx" ON "CalendarIntegration"("syncEnabled");

CREATE INDEX "CalendarIntegration_createdById_idx" ON "CalendarIntegration"("createdById");

CREATE UNIQUE INDEX "CalendarIntegration_workspaceId_type_providerUserId_key" ON "CalendarIntegration"("workspaceId", "type", "providerUserId");

CREATE INDEX "Meeting_workspaceId_idx" ON "Meeting"("workspaceId");

CREATE INDEX "Meeting_leadId_idx" ON "Meeting"("leadId");

CREATE INDEX "Meeting_userId_idx" ON "Meeting"("userId");

CREATE INDEX "Meeting_startTime_idx" ON "Meeting"("startTime");

CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

CREATE INDEX "Meeting_platform_idx" ON "Meeting"("platform");

CREATE INDEX "Meeting_calendarIntegrationId_idx" ON "Meeting"("calendarIntegrationId");

CREATE INDEX "Meeting_isExternal_idx" ON "Meeting"("isExternal");

CREATE INDEX "Meeting_createdById_idx" ON "Meeting"("createdById");

CREATE UNIQUE INDEX "Meeting_platformEventId_platform_key" ON "Meeting"("platformEventId", "platform");

CREATE INDEX "MeetingAttendee_meetingId_idx" ON "MeetingAttendee"("meetingId");

CREATE INDEX "MeetingAttendee_email_idx" ON "MeetingAttendee"("email");

CREATE INDEX "MeetingAttendee_status_idx" ON "MeetingAttendee"("status");

CREATE UNIQUE INDEX "MeetingAttendee_meetingId_email_key" ON "MeetingAttendee"("meetingId", "email");

CREATE INDEX "MeetingNote_meetingId_idx" ON "MeetingNote"("meetingId");

CREATE INDEX "MeetingNote_createdById_idx" ON "MeetingNote"("createdById");

CREATE INDEX "CalendarSyncLog_calendarIntegrationId_idx" ON "CalendarSyncLog"("calendarIntegrationId");

CREATE INDEX "CalendarSyncLog_status_idx" ON "CalendarSyncLog"("status");

CREATE INDEX "CalendarSyncLog_startedAt_idx" ON "CalendarSyncLog"("startedAt");

CREATE INDEX "VideoConferenceConfig_workspaceId_idx" ON "VideoConferenceConfig"("workspaceId");

CREATE INDEX "VideoConferenceConfig_platform_idx" ON "VideoConferenceConfig"("platform");

CREATE INDEX "VideoConferenceConfig_isActive_idx" ON "VideoConferenceConfig"("isActive");

CREATE INDEX "VideoConferenceConfig_createdById_idx" ON "VideoConferenceConfig"("createdById");

CREATE UNIQUE INDEX "VideoConferenceConfig_workspaceId_platform_key" ON "VideoConferenceConfig"("workspaceId", "platform");

CREATE INDEX "Activity_workspaceId_idx" ON "Activity"("workspaceId");

CREATE INDEX "Activity_userId_idx" ON "Activity"("userId");

CREATE INDEX "Activity_meetingId_idx" ON "Activity"("meetingId");

CREATE INDEX "Activity_entityType_entityId_idx" ON "Activity"("entityType", "entityId");

CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

CREATE INDEX "PageAccess_userId_idx" ON "PageAccess"("userId");

CREATE INDEX "PageAccess_pageId_idx" ON "PageAccess"("pageId");

CREATE UNIQUE INDEX "PageAccess_pageId_userId_key" ON "PageAccess"("pageId", "userId");

CREATE UNIQUE INDEX "TemplateCategory_slug_key" ON "TemplateCategory"("slug");

CREATE INDEX "UniversalTemplate_type_idx" ON "UniversalTemplate"("type");

CREATE INDEX "UniversalTemplate_workspaceId_idx" ON "UniversalTemplate"("workspaceId");

CREATE INDEX "UniversalTemplate_isSystem_idx" ON "UniversalTemplate"("isSystem");

CREATE INDEX "UniversalTemplate_categoryId_idx" ON "UniversalTemplate"("categoryId");

ALTER TABLE "Channel" ADD CONSTRAINT "Channel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Channel" ADD CONSTRAINT "Channel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Page" ADD CONSTRAINT "Page_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Page" ADD CONSTRAINT "Page_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Page" ADD CONSTRAINT "Page_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Block" ADD CONSTRAINT "Block_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Block" ADD CONSTRAINT "Block_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KanbanProject" ADD CONSTRAINT "KanbanProject_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KanbanProject" ADD CONSTRAINT "KanbanProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KanbanCard" ADD CONSTRAINT "KanbanCard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KanbanCard" ADD CONSTRAINT "KanbanCard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "KanbanProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KanbanCard" ADD CONSTRAINT "KanbanCard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadList" ADD CONSTRAINT "LeadList_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadList" ADD CONSTRAINT "LeadList_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadListLead" ADD CONSTRAINT "LeadListLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadListLead" ADD CONSTRAINT "LeadListLead_leadListId_fkey" FOREIGN KEY ("leadListId") REFERENCES "LeadList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Quote" ADD CONSTRAINT "Quote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Quote" ADD CONSTRAINT "Quote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuoteNote" ADD CONSTRAINT "QuoteNote_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuoteNote" ADD CONSTRAINT "QuoteNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceNote" ADD CONSTRAINT "InvoiceNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceNote" ADD CONSTRAINT "InvoiceNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_segmentationRuleId_fkey" FOREIGN KEY ("segmentationRuleId") REFERENCES "SegmentationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Email" ADD CONSTRAINT "Email_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Email" ADD CONSTRAINT "Email_automationStepId_fkey" FOREIGN KEY ("automationStepId") REFERENCES "AutomationStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Email" ADD CONSTRAINT "Email_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailRecipient" ADD CONSTRAINT "EmailRecipient_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailRecipient" ADD CONSTRAINT "EmailRecipient_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailTracking" ADD CONSTRAINT "EmailTracking_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailAutomation" ADD CONSTRAINT "EmailAutomation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailAutomation" ADD CONSTRAINT "EmailAutomation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AutomationTrigger" ADD CONSTRAINT "AutomationTrigger_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "EmailAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationStep" ADD CONSTRAINT "AutomationStep_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "EmailAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationStep" ADD CONSTRAINT "AutomationStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SegmentationRule" ADD CONSTRAINT "SegmentationRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SegmentationRule" ADD CONSTRAINT "SegmentationRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SegmentMember" ADD CONSTRAINT "SegmentMember_segmentationRuleId_fkey" FOREIGN KEY ("segmentationRuleId") REFERENCES "SegmentationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SegmentMember" ADD CONSTRAINT "SegmentMember_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailProvider" ADD CONSTRAINT "EmailProvider_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailProvider" ADD CONSTRAINT "EmailProvider_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailQueue" ADD CONSTRAINT "EmailQueue_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarIntegration" ADD CONSTRAINT "CalendarIntegration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarIntegration" ADD CONSTRAINT "CalendarIntegration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_calendarIntegrationId_fkey" FOREIGN KEY ("calendarIntegrationId") REFERENCES "CalendarIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeetingNote" ADD CONSTRAINT "MeetingNote_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingNote" ADD CONSTRAINT "MeetingNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CalendarSyncLog" ADD CONSTRAINT "CalendarSyncLog_calendarIntegrationId_fkey" FOREIGN KEY ("calendarIntegrationId") REFERENCES "CalendarIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoConferenceConfig" ADD CONSTRAINT "VideoConferenceConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoConferenceConfig" ADD CONSTRAINT "VideoConferenceConfig_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Activity" ADD CONSTRAINT "Activity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Activity" ADD CONSTRAINT "Activity_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PageAccess" ADD CONSTRAINT "PageAccess_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PageAccess" ADD CONSTRAINT "PageAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UniversalTemplate" ADD CONSTRAINT "UniversalTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TemplateCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UniversalTemplate" ADD CONSTRAINT "UniversalTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UniversalTemplate" ADD CONSTRAINT "UniversalTemplate_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "UniversalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UniversalTemplate" ADD CONSTRAINT "UniversalTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");

CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

CREATE UNIQUE INDEX "EmailUnsubscribe_email_key" ON "EmailUnsubscribe"("email");

CREATE UNIQUE INDEX "EmailSuppression_email_type_key" ON "EmailSuppression"("email", "type");

CREATE UNIQUE INDEX "SegmentMember_segmentationRuleId_leadId_key" ON "SegmentMember"("segmentationRuleId", "leadId");
