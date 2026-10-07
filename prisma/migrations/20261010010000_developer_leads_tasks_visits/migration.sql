-- Developer CRM, phase 2: lead ownership and qualification, follow-up tasks, and
-- site visits.
--
-- 1. Lead gains an owner, the buyer's brief (campaign, project and typology of
--    interest, budget range, preferred location), a score, and the two dates a
--    salesperson works from: lastContactedAt and nextFollowUpAt. score is
--    recomputed by the application on every write; nextFollowUpAt mirrors the
--    earliest open LeadTask. Both are derived data, stored so the board and
--    "my leads" can sort and filter on them without a join.
--
-- 2. LeadTask is a follow-up on a lead (call, send the price list, chase a
--    signature). It is its own table rather than a KanbanCard because the
--    questions asked of it -- "what is due for me today, what is overdue" --
--    need an indexed assignee and due date, and a card keeps its assignees as a
--    JSON string.
--
-- 3. Meeting gains programId, lotId and outcome so a meeting can be a developer
--    site visit: the project (and unit) shown, and how it went. Attendance is the
--    existing status ('completed' / 'no_show'); agency viewings are untouched.
--
-- 4. Two Activity indexes. The customer timeline reads by lead and the team
--    activity board reads by user, and neither had an index that fits.
--
-- Idempotent throughout (IF NOT EXISTS, guarded DO blocks), matching the earlier
-- developer-CRM migrations.
--
-- Safe on a live database: one new table, new nullable columns, one column with a
-- non-volatile default (metadata-only on PG 11+), and indexes on existing tables.
-- Nothing is dropped, retyped or backfilled. CREATE INDEX takes a short write
-- lock on Activity and Meeting; both are modest tables, and the indexes could be
-- created CONCURRENTLY out of band first if that ever matters (IF NOT EXISTS
-- makes this migration a no-op for them).
--
-- Rollback: ALTER TABLE "Lead" DROP COLUMN "ownerId", "campaign",
-- "interestedProgramId", "interestedTypology", "budgetMin", "budgetMax",
-- "preferredLocation", "score", "lastContactedAt", "nextFollowUpAt"; ALTER TABLE
-- "Meeting" DROP COLUMN "programId", "lotId", "outcome"; DROP TABLE "LeadTask";
-- DROP INDEX the five indexes below.

-- AlterTable
ALTER TABLE "public"."Lead" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "public"."Lead" ADD COLUMN IF NOT EXISTS "campaign" TEXT;
ALTER TABLE "public"."Lead" ADD COLUMN IF NOT EXISTS "interestedProgramId" TEXT;
ALTER TABLE "public"."Lead" ADD COLUMN IF NOT EXISTS "interestedTypology" TEXT;
ALTER TABLE "public"."Lead" ADD COLUMN IF NOT EXISTS "budgetMin" DOUBLE PRECISION;
ALTER TABLE "public"."Lead" ADD COLUMN IF NOT EXISTS "budgetMax" DOUBLE PRECISION;
ALTER TABLE "public"."Lead" ADD COLUMN IF NOT EXISTS "preferredLocation" TEXT;
ALTER TABLE "public"."Lead" ADD COLUMN IF NOT EXISTS "score" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."Lead" ADD COLUMN IF NOT EXISTS "lastContactedAt" TIMESTAMP(3);
ALTER TABLE "public"."Lead" ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Meeting" ADD COLUMN IF NOT EXISTS "programId" TEXT;
ALTER TABLE "public"."Meeting" ADD COLUMN IF NOT EXISTS "lotId" TEXT;
ALTER TABLE "public"."Meeting" ADD COLUMN IF NOT EXISTS "outcome" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."LeadTask" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "createdById" TEXT,
    "type" TEXT NOT NULL DEFAULT 'follow_up',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lead_ownerId_idx" ON "public"."Lead"("ownerId");
CREATE INDEX IF NOT EXISTS "Lead_nextFollowUpAt_idx" ON "public"."Lead"("nextFollowUpAt");
CREATE INDEX IF NOT EXISTS "Lead_interestedProgramId_idx" ON "public"."Lead"("interestedProgramId");
CREATE INDEX IF NOT EXISTS "Meeting_programId_startTime_idx" ON "public"."Meeting"("programId", "startTime");
CREATE INDEX IF NOT EXISTS "Meeting_lotId_idx" ON "public"."Meeting"("lotId");
CREATE INDEX IF NOT EXISTS "Activity_leadId_createdAt_idx" ON "public"."Activity"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "Activity_workspaceId_userId_createdAt_idx" ON "public"."Activity"("workspaceId", "userId", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadTask_workspaceId_assigneeId_completedAt_dueAt_idx" ON "public"."LeadTask"("workspaceId", "assigneeId", "completedAt", "dueAt");
CREATE INDEX IF NOT EXISTS "LeadTask_leadId_idx" ON "public"."LeadTask"("leadId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_interestedProgramId_fkey" FOREIGN KEY ("interestedProgramId") REFERENCES "public"."Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."Meeting" ADD CONSTRAINT "Meeting_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."Meeting" ADD CONSTRAINT "Meeting_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "public"."DevelopmentLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."LeadTask" ADD CONSTRAINT "LeadTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."LeadTask" ADD CONSTRAINT "LeadTask_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."LeadTask" ADD CONSTRAINT "LeadTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."LeadTask" ADD CONSTRAINT "LeadTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
