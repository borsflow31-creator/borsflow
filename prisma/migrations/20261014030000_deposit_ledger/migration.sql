-- 1. One call for funds per unit per milestone. Generation used to rely on a
--    read before the insert, which two simultaneous certifications could both
--    pass. The index is only created when the data already obeys it, so this
--    migration cannot fail on an old duplicate; it says so instead.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "public"."CallForFunds" GROUP BY "lotId", "milestoneId" HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'CallForFunds has duplicate (lotId, milestoneId) pairs; unique index not created. Resolve them and re-run.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "CallForFunds_lotId_milestoneId_key" ON "public"."CallForFunds"("lotId", "milestoneId");
  END IF;
END $$;

-- 2. The reservation deposit is billed on its own invoice and paid through the
--    ledger, like a call for funds. reservationFee / reservationFeePaidAt stay as
--    a cache of it.
ALTER TABLE "public"."DevelopmentLot" ADD COLUMN IF NOT EXISTS "depositInvoiceId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "DevelopmentLot_depositInvoiceId_key" ON "public"."DevelopmentLot"("depositInvoiceId");
DO $$ BEGIN
  ALTER TABLE "public"."DevelopmentLot" ADD CONSTRAINT "DevelopmentLot_depositInvoiceId_fkey" FOREIGN KEY ("depositInvoiceId") REFERENCES "public"."Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The invoice also remembers which unit's deposit it bills, so its payments stay
-- findable after a cancellation, when the unit no longer points at it.
ALTER TABLE "public"."Invoice" ADD COLUMN IF NOT EXISTS "depositForLotId" TEXT;
CREATE INDEX IF NOT EXISTS "Invoice_depositForLotId_idx" ON "public"."Invoice"("depositForLotId");
DO $$ BEGIN
  ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_depositForLotId_fkey" FOREIGN KEY ("depositForLotId") REFERENCES "public"."DevelopmentLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Backfill. Every sold unit with a deposit gets its deposit invoice, and a
--    deposit already marked received gets a confirmed payment with a receipt
--    number. Ids are derived from the unit, so running this twice changes nothing.
INSERT INTO "public"."Invoice" (
  "id", "invoiceNumber", "workspaceId", "leadId", "clientName", "clientEmail", "clientPhone",
  "status", "issueDate", "currency", "subtotal", "total", "amountDue", "notes", "depositForLotId", "createdAt", "updatedAt"
)
SELECT
  'dep_' || md5(l."id"),
  'DEP-' || p."reference" || '-' || l."lotNumber",
  l."workspaceId",
  b."id",
  COALESCE(NULLIF(TRIM(COALESCE(b."firstName", '') || ' ' || COALESCE(b."lastName", '')), ''), 'Acquéreur'),
  b."email",
  b."phone",
  'sent',
  COALESCE(l."reservedAt", l."createdAt"),
  w."currency",
  l."reservationFee",
  l."reservationFee",
  l."reservationFee",
  'Dépôt de garantie pour le lot ' || l."lotNumber" || ' (' || p."name" || ').',
  l."id",
  NOW(),
  NOW()
FROM "public"."DevelopmentLot" l
JOIN "public"."Program" p ON p."id" = l."programId"
JOIN "public"."Workspace" w ON w."id" = l."workspaceId"
JOIN "public"."Lead" b ON b."id" = l."buyerLeadId"
WHERE l."reservationFee" > 0 AND l."depositInvoiceId" IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "public"."InvoiceItem" ("id", "invoiceId", "description", "quantity", "unitPrice", "total", "createdAt", "updatedAt")
SELECT 'depi_' || md5(l."id"), i."id", 'Dépôt de garantie - Lot ' || l."lotNumber", 1, l."reservationFee", l."reservationFee", NOW(), NOW()
FROM "public"."DevelopmentLot" l
JOIN "public"."Invoice" i ON i."id" = 'dep_' || md5(l."id")
WHERE l."reservationFee" > 0 AND l."depositInvoiceId" IS NULL
ON CONFLICT DO NOTHING;

