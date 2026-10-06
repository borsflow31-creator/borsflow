-- Developer CRM tables, and the media a project can carry.
--
-- Two jobs in one migration, because the second cannot be written without the
-- first.
--
-- 1. The developer CRM models (LandDeal, Program, Building, DevelopmentLot,
--    ConstructionMilestone, CallForFunds, TMARequest, HandoverSnag,
--    ProgramMedia) were added to schema.prisma without a migration, so the
--    recorded history and the schema had drifted. Whoever applied them did it
--    with `prisma db push`, which writes no migration row. This migration
--    reconciles the two.
--
--    Every statement here is therefore idempotent -- IF NOT EXISTS on tables,
--    columns and indexes, and a guarded DO block per foreign key. A database
--    that already has these tables from a push is left exactly as it is; a fresh
--    database gets them built. That is the only way one migration can be correct
--    for both, and it is why this does not read like a generated migration.
--
-- 2. ProgramMedia gains what a gallery needs: workspaceId (denormalized so a
--    workspace's objects are one storage prefix and cleanup does not join back
--    through Program), fileName, fileType, size, caption, position, isCover and
--    uploadedById. Program gains projectType, developerName and websiteUrl.
--
--    workspaceId is nullable on purpose. Any rows a push already created have no
--    workspace to attribute them to, and inventing one would be a guess; the
--    backfill below fills it from the parent program, which is where it would
--    have come from anyway, and new rows always set it.
--
-- Safe on a live database: new tables, new nullable columns, and columns with
-- non-volatile defaults (metadata-only on PG 11+). No column is dropped, no type
-- changes, and no data is rewritten except the workspaceId backfill, which only
-- touches rows where it is NULL.
--
-- Rollback: ALTER TABLE "ProgramMedia" DROP COLUMN "workspaceId", "fileName",
-- "fileType", "size", "caption", "position", "isCover", "uploadedById"; ALTER
-- TABLE "Program" DROP COLUMN "projectType", "developerName", "websiteUrl". The
-- tables from step 1 are left alone -- they hold real data and predate this file.

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."LandDeal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "postalCode" TEXT,
    "cadastralRef" TEXT,
    "plotArea" DOUBLE PRECISION,
    "zoning" TEXT,
    "status" TEXT NOT NULL DEFAULT 'prospecting',
    "targetUnits" INTEGER,
    "sellableArea" DOUBLE PRECISION,
    "landPrice" DOUBLE PRECISION,
    "estimatedRevenue" DOUBLE PRECISION,
    "estimatedCost" DOUBLE PRECISION,
    "projectedMargin" DOUBLE PRECISION,
    "vendorLeadId" TEXT,
    "permitNumber" TEXT,
    "permitFiledAt" TIMESTAMP(3),
    "permitGrantedAt" TIMESTAMP(3),
    "permitClearedAt" TIMESTAMP(3),
    "deedSignedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "assignedToId" TEXT,
    "notes" TEXT,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandDeal_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."Program" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commercialName" TEXT,
    "description" TEXT,
    "projectType" TEXT NOT NULL DEFAULT 'residential',
    "developerName" TEXT,
    "websiteUrl" TEXT,
    "addressLine" TEXT,
    "city" TEXT NOT NULL,
    "postalCode" TEXT,
    "countryCode" TEXT DEFAULT 'FR',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'study',
    "permitNumber" TEXT,
    "architectName" TEXT,
    "gfaBank" TEXT,
    "notaryName" TEXT,
    "notaryEmail" TEXT,
    "targetDeliveryDate" TIMESTAMP(3),
    "totalUnits" INTEGER NOT NULL DEFAULT 0,
    "availableUnits" INTEGER NOT NULL DEFAULT 0,
    "reservedUnits" INTEGER NOT NULL DEFAULT 0,
    "soldUnits" INTEGER NOT NULL DEFAULT 0,
    "publicToken" TEXT,
    "landDealId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."Building" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floorsCount" INTEGER NOT NULL DEFAULT 1,
    "basementCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."DevelopmentLot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "buildingId" TEXT,
    "lotNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'apartment',
    "typology" TEXT,
    "floor" INTEGER NOT NULL DEFAULT 0,
    "orientation" TEXT,
    "surfaceArea" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "terraceArea" DOUBLE PRECISION DEFAULT 0,
    "balconyArea" DOUBLE PRECISION DEFAULT 0,
    "gardenArea" DOUBLE PRECISION DEFAULT 0,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'available',
    "optionExpiresAt" TIMESTAMP(3),
    "optionHolderLeadId" TEXT,
    "buyerLeadId" TEXT,
    "notaryDeedScheduledAt" TIMESTAMP(3),
    "notaryDeedSignedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "parentLotId" TEXT,
    "publicToken" TEXT,
    "publicTokenCreatedAt" TIMESTAMP(3),
    "portalOtpCode" TEXT,
    "portalOtpExpiresAt" TIMESTAMP(3),
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentLot_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."ConstructionMilestone" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "buildingId" TEXT,
    "stageKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isCertified" BOOLEAN NOT NULL DEFAULT false,
    "certifiedAt" TIMESTAMP(3),
    "architectCertificateDoc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionMilestone_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."CallForFunds" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "callNumber" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "bankName" TEXT,
    "bankLoanReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallForFunds_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."TMARequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "buyerLeadId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'finishes',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "costEstimate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceQuote" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "techApprovedAt" TIMESTAMP(3),
    "techApproverNote" TEXT,
    "signedAddendumDoc" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TMARequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."HandoverSnag" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "warrantyType" TEXT NOT NULL DEFAULT 'gpa',
    "contractorName" TEXT,
    "contractorEmail" TEXT,
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedProofPhoto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandoverSnag_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."ProgramMedia" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'photo',
    "title" TEXT,
    "filePath" TEXT,
    "externalUrl" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "size" INTEGER,
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT,
    "isConstructionUpdate" BOOLEAN NOT NULL DEFAULT false,
    "updateMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramMedia_pkey" PRIMARY KEY ("id")
);

