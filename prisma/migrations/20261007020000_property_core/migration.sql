-- Properties: the agency's inventory, and the card on the owner board.
--
-- Product stays as the catalog of billable services and fees (agency fee,
-- photography, staging, EPC). It cannot carry a listing: no image field, no
-- structured address, no coordinates, so no radius search and no map view.
--
-- PropertyMedia follows LeadFile's storage pattern: private bucket, path scoped
-- per workspace, short-lived signed URLs. Listing images are never in a public
-- bucket; public pages and portal feeds reach them through a proxy route that
-- mints a signed URL per request.
--
-- ProductCustomField gains entityType so a listing reuses the same definitions,
-- validation and coercion as a product. Every existing definition becomes
-- 'product', so the old uniqueness (workspace, key) is a strict subset of the new
-- one (workspace, entityType, key) and the new index cannot fail to build.
--
-- Safe on a live database: new tables, and a column with a non-volatile default
-- (metadata-only on PG 11+). Rollback: drop the two tables; DROP INDEX the new
-- unique and recreate "ProductCustomField_workspaceId_key_key" (delete any
-- 'property' definitions first); DROP COLUMN "entityType".

-- DropIndex
DROP INDEX "ProductCustomField_workspaceId_key_key";

-- AlterTable
ALTER TABLE "ProductCustomField" ADD COLUMN     "entityType" TEXT NOT NULL DEFAULT 'product';

-- CreateIndex
CREATE UNIQUE INDEX "ProductCustomField_workspaceId_entityType_key_key" ON "ProductCustomField"("workspaceId", "entityType", "key");

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "propertyType" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL DEFAULT 'sale',
    "status" TEXT NOT NULL DEFAULT 'prospect',
    "pipelineId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'Prospect',
    "order" INTEGER NOT NULL DEFAULT 0,
    "vendorId" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT,
    "soldAt" TIMESTAMP(3),
    "soldPrice" DOUBLE PRECISION,
    "addressLine" TEXT,
    "isAddressPublic" BOOLEAN NOT NULL DEFAULT false,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "postalCode" TEXT,
    "countryCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "surfaceArea" DOUBLE PRECISION,
    "landArea" DOUBLE PRECISION,
    "rooms" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "floor" INTEGER,
    "buildYear" INTEGER,
    "energyRating" TEXT,
    "hasElevator" BOOLEAN NOT NULL DEFAULT false,
    "hasParking" BOOLEAN NOT NULL DEFAULT false,
    "hasBalcony" BOOLEAN NOT NULL DEFAULT false,
    "hasTerrace" BOOLEAN NOT NULL DEFAULT false,
    "hasGarden" BOOLEAN NOT NULL DEFAULT false,
    "hasPool" BOOLEAN NOT NULL DEFAULT false,
    "furnished" BOOLEAN NOT NULL DEFAULT false,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "listedAt" TIMESTAMP(3),
    "publicToken" TEXT,
    "publicTokenCreatedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyMedia" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'photo',
    "filePath" TEXT,
    "externalUrl" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Property_publicToken_key" ON "Property"("publicToken");

-- CreateIndex
CREATE INDEX "Property_workspaceId_status_idx" ON "Property"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Property_workspaceId_status_price_idx" ON "Property"("workspaceId", "status", "price");

-- CreateIndex
CREATE INDEX "Property_workspaceId_propertyType_status_price_idx" ON "Property"("workspaceId", "propertyType", "status", "price");

-- CreateIndex
CREATE INDEX "Property_workspaceId_city_status_price_idx" ON "Property"("workspaceId", "city", "status", "price");

-- CreateIndex
CREATE INDEX "Property_workspaceId_bedrooms_status_idx" ON "Property"("workspaceId", "bedrooms", "status");

-- CreateIndex
CREATE INDEX "Property_pipelineId_stage_order_idx" ON "Property"("pipelineId", "stage", "order");

-- CreateIndex
CREATE INDEX "Property_vendorId_idx" ON "Property"("vendorId");

-- CreateIndex
CREATE INDEX "Property_ownerId_idx" ON "Property"("ownerId");

-- CreateIndex
CREATE INDEX "Property_workspaceId_publishedAt_idx" ON "Property"("workspaceId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Property_workspaceId_reference_key" ON "Property"("workspaceId", "reference");

-- CreateIndex
CREATE INDEX "PropertyMedia_propertyId_position_idx" ON "PropertyMedia"("propertyId", "position");

-- CreateIndex
CREATE INDEX "PropertyMedia_workspaceId_idx" ON "PropertyMedia"("workspaceId");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."Property" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PropertyMedia" ENABLE ROW LEVEL SECURITY;
