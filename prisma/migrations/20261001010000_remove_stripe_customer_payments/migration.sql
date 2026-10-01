-- Removes the customer-facing Stripe integration (direct API keys, legacy
-- Stripe Connect, and per-invoice payment links). Manual/bank-transfer
-- payment recording on invoices is unaffected. The dormant SaaS-billing
-- scaffold (Workspace.stripeBillingCustomerId, Subscription, etc.) is
-- untouched — it is unrelated and not yet wired to any Stripe call.

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "stripeAccountId",
DROP COLUMN "stripeAccountEnabled",
DROP COLUMN "stripeSecretKey",
DROP COLUMN "stripePublishableKey";

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripePaymentLink",
DROP COLUMN "stripePaymentLinkId",
DROP COLUMN "stripePaymentIntentId",
DROP COLUMN "stripeSessionId";