-- AlterTable: the columns this migration introduces, for a database that already
-- has these tables from a push.
ALTER TABLE "public"."Program"
  ADD COLUMN IF NOT EXISTS "projectType"   TEXT NOT NULL DEFAULT 'residential',
  ADD COLUMN IF NOT EXISTS "developerName" TEXT,
  ADD COLUMN IF NOT EXISTS "websiteUrl"    TEXT;

ALTER TABLE "public"."ProgramMedia"
  ADD COLUMN IF NOT EXISTS "workspaceId"  TEXT,
  ADD COLUMN IF NOT EXISTS "fileName"     TEXT,
  ADD COLUMN IF NOT EXISTS "fileType"     TEXT,
  ADD COLUMN IF NOT EXISTS "size"         INTEGER,
  ADD COLUMN IF NOT EXISTS "caption"      TEXT,
  ADD COLUMN IF NOT EXISTS "position"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isCover"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "uploadedById" TEXT;

-- Backfill: a media row belongs to whatever workspace its program belongs to.
UPDATE "public"."ProgramMedia" m
   SET "workspaceId" = p."workspaceId"
  FROM "public"."Program" p
 WHERE m."programId" = p."id"
   AND m."workspaceId" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LandDeal_workspaceId_status_idx" ON "public"."LandDeal"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "LandDeal_vendorLeadId_idx" ON "public"."LandDeal"("vendorLeadId");
CREATE INDEX IF NOT EXISTS "LandDeal_assignedToId_idx" ON "public"."LandDeal"("assignedToId");
CREATE UNIQUE INDEX IF NOT EXISTS "LandDeal_workspaceId_reference_key" ON "public"."LandDeal"("workspaceId", "reference");
CREATE UNIQUE INDEX IF NOT EXISTS "Program_publicToken_key" ON "public"."Program"("publicToken");
CREATE UNIQUE INDEX IF NOT EXISTS "Program_landDealId_key" ON "public"."Program"("landDealId");
CREATE INDEX IF NOT EXISTS "Program_workspaceId_status_idx" ON "public"."Program"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "Program_createdById_idx" ON "public"."Program"("createdById");
CREATE UNIQUE INDEX IF NOT EXISTS "Program_workspaceId_reference_key" ON "public"."Program"("workspaceId", "reference");
CREATE INDEX IF NOT EXISTS "Building_programId_idx" ON "public"."Building"("programId");
CREATE UNIQUE INDEX IF NOT EXISTS "DevelopmentLot_publicToken_key" ON "public"."DevelopmentLot"("publicToken");
CREATE INDEX IF NOT EXISTS "DevelopmentLot_workspaceId_status_idx" ON "public"."DevelopmentLot"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "DevelopmentLot_programId_status_idx" ON "public"."DevelopmentLot"("programId", "status");
CREATE INDEX IF NOT EXISTS "DevelopmentLot_buildingId_idx" ON "public"."DevelopmentLot"("buildingId");
CREATE INDEX IF NOT EXISTS "DevelopmentLot_buyerLeadId_idx" ON "public"."DevelopmentLot"("buyerLeadId");
CREATE INDEX IF NOT EXISTS "DevelopmentLot_optionHolderLeadId_idx" ON "public"."DevelopmentLot"("optionHolderLeadId");
CREATE UNIQUE INDEX IF NOT EXISTS "DevelopmentLot_programId_lotNumber_key" ON "public"."DevelopmentLot"("programId", "lotNumber");
CREATE INDEX IF NOT EXISTS "ConstructionMilestone_programId_order_idx" ON "public"."ConstructionMilestone"("programId", "order");
CREATE INDEX IF NOT EXISTS "ConstructionMilestone_buildingId_idx" ON "public"."ConstructionMilestone"("buildingId");
CREATE UNIQUE INDEX IF NOT EXISTS "CallForFunds_invoiceId_key" ON "public"."CallForFunds"("invoiceId");
CREATE INDEX IF NOT EXISTS "CallForFunds_workspaceId_status_idx" ON "public"."CallForFunds"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "CallForFunds_lotId_idx" ON "public"."CallForFunds"("lotId");
CREATE INDEX IF NOT EXISTS "CallForFunds_milestoneId_idx" ON "public"."CallForFunds"("milestoneId");
CREATE UNIQUE INDEX IF NOT EXISTS "CallForFunds_workspaceId_callNumber_key" ON "public"."CallForFunds"("workspaceId", "callNumber");
CREATE INDEX IF NOT EXISTS "TMARequest_workspaceId_status_idx" ON "public"."TMARequest"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "TMARequest_lotId_idx" ON "public"."TMARequest"("lotId");
CREATE INDEX IF NOT EXISTS "TMARequest_buyerLeadId_idx" ON "public"."TMARequest"("buyerLeadId");
CREATE UNIQUE INDEX IF NOT EXISTS "TMARequest_workspaceId_reference_key" ON "public"."TMARequest"("workspaceId", "reference");
CREATE INDEX IF NOT EXISTS "HandoverSnag_workspaceId_status_idx" ON "public"."HandoverSnag"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "HandoverSnag_lotId_idx" ON "public"."HandoverSnag"("lotId");
CREATE INDEX IF NOT EXISTS "ProgramMedia_programId_position_idx" ON "public"."ProgramMedia"("programId", "position");
CREATE INDEX IF NOT EXISTS "ProgramMedia_workspaceId_idx" ON "public"."ProgramMedia"("workspaceId");
CREATE INDEX IF NOT EXISTS "ProgramMedia_uploadedById_idx" ON "public"."ProgramMedia"("uploadedById");

