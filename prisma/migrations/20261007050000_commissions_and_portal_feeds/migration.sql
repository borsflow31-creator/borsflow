-- Commissions (and how they are shared) and outbound portal feeds.
--
-- Commission is not an Invoice. Revenue on a sale is a percentage of the sale price,
-- split between the listing agent, the selling agent and the agency, realized at
-- closing, and often paid through a notary or escrow rather than billed to the
-- client. It accrues when an offer is accepted, with the mandate's terms snapshotted
-- so a later renegotiation cannot rewrite what was agreed on this sale. Quote and
-- Invoice stay for billing the agency's own fees.
--
-- A share is a percentage of the total, 0..100, enforced here with a CHECK
-- (Prisma cannot model one). Nothing in schema.prisma shows it.
--
-- PortalFeed is a tokenised outbound feed for a listing portal. The token is the
-- credential, so rotating it revokes the portal's access.
--
-- Safe on a live database: three new tables, no existing row is touched. Rollback:
-- drop CommissionSplit, Commission, PortalFeed (in that order).

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "mandateId" TEXT,
    "interestId" TEXT,
    "offerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'accrued',
    "basis" DOUBLE PRECISION NOT NULL,
    "feeType" TEXT NOT NULL DEFAULT 'percent',
    "feePercent" DOUBLE PRECISION,
    "feeFixed" DOUBLE PRECISION,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT,
    "realizedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionSplit" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "sharePercent" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalFeed" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "portal" TEXT NOT NULL DEFAULT 'generic',
    "format" TEXT NOT NULL DEFAULT 'xml',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "token" TEXT NOT NULL,
    "tokenCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filterStatuses" TEXT,
    "filterPropertyTypes" TEXT,
    "filterCities" TEXT,
    "includeUnpublished" BOOLEAN NOT NULL DEFAULT false,
    "lastFetchedAt" TIMESTAMP(3),
    "fetchCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalFeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Commission_workspaceId_status_idx" ON "Commission"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Commission_propertyId_idx" ON "Commission"("propertyId");

-- CreateIndex
CREATE INDEX "Commission_offerId_idx" ON "Commission"("offerId");

-- CreateIndex
CREATE INDEX "CommissionSplit_commissionId_idx" ON "CommissionSplit"("commissionId");

-- CreateIndex
CREATE INDEX "CommissionSplit_userId_status_idx" ON "CommissionSplit"("userId", "status");

-- CreateIndex
CREATE INDEX "CommissionSplit_workspaceId_status_idx" ON "CommissionSplit"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PortalFeed_token_key" ON "PortalFeed"("token");

-- CreateIndex
CREATE INDEX "PortalFeed_workspaceId_isActive_idx" ON "PortalFeed"("workspaceId", "isActive");

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionSplit" ADD CONSTRAINT "CommissionSplit_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionSplit" ADD CONSTRAINT "CommissionSplit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionSplit" ADD CONSTRAINT "CommissionSplit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalFeed" ADD CONSTRAINT "PortalFeed_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalFeed" ADD CONSTRAINT "PortalFeed_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraint: a share is a percentage of the whole.
ALTER TABLE "CommissionSplit" ADD CONSTRAINT "CommissionSplit_sharePercent_check" CHECK ("sharePercent" >= 0 AND "sharePercent" <= 100);

ALTER TABLE "public"."Commission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CommissionSplit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PortalFeed" ENABLE ROW LEVEL SECURITY;
