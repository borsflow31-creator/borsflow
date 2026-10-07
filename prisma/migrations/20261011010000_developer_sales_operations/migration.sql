-- Developer CRM, phase 3: reservation and contract documents, payment reminders,
-- unit commissions and marketing spend.
--
-- 1. DevelopmentLot gains the reservation deposit (reservationFee and when it
--    arrived) and a counter of wrong portal-code guesses. The counter is what lets
--    a code be burned after five tries instead of being guessable for ten minutes.
--
-- 2. SalesTemplate holds the wording of a reservation form, a contract or a payment
--    reminder, one per workspace and kind, optionally overridden for one project.
--    A workspace-wide template has programId NULL, and Postgres treats NULLs as
--    distinct in a unique index, so "one default per kind" is enforced by the
--    application (it updates the existing row) rather than by this constraint.
--
-- 3. SalesDocument is a reservation form or contract issued for one sale. Its text
--    and values are frozen at issue and its PDF at send, and the acceptance record
--    (who, when, from where, which file hash) lives on the same row, so the proof of
--    what a buyer agreed to is one row and one stored file.
--
-- 4. CallReminder records each reminder sent for each call for funds at each step.
--    The unique (callId, step) pair is what makes the hourly job safe to run twice.
--
-- 5. Commission can now belong to a unit instead of a listing: propertyId becomes
--    nullable, and lotId, programId and leadId are added. Program gains the rate
--    the commission is taken from. Existing rows all have a propertyId and are
--    untouched.
--
-- 6. LotCancellation records how much of the deposit and payments was refunded,
--    and MarketingSpend holds what was spent on a channel in a month, so a source
--    can be reported as a cost and a return, not just a count.
--
-- Idempotent throughout (IF NOT EXISTS, guarded DO blocks), matching the earlier
-- developer-CRM migrations.
--
-- Safe on a live database: new tables, new nullable columns, columns with
-- non-volatile defaults (metadata-only on PG 11+), and DROP NOT NULL, which is a
-- catalog change with no table rewrite. Nothing is dropped, retyped or backfilled.
--
-- Rollback: ALTER TABLE "Commission" DROP COLUMN "lotId", "programId", "leadId" (and
-- SET NOT NULL on "propertyId" only if no unit commission has been written);
-- ALTER TABLE "DevelopmentLot" DROP COLUMN "reservationFee", "reservationFeePaidAt",
-- "portalOtpAttempts"; ALTER TABLE "Program" DROP COLUMN "commissionPercent";
-- ALTER TABLE "LotCancellation" DROP COLUMN "refundAmount"; DROP TABLE
-- "SalesTemplate", "SalesDocument", "CallReminder", "MarketingSpend".

-- AlterTable
ALTER TABLE "public"."DevelopmentLot" ADD COLUMN IF NOT EXISTS "reservationFee" DOUBLE PRECISION;
ALTER TABLE "public"."DevelopmentLot" ADD COLUMN IF NOT EXISTS "reservationFeePaidAt" TIMESTAMP(3);
ALTER TABLE "public"."DevelopmentLot" ADD COLUMN IF NOT EXISTS "portalOtpAttempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."LotCancellation" ADD COLUMN IF NOT EXISTS "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."Program" ADD COLUMN IF NOT EXISTS "commissionPercent" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."Commission" ALTER COLUMN "propertyId" DROP NOT NULL;
ALTER TABLE "public"."Commission" ADD COLUMN IF NOT EXISTS "lotId" TEXT;
ALTER TABLE "public"."Commission" ADD COLUMN IF NOT EXISTS "programId" TEXT;
ALTER TABLE "public"."Commission" ADD COLUMN IF NOT EXISTS "leadId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."SalesTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "programId" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."SalesDocument" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "leadId" TEXT,
    "kind" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "pdfPath" TEXT,
    "contentHash" TEXT,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "acceptedName" TEXT,
    "acceptedIp" TEXT,
    "acceptedUserAgent" TEXT,
    "acceptedHash" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."CallReminder" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."MarketingSpend" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "campaign" TEXT NOT NULL DEFAULT '',
    "month" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingSpend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SalesTemplate_workspaceId_programId_kind_key" ON "public"."SalesTemplate"("workspaceId", "programId", "kind");
CREATE INDEX IF NOT EXISTS "SalesTemplate_workspaceId_kind_idx" ON "public"."SalesTemplate"("workspaceId", "kind");
CREATE UNIQUE INDEX IF NOT EXISTS "SalesDocument_workspaceId_number_key" ON "public"."SalesDocument"("workspaceId", "number");
CREATE INDEX IF NOT EXISTS "SalesDocument_lotId_kind_status_idx" ON "public"."SalesDocument"("lotId", "kind", "status");
CREATE INDEX IF NOT EXISTS "SalesDocument_leadId_idx" ON "public"."SalesDocument"("leadId");
CREATE UNIQUE INDEX IF NOT EXISTS "CallReminder_callId_step_key" ON "public"."CallReminder"("callId", "step");
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingSpend_workspaceId_source_campaign_month_key" ON "public"."MarketingSpend"("workspaceId", "source", "campaign", "month");
CREATE INDEX IF NOT EXISTS "MarketingSpend_workspaceId_month_idx" ON "public"."MarketingSpend"("workspaceId", "month");
CREATE INDEX IF NOT EXISTS "Commission_lotId_idx" ON "public"."Commission"("lotId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."Commission" ADD CONSTRAINT "Commission_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "public"."DevelopmentLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."Commission" ADD CONSTRAINT "Commission_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."Commission" ADD CONSTRAINT "Commission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."SalesTemplate" ADD CONSTRAINT "SalesTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."SalesTemplate" ADD CONSTRAINT "SalesTemplate_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."SalesDocument" ADD CONSTRAINT "SalesDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."SalesDocument" ADD CONSTRAINT "SalesDocument_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "public"."DevelopmentLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."SalesDocument" ADD CONSTRAINT "SalesDocument_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."CallReminder" ADD CONSTRAINT "CallReminder_callId_fkey" FOREIGN KEY ("callId") REFERENCES "public"."CallForFunds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."MarketingSpend" ADD CONSTRAINT "MarketingSpend_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
