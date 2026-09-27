-- Normalise blank SKUs to NULL first: the unique index below treats '' as a real
-- value, so two products with an empty SKU would otherwise collide.
UPDATE "Product" SET "sku" = NULL WHERE btrim("sku") = '';

-- CreateIndex
-- Postgres treats NULLs as distinct, so products without a SKU stay unconstrained.
-- This will fail if the table already holds duplicate (workspaceId, sku) pairs;
-- see the query in the migration notes to find and resolve them first.
CREATE UNIQUE INDEX "Product_workspaceId_sku_key" ON "Product"("workspaceId", "sku");

-- CreateIndex
-- Backs the default list ordering: ORDER BY "updatedAt" DESC, "name" ASC.
CREATE INDEX "Product_workspaceId_updatedAt_idx" ON "Product"("workspaceId", "updatedAt");
