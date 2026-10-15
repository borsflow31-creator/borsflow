-- Payments become a ledger: a status instead of deletion, refunds as their own
-- rows, a receipt number, and an idempotency key. Every column is additive and
-- defaults so existing rows keep their meaning: confirmed payments.
ALTER TABLE "public"."Payment" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE "public"."Payment" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'payment';
ALTER TABLE "public"."Payment" ADD COLUMN IF NOT EXISTS "refundOfId" TEXT;
ALTER TABLE "public"."Payment" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "public"."Payment" ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE "public"."Payment" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;
ALTER TABLE "public"."Payment" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "public"."Payment" ADD COLUMN IF NOT EXISTS "confirmedById" TEXT;
ALTER TABLE "public"."Payment" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "public"."Payment" ADD COLUMN IF NOT EXISTS "reversedById" TEXT;
ALTER TABLE "public"."Payment" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;

-- Existing rows belong to their invoice's workspace and were confirmed when made.
UPDATE "public"."Payment" p
   SET "workspaceId" = i."workspaceId"
  FROM "public"."Invoice" i
 WHERE p."invoiceId" = i."id" AND p."workspaceId" IS NULL;
UPDATE "public"."Payment" SET "confirmedAt" = "createdAt" WHERE "status" = 'confirmed' AND "confirmedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_clientRequestId_key" ON "public"."Payment"("clientRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_workspaceId_receiptNumber_key" ON "public"."Payment"("workspaceId", "receiptNumber");
CREATE INDEX IF NOT EXISTS "Payment_workspaceId_paymentDate_idx" ON "public"."Payment"("workspaceId", "paymentDate");
CREATE INDEX IF NOT EXISTS "Payment_workspaceId_status_idx" ON "public"."Payment"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "Payment_refundOfId_idx" ON "public"."Payment"("refundOfId");

DO $$ BEGIN
  ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_refundOfId_fkey" FOREIGN KEY ("refundOfId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "public"."DocumentCounter" (
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("workspaceId", "kind", "year")
);

-- No policies: denies Supabase's anon and authenticated roles everything, while
-- Prisma, connecting as postgres, bypasses RLS. Same as every other table.
ALTER TABLE "public"."DocumentCounter" ENABLE ROW LEVEL SECURITY;
