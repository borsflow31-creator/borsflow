-- AlterTable
-- Ably Chat message serial: dedupe key between the live stream and this archive, and the
-- idempotency key for the archive upsert. NULL for messages sent before Ably (Postgres
-- treats NULLs as distinct, so legacy rows stay unconstrained).
ALTER TABLE "Message" ADD COLUMN "ablySerial" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_ablySerial_key" ON "Message"("ablySerial");

-- CreateIndex
-- Backs the history query: WHERE workspaceId = ? AND channelId = ? ORDER BY createdAt.
CREATE INDEX "Message_workspaceId_channelId_createdAt_idx" ON "Message"("workspaceId", "channelId", "createdAt");
