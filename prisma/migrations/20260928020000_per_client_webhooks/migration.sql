-- Per-client email and calendar webhooks.
--
-- Each client connects their own email provider (Resend, SendGrid, Mailgun,
-- Postmark) and their own Cal.com account, so each one signs its webhooks with
-- its own secret. The app used to expect one platform-wide secret per provider,
-- which cannot verify any client's events. BorsFlow now creates the webhook on
-- the client's account itself when the provider or calendar is connected, and
-- stores that webhook's id and (encrypted) secret here.
--
-- Bounces, unsubscribes and suppressions were global: one client's bounce or
-- opt-out stopped every client from emailing that address. They now carry the
-- workspace that produced them. Rows that already exist keep a NULL workspace
-- and stop affecting sends; none of them can be attributed after the fact.

-- DropIndex
DROP INDEX "EmailUnsubscribe_email_key";

-- DropIndex
DROP INDEX "EmailSuppression_email_type_key";

-- AlterTable
ALTER TABLE "EmailProvider" ADD COLUMN     "domain" TEXT,
ADD COLUMN     "webhookError" TEXT,
ADD COLUMN     "webhookId" TEXT,
ADD COLUMN     "webhookSecret" TEXT,
ADD COLUMN     "webhookStatus" TEXT,
ADD COLUMN     "webhookUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EmailBounce" ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "EmailUnsubscribe" ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "EmailSuppression" ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "CalendarIntegration" ADD COLUMN     "webhookError" TEXT,
ADD COLUMN     "webhookId" TEXT,
ADD COLUMN     "webhookSecret" TEXT,
ADD COLUMN     "webhookStatus" TEXT;

-- CreateIndex
CREATE INDEX "EmailBounce_workspaceId_idx" ON "EmailBounce"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailUnsubscribe_workspaceId_email_key" ON "EmailUnsubscribe"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "EmailSuppression_workspaceId_idx" ON "EmailSuppression"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSuppression_workspaceId_email_type_key" ON "EmailSuppression"("workspaceId", "email", "type");

-- AddForeignKey
ALTER TABLE "EmailBounce" ADD CONSTRAINT "EmailBounce_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailUnsubscribe" ADD CONSTRAINT "EmailUnsubscribe_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSuppression" ADD CONSTRAINT "EmailSuppression_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

