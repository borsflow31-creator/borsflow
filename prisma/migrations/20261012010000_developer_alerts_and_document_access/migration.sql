-- Developer CRM, phase 4: automatic alerts and document access.
--
-- 1. AlertRule holds a workspace's setting for one kind of alert (on or off, and
--    its thresholds). A row exists only once someone saves it; until then the
--    defaults in the application apply, so no workspace needs seeding.
--
-- 2. AlertFiring records that an alert has been raised for a subject. It is
--    inserted before anyone is notified, and its unique key is what stops two
--    overlapping runs of the job from both alerting. The key also carries the
--    period for alerts that may recur (a project and a week).
--
-- 3. LeadFile and SalesDocument gain "visibility": 'team' (every member) or
--    'managers' (owner and admins). Existing rows default to 'team', so nothing
--    that is visible today disappears.
--
-- 4. Two Lead indexes. The per-minute "no response" check looks at leads created in
--    the last day with no contact logged, and neither createdAt nor
--    lastContactedAt had an index.
--
-- Idempotent throughout (IF NOT EXISTS, guarded DO blocks), matching the earlier
-- developer-CRM migrations.
--
-- Safe on a live database: new tables, columns with non-volatile defaults
-- (metadata-only on PG 11+), and two indexes on Lead. CREATE INDEX takes a short
-- write lock on Lead; if that table is large, create the two indexes CONCURRENTLY
-- out of band first and IF NOT EXISTS makes this a no-op for them.
--
-- Rollback: ALTER TABLE "LeadFile" DROP COLUMN "visibility"; ALTER TABLE
-- "SalesDocument" DROP COLUMN "visibility"; DROP INDEX "Lead_createdAt_idx",
-- "Lead_lastContactedAt_idx"; DROP TABLE "AlertRule", "AlertFiring".

-- AlterTable
ALTER TABLE "public"."LeadFile" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'team';
ALTER TABLE "public"."SalesDocument" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'team';

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."AlertRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "params" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."AlertFiring" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertFiring_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AlertRule_workspaceId_type_key" ON "public"."AlertRule"("workspaceId", "type");
CREATE UNIQUE INDEX IF NOT EXISTS "AlertFiring_workspaceId_ruleType_subjectKey_key" ON "public"."AlertFiring"("workspaceId", "ruleType", "subjectKey");
CREATE INDEX IF NOT EXISTS "AlertFiring_workspaceId_ruleType_firedAt_idx" ON "public"."AlertFiring"("workspaceId", "ruleType", "firedAt");
CREATE INDEX IF NOT EXISTS "Lead_createdAt_idx" ON "public"."Lead"("createdAt");
CREATE INDEX IF NOT EXISTS "Lead_lastContactedAt_idx" ON "public"."Lead"("lastContactedAt");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."AlertRule" ADD CONSTRAINT "AlertRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."AlertFiring" ADD CONSTRAINT "AlertFiring_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
