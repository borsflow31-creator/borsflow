-- CreateTable
CREATE TABLE "AutomationEnrollment" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentStepOrder" INTEGER NOT NULL DEFAULT 0,
    "nextStepAt" TIMESTAMP(3),
    "triggerContext" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "exitedAt" TIMESTAMP(3),
    "exitReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutomationEnrollment_automationId_leadId_key" ON "AutomationEnrollment"("automationId", "leadId");

-- CreateIndex
CREATE INDEX "AutomationEnrollment_status_nextStepAt_idx" ON "AutomationEnrollment"("status", "nextStepAt");

-- CreateIndex
CREATE INDEX "AutomationEnrollment_leadId_idx" ON "AutomationEnrollment"("leadId");

-- CreateIndex
CREATE INDEX "AutomationEnrollment_workspaceId_idx" ON "AutomationEnrollment"("workspaceId");

-- AddForeignKey
ALTER TABLE "AutomationEnrollment" ADD CONSTRAINT "AutomationEnrollment_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "EmailAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationEnrollment" ADD CONSTRAINT "AutomationEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Email" ADD COLUMN "automationEnrollmentId" TEXT;

-- CreateIndex
CREATE INDEX "Email_automationEnrollmentId_idx" ON "Email"("automationEnrollmentId");

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_automationEnrollmentId_fkey" FOREIGN KEY ("automationEnrollmentId") REFERENCES "AutomationEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
