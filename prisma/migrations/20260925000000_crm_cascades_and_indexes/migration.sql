-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_pipelineId_fkey";

-- DropForeignKey
ALTER TABLE "LeadListLead" DROP CONSTRAINT "LeadListLead_leadId_fkey";

-- DropForeignKey
ALTER TABLE "LeadListLead" DROP CONSTRAINT "LeadListLead_leadListId_fkey";

-- CreateIndex
CREATE INDEX "Pipeline_workspaceId_idx" ON "Pipeline"("workspaceId");

-- CreateIndex
CREATE INDEX "Lead_pipelineId_idx" ON "Lead"("pipelineId");

-- CreateIndex
CREATE INDEX "LeadListLead_leadListId_idx" ON "LeadListLead"("leadListId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadListLead" ADD CONSTRAINT "LeadListLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadListLead" ADD CONSTRAINT "LeadListLead_leadListId_fkey" FOREIGN KEY ("leadListId") REFERENCES "LeadList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

