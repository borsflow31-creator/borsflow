-- Mandates, buyer interests, offers and viewing feedback.
--
-- Interest is the join of one lead to one property. It carries its own stage,
-- status, board order, owning agent and source, and it -- not the lead -- is what
-- moves across the buyer board. Real-estate state is per (lead x property).
--
-- Offer copies Quote's pattern (unguessable publicToken, public accept/reject,
-- status machine, validity date) but not its table: an offer is buyer-to-seller
-- with one amount, conditions, and competing siblings on one property.
--
-- A viewing is a Meeting plus a property, an interest and structured feedback, so
-- Meeting gains two nullable references (SET NULL: deleting a property must not
-- delete the calendar history).
--
-- Safe on a live database: new tables and nullable columns only. Rollback: drop
-- ViewingFeedback, Offer, Interest, MandatePriceChange, Mandate (in that order);
-- drop the two Meeting foreign keys, indexes and columns; drop the two Activity
-- indexes and the propertyId / interestId columns.

-- CreateTable
CREATE TABLE "Mandate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "mandateType" TEXT NOT NULL DEFAULT 'simple',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "renewalTerms" TEXT,
    "askingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netToVendor" DOUBLE PRECISION,
    "feeType" TEXT NOT NULL DEFAULT 'percent',
    "commissionPercent" DOUBLE PRECISION,
    "feeFixed" DOUBLE PRECISION,
    "feePayer" TEXT NOT NULL DEFAULT 'vendor',
    "signedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "terminationReason" TEXT,
    "documentPath" TEXT,
    "documentName" TEXT,
    "notes" TEXT,
    "publicToken" TEXT,
    "publicTokenCreatedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mandate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MandatePriceChange" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "fromPrice" DOUBLE PRECISION NOT NULL,
    "toPrice" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,

    CONSTRAINT "MandatePriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "leadId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT,
    "notes" TEXT,
    "lostReason" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "interestId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedVia" TEXT,
    "decisionReason" TEXT,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "depositAmount" DOUBLE PRECISION,
    "financingType" TEXT,
    "publicToken" TEXT,
    "publicTokenCreatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewingFeedback" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "interestId" TEXT,
    "leadId" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT true,
    "priceVerdict" TEXT,
    "conditionVerdict" TEXT,
    "locationVerdict" TEXT,
    "layoutVerdict" TEXT,
    "interestLevel" INTEGER,
    "comments" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewingFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mandate_publicToken_key" ON "Mandate"("publicToken");

-- CreateIndex
CREATE INDEX "Mandate_workspaceId_status_idx" ON "Mandate"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Mandate_propertyId_idx" ON "Mandate"("propertyId");

-- CreateIndex
CREATE INDEX "Mandate_leadId_idx" ON "Mandate"("leadId");

-- CreateIndex
CREATE INDEX "Mandate_ownerId_idx" ON "Mandate"("ownerId");

-- CreateIndex
CREATE INDEX "Mandate_status_endDate_idx" ON "Mandate"("status", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Mandate_workspaceId_reference_key" ON "Mandate"("workspaceId", "reference");

-- CreateIndex
CREATE INDEX "MandatePriceChange_mandateId_changedAt_idx" ON "MandatePriceChange"("mandateId", "changedAt");

-- CreateIndex
CREATE INDEX "Interest_workspaceId_status_idx" ON "Interest"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Interest_pipelineId_stage_order_idx" ON "Interest"("pipelineId", "stage", "order");

-- CreateIndex
CREATE INDEX "Interest_leadId_idx" ON "Interest"("leadId");

-- CreateIndex
CREATE INDEX "Interest_ownerId_idx" ON "Interest"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Interest_propertyId_leadId_key" ON "Interest"("propertyId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_publicToken_key" ON "Offer"("publicToken");

-- CreateIndex
CREATE INDEX "Offer_propertyId_status_idx" ON "Offer"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Offer_interestId_idx" ON "Offer"("interestId");

-- CreateIndex
CREATE INDEX "Offer_workspaceId_status_idx" ON "Offer"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Offer_leadId_idx" ON "Offer"("leadId");

-- CreateIndex
CREATE INDEX "Offer_status_expiresAt_idx" ON "Offer"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ViewingFeedback_meetingId_key" ON "ViewingFeedback"("meetingId");

-- CreateIndex
CREATE INDEX "ViewingFeedback_propertyId_createdAt_idx" ON "ViewingFeedback"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "ViewingFeedback_interestId_idx" ON "ViewingFeedback"("interestId");

-- CreateIndex
CREATE INDEX "ViewingFeedback_leadId_idx" ON "ViewingFeedback"("leadId");

-- CreateIndex
CREATE INDEX "ViewingFeedback_workspaceId_idx" ON "ViewingFeedback"("workspaceId");

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatePriceChange" ADD CONSTRAINT "MandatePriceChange_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatePriceChange" ADD CONSTRAINT "MandatePriceChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewingFeedback" ADD CONSTRAINT "ViewingFeedback_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewingFeedback" ADD CONSTRAINT "ViewingFeedback_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewingFeedback" ADD CONSTRAINT "ViewingFeedback_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewingFeedback" ADD CONSTRAINT "ViewingFeedback_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewingFeedback" ADD CONSTRAINT "ViewingFeedback_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewingFeedback" ADD CONSTRAINT "ViewingFeedback_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "interestId" TEXT,
ADD COLUMN     "propertyId" TEXT;

-- CreateIndex
CREATE INDEX "Meeting_propertyId_startTime_idx" ON "Meeting"("propertyId", "startTime");

-- CreateIndex
CREATE INDEX "Meeting_interestId_idx" ON "Meeting"("interestId");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "interestId" TEXT,
ADD COLUMN     "propertyId" TEXT;

-- CreateIndex
CREATE INDEX "Activity_propertyId_createdAt_idx" ON "Activity"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_interestId_createdAt_idx" ON "Activity"("interestId", "createdAt");

ALTER TABLE "public"."Mandate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MandatePriceChange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Interest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Offer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ViewingFeedback" ENABLE ROW LEVEL SECURITY;
