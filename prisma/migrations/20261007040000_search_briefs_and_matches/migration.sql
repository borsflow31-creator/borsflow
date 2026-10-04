-- Search briefs and new-listing matches.
--
-- A buyer's brief is stored on the lead and evaluated against NEW properties: the
-- inverse of a segment, where criteria live on the rule and are evaluated against
-- leads. It is its own table, not columns on Lead, because a buyer routinely has
-- two (own home, investment) and because it needs its own lifecycle (active,
-- notify-by-email, last matched).
--
-- PropertyMatch is what makes matching idempotent: unique on (property, brief), so
-- re-running the matcher for a listing is an insert that skips duplicates, a price
-- drop does not re-notify a buyer who was already told, and an agent has a list of
-- matches to action.
--
-- Interest gains the provenance of a match (which brief found it, and how well it
-- fit); Mandate gains the schedule of its vendor report.
--
-- Safe on a live database: two new tables and nullable columns. Rollback: drop
-- PropertyMatch then SearchBrief; drop Interest.searchBriefId (and its FK and
-- index) and matchScore; drop Mandate.reportEveryDays and lastReportSentAt.

-- AlterTable
ALTER TABLE "Mandate" ADD COLUMN     "lastReportSentAt" TIMESTAMP(3),
ADD COLUMN     "reportEveryDays" INTEGER;

-- AlterTable
ALTER TABLE "Interest" ADD COLUMN     "matchScore" DOUBLE PRECISION,
ADD COLUMN     "searchBriefId" TEXT;

-- CreateTable
CREATE TABLE "SearchBrief" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notifyByEmail" BOOLEAN NOT NULL DEFAULT true,
    "transactionType" TEXT NOT NULL DEFAULT 'sale',
    "priceMin" DOUBLE PRECISION,
    "priceMax" DOUBLE PRECISION,
    "surfaceMin" DOUBLE PRECISION,
    "bedroomsMin" INTEGER,
    "roomsMin" INTEGER,
    "mustHaveParking" BOOLEAN NOT NULL DEFAULT false,
    "mustHaveElevator" BOOLEAN NOT NULL DEFAULT false,
    "mustHaveGarden" BOOLEAN NOT NULL DEFAULT false,
    "mustHaveTerrace" BOOLEAN NOT NULL DEFAULT false,
    "mustHaveBalcony" BOOLEAN NOT NULL DEFAULT false,
    "propertyTypes" TEXT,
    "cities" TEXT,
    "districts" TEXT,
    "criteria" TEXT,
    "logicOperator" TEXT NOT NULL DEFAULT 'AND',
    "notes" TEXT,
    "lastMatchedAt" TIMESTAMP(3),
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyMatch" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "searchBriefId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'new',
    "notifiedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "interestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchBrief_workspaceId_isActive_idx" ON "SearchBrief"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "SearchBrief_leadId_idx" ON "SearchBrief"("leadId");

-- CreateIndex
CREATE INDEX "SearchBrief_workspaceId_isActive_priceMax_idx" ON "SearchBrief"("workspaceId", "isActive", "priceMax");

-- CreateIndex
CREATE INDEX "SearchBrief_workspaceId_isActive_priceMin_idx" ON "SearchBrief"("workspaceId", "isActive", "priceMin");

-- CreateIndex
CREATE INDEX "PropertyMatch_workspaceId_status_idx" ON "PropertyMatch"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "PropertyMatch_searchBriefId_createdAt_idx" ON "PropertyMatch"("searchBriefId", "createdAt");

-- CreateIndex
CREATE INDEX "PropertyMatch_leadId_status_idx" ON "PropertyMatch"("leadId", "status");

-- CreateIndex
CREATE INDEX "PropertyMatch_status_createdAt_idx" ON "PropertyMatch"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyMatch_propertyId_searchBriefId_key" ON "PropertyMatch"("propertyId", "searchBriefId");

-- CreateIndex
CREATE INDEX "Interest_searchBriefId_idx" ON "Interest"("searchBriefId");

-- AddForeignKey
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_searchBriefId_fkey" FOREIGN KEY ("searchBriefId") REFERENCES "SearchBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchBrief" ADD CONSTRAINT "SearchBrief_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchBrief" ADD CONSTRAINT "SearchBrief_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchBrief" ADD CONSTRAINT "SearchBrief_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchBrief" ADD CONSTRAINT "SearchBrief_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMatch" ADD CONSTRAINT "PropertyMatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMatch" ADD CONSTRAINT "PropertyMatch_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMatch" ADD CONSTRAINT "PropertyMatch_searchBriefId_fkey" FOREIGN KEY ("searchBriefId") REFERENCES "SearchBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMatch" ADD CONSTRAINT "PropertyMatch_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMatch" ADD CONSTRAINT "PropertyMatch_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."SearchBrief" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PropertyMatch" ENABLE ROW LEVEL SECURITY;