UPDATE "public"."DevelopmentLot" l
   SET "depositInvoiceId" = 'dep_' || md5(l."id")
 WHERE l."reservationFee" > 0
   AND l."depositInvoiceId" IS NULL
   AND EXISTS (SELECT 1 FROM "public"."Invoice" i WHERE i."id" = 'dep_' || md5(l."id"));

UPDATE "public"."Invoice" i
   SET "depositForLotId" = l."id"
  FROM "public"."DevelopmentLot" l
 WHERE l."depositInvoiceId" = i."id" AND i."depositForLotId" IS NULL;

WITH todo AS (
  SELECT l."id" AS lot_id, l."workspaceId" AS ws, l."reservationFee" AS fee, l."reservationFeePaidAt" AS paid_at,
         l."depositInvoiceId" AS inv, EXTRACT(YEAR FROM l."reservationFeePaidAt")::int AS yr
    FROM "public"."DevelopmentLot" l
   WHERE l."depositInvoiceId" = 'dep_' || md5(l."id")
     AND l."reservationFeePaidAt" IS NOT NULL
     AND l."reservationFee" > 0
     AND NOT EXISTS (SELECT 1 FROM "public"."Payment" x WHERE x."invoiceId" = l."depositInvoiceId")
), numbered AS (
  SELECT t.*, COALESCE(c."last", 0) + ROW_NUMBER() OVER (PARTITION BY t.ws, t.yr ORDER BY t.paid_at, t.lot_id) AS seq
    FROM todo t
    LEFT JOIN "public"."DocumentCounter" c ON c."workspaceId" = t.ws AND c."kind" = 'receipt' AND c."year" = t.yr
), inserted AS (
  INSERT INTO "public"."Payment" (
    "id", "invoiceId", "workspaceId", "amount", "paymentDate", "paymentMethod", "notes",
    "status", "kind", "receiptNumber", "confirmedAt", "createdAt", "updatedAt"
  )
  SELECT 'depp_' || md5(lot_id), inv, ws, fee, paid_at, 'other', 'Deposit recorded before the ledger',
         'confirmed', 'payment', 'REC-' || yr || '-' || LPAD(seq::text, 4, '0'), paid_at, NOW(), NOW()
    FROM numbered
  ON CONFLICT DO NOTHING
  RETURNING "workspaceId", "receiptNumber"
)
INSERT INTO "public"."DocumentCounter" ("workspaceId", "kind", "year", "last")
SELECT ws, 'receipt', yr, MAX(seq) FROM numbered GROUP BY ws, yr
ON CONFLICT ("workspaceId", "kind", "year") DO UPDATE SET "last" = GREATEST("DocumentCounter"."last", EXCLUDED."last");

-- The deposit invoices' cached totals, from their confirmed rows.
UPDATE "public"."Invoice" i
   SET "amountPaid" = s.paid,
       "amountDue" = GREATEST(0, i."total" - s.paid),
       "status" = CASE WHEN i."total" - s.paid <= 0.005 THEN 'paid' WHEN s.paid > 0 THEN 'partially_paid' ELSE i."status" END,
       "paidDate" = CASE WHEN i."total" - s.paid <= 0.005 THEN s.last_paid ELSE NULL END
  FROM (
    SELECT p."invoiceId",
           SUM(CASE WHEN p."kind" = 'refund' THEN -p."amount" ELSE p."amount" END) AS paid,
           MAX(p."paymentDate") AS last_paid
      FROM "public"."Payment" p
     WHERE p."status" = 'confirmed'
     GROUP BY p."invoiceId"
  ) s
 WHERE i."id" = s."invoiceId"
   AND i."id" IN (SELECT "depositInvoiceId" FROM "public"."DevelopmentLot" WHERE "depositInvoiceId" IS NOT NULL);
