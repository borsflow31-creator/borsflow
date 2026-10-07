-- Business type on the account, plus the sales fields a developer dashboard reports on.
--
-- 1. User.businessType decides which dashboard and navigation an account sees.
--    It is chosen once, on first sign-in, and is nullable because null is what
--    the popup keys on. Existing accounts are backfilled to AGENCY: they signed
--    up before the question existed and are already using the agency dashboard,
--    so asking them now would be a regression.
--
-- 2. Program gains launchDate and its sales/revenue targets, so the dashboard can
--    show achievement against a plan rather than raw totals.
--
-- 3. DevelopmentLot gains bedrooms, discount, the sales agent credited with the
--    deal, and the reservation/contract timestamps. The dates were previously
--    only inferable from the status, which cannot answer "how much did we sell
--    last month". discount sits beside basePrice (the list price); totalPrice
--    stays what the buyer pays, now (basePrice - discount) plus tax.
--
-- 4. LotCancellation keeps the record of a deal that fell through. The unit goes
--    back to 'available', so without this row a cancellation would be invisible
--    and the cancellation rate uncomputable.
--
-- Idempotent throughout (IF NOT EXISTS, guarded DO blocks), matching the
-- preceding developer-CRM migration: some of these tables reached databases via
-- `prisma db push`, so a migration here must be correct both on a pushed database
-- and on a fresh one.
--
-- Safe on a live database: one new table, new nullable columns, and columns with
-- non-volatile defaults (metadata-only on PG 11+). Nothing is dropped or
-- retyped. The only data written is the businessType backfill.
--
-- Rollback: ALTER TABLE "User" DROP COLUMN "businessType"; DROP TYPE
-- "BusinessType"; ALTER TABLE "Program" DROP COLUMN "launchDate",
-- "salesTargetUnits", "revenueTarget"; ALTER TABLE "DevelopmentLot" DROP COLUMN
-- "bedrooms", "discount", "salesAgentId", "reservedAt", "contractSignedAt";
-- DROP TABLE "LotCancellation".

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "public"."BusinessType" AS ENUM ('AGENCY', 'DEVELOPER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "businessType" "public"."BusinessType";

-- Backfill: every account that exists today is an agency.
UPDATE "public"."User" SET "businessType" = 'AGENCY' WHERE "businessType" IS NULL;

-- AlterTable
ALTER TABLE "public"."Program" ADD COLUMN IF NOT EXISTS "launchDate" TIMESTAMP(3);
ALTER TABLE "public"."Program" ADD COLUMN IF NOT EXISTS "salesTargetUnits" INTEGER;
ALTER TABLE "public"."Program" ADD COLUMN IF NOT EXISTS "revenueTarget" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."DevelopmentLot" ADD COLUMN IF NOT EXISTS "bedrooms" INTEGER;
ALTER TABLE "public"."DevelopmentLot" ADD COLUMN IF NOT EXISTS "discount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "public"."DevelopmentLot" ADD COLUMN IF NOT EXISTS "salesAgentId" TEXT;
ALTER TABLE "public"."DevelopmentLot" ADD COLUMN IF NOT EXISTS "reservedAt" TIMESTAMP(3);
ALTER TABLE "public"."DevelopmentLot" ADD COLUMN IF NOT EXISTS "contractSignedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DevelopmentLot_salesAgentId_idx" ON "public"."DevelopmentLot"("salesAgentId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."DevelopmentLot"
        ADD CONSTRAINT "DevelopmentLot_salesAgentId_fkey"
        FOREIGN KEY ("salesAgentId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."LotCancellation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "leadId" TEXT,
    "previousStatus" TEXT NOT NULL,
    "reason" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesAgentId" TEXT,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LotCancellation_workspaceId_cancelledAt_idx" ON "public"."LotCancellation"("workspaceId", "cancelledAt");
CREATE INDEX IF NOT EXISTS "LotCancellation_lotId_idx" ON "public"."LotCancellation"("lotId");
CREATE INDEX IF NOT EXISTS "LotCancellation_programId_idx" ON "public"."LotCancellation"("programId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "public"."LotCancellation" ADD CONSTRAINT "LotCancellation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."LotCancellation" ADD CONSTRAINT "LotCancellation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "public"."DevelopmentLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."LotCancellation" ADD CONSTRAINT "LotCancellation_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."LotCancellation" ADD CONSTRAINT "LotCancellation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "public"."LotCancellation" ADD CONSTRAINT "LotCancellation_salesAgentId_fkey" FOREIGN KEY ("salesAgentId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
