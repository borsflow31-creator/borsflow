-- Workspace currency: used for product prices and as the default for new quotes and invoices.

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

