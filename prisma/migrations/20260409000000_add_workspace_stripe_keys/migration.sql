-- Add direct Stripe API key columns to Workspace
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "stripeSecretKey" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "stripePublishableKey" TEXT;
