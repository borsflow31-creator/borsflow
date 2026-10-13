-- A buyer's interest in specific units of a programme, and an idempotency key
-- so a retried "create lead" returns the lead it already made. Both additive.
ALTER TABLE "public"."Lead" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_clientRequestId_key" ON "public"."Lead"("clientRequestId");

CREATE TABLE IF NOT EXISTS "public"."LeadLotInterest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadLotInterest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeadLotInterest_leadId_lotId_key" ON "public"."LeadLotInterest"("leadId", "lotId");
CREATE INDEX IF NOT EXISTS "LeadLotInterest_lotId_idx" ON "public"."LeadLotInterest"("lotId");
CREATE INDEX IF NOT EXISTS "LeadLotInterest_workspaceId_idx" ON "public"."LeadLotInterest"("workspaceId");

DO $$ BEGIN
  ALTER TABLE "public"."LeadLotInterest" ADD CONSTRAINT "LeadLotInterest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."LeadLotInterest" ADD CONSTRAINT "LeadLotInterest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."LeadLotInterest" ADD CONSTRAINT "LeadLotInterest_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "public"."DevelopmentLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."LeadLotInterest" ADD CONSTRAINT "LeadLotInterest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
