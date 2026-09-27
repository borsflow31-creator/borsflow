-- Enable row-level security on every table in the public schema.
--
-- Supabase exposes the public schema through its REST API (PostgREST), where the
-- anon and authenticated roles held table privileges and RLS was off, so anyone
-- with the publishable key could read and write every row, including password
-- hashes and email-provider API keys.
--
-- With RLS enabled and no policies, those roles are denied every row. The app
-- itself is unaffected: Prisma connects as postgres, which owns these tables and
-- has BYPASSRLS. Verified before writing this migration:
--   select rolname, rolbypassrls from pg_roles  -> postgres = true, anon = false
--   select tableowner from pg_tables where schemaname = 'public'  -> postgres (all)
--
-- Any table added by a later migration must enable RLS in that migration too.

ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Channel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."WorkspaceMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Page" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Block" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."KanbanProject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."KanbanCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Pipeline" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LeadList" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LeadListLead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Quote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."QuoteItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."QuoteNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."InvoiceItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."InvoiceNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Email" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailRecipient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailTracking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailAutomation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AutomationTrigger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AutomationStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AutomationEnrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SegmentationRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SegmentMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailProvider" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailQueue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailBounce" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailUnsubscribe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailSuppression" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CalendarIntegration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Meeting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MeetingAttendee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MeetingNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CalendarSyncLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VideoConferenceConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PageAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TemplateCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."UniversalTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RateLimitEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