-- AddForeignKey
-- Guarded: ADD CONSTRAINT has no IF NOT EXISTS, and re-adding one that a push
-- already created would abort the migration.
DO $$ BEGIN
  ALTER TABLE "public"."LandDeal" ADD CONSTRAINT "LandDeal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."LandDeal" ADD CONSTRAINT "LandDeal_vendorLeadId_fkey" FOREIGN KEY ("vendorLeadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."LandDeal" ADD CONSTRAINT "LandDeal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."LandDeal" ADD CONSTRAINT "LandDeal_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."Program" ADD CONSTRAINT "Program_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."Program" ADD CONSTRAINT "Program_landDealId_fkey" FOREIGN KEY ("landDealId") REFERENCES "public"."LandDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."Program" ADD CONSTRAINT "Program_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."Building" ADD CONSTRAINT "Building_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."DevelopmentLot" ADD CONSTRAINT "DevelopmentLot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."DevelopmentLot" ADD CONSTRAINT "DevelopmentLot_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."DevelopmentLot" ADD CONSTRAINT "DevelopmentLot_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "public"."Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."DevelopmentLot" ADD CONSTRAINT "DevelopmentLot_optionHolderLeadId_fkey" FOREIGN KEY ("optionHolderLeadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."DevelopmentLot" ADD CONSTRAINT "DevelopmentLot_buyerLeadId_fkey" FOREIGN KEY ("buyerLeadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."DevelopmentLot" ADD CONSTRAINT "DevelopmentLot_parentLotId_fkey" FOREIGN KEY ("parentLotId") REFERENCES "public"."DevelopmentLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."ConstructionMilestone" ADD CONSTRAINT "ConstructionMilestone_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."ConstructionMilestone" ADD CONSTRAINT "ConstructionMilestone_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "public"."Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."CallForFunds" ADD CONSTRAINT "CallForFunds_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."CallForFunds" ADD CONSTRAINT "CallForFunds_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "public"."DevelopmentLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."CallForFunds" ADD CONSTRAINT "CallForFunds_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "public"."ConstructionMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."CallForFunds" ADD CONSTRAINT "CallForFunds_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."TMARequest" ADD CONSTRAINT "TMARequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."TMARequest" ADD CONSTRAINT "TMARequest_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "public"."DevelopmentLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."TMARequest" ADD CONSTRAINT "TMARequest_buyerLeadId_fkey" FOREIGN KEY ("buyerLeadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."HandoverSnag" ADD CONSTRAINT "HandoverSnag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."HandoverSnag" ADD CONSTRAINT "HandoverSnag_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "public"."DevelopmentLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."ProgramMedia" ADD CONSTRAINT "ProgramMedia_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."ProgramMedia" ADD CONSTRAINT "ProgramMedia_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."ProgramMedia" ADD CONSTRAINT "ProgramMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Row Level Security. Every table added by a migration must enable it; these
-- nine never did, because they arrived without a migration at all. Enabled with
-- no policies, which denies Supabase's anon and authenticated roles everything
-- while Prisma, connecting as postgres, bypasses RLS.
ALTER TABLE "public"."LandDeal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Program" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Building" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DevelopmentLot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ConstructionMilestone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CallForFunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TMARequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."HandoverSnag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ProgramMedia" ENABLE ROW LEVEL SECURITY;
