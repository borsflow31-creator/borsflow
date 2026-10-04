-- Segments, automations and pipelines become subject-typed; segment membership
-- and automation enrollment become polymorphic.
--
-- Real-estate state is per (lead x property): a buyer sits at "offer made" on one
-- property and "viewing booked" on another at the same time. The old uniques
-- SegmentMember(segmentationRuleId, leadId) and AutomationEnrollment(automationId,
-- leadId) allowed one row per lead, so that buyer could not be enrolled twice in a
-- viewing-follow-up sequence -- the enrollment row collided. Uniqueness moves to
-- (rule, subjectType, subjectId).
--
-- subjectId is polymorphic and therefore has no foreign key. Deletes are covered
-- two ways: the leadId foreign key below, and the statement-level triggers added
-- in 20261007060000_subject_purge_triggers for the subject types that are not
-- leads. Those triggers are invisible to Prisma -- see the comment on
-- SegmentMember.subjectId in prisma/schema.prisma.
--
-- leadId is kept, and is not a compatibility column: it is the contact the row
-- mails (the lead itself, an interest's buyer, a property's or a mandate's
-- vendor). It is null only for a property whose vendor is not recorded yet. It
-- carries the cascade and the Lead back-relations, and feeds
-- EmailRecipient.leadId on every send. It sits outside every unique index, and
-- the CHECK constraints at the end of this file keep it consistent with
-- subjectType.
--
-- SegmentMember.metadata is left in place but is no longer written: it snapshotted
-- {status, stage, value}, which was stale the moment it was written and duplicates
-- what subjectId already reaches.
--
-- Existing rows all become 'Lead' subjects with subjectId = leadId. The old
-- uniqueness is a strict subset of the new one, so the new unique indexes cannot
-- fail to build.

-- AlterTable: the rule / automation / pipeline side declares its subject
ALTER TABLE "SegmentationRule" ADD COLUMN     "subjectType" TEXT NOT NULL DEFAULT 'Lead';
ALTER TABLE "EmailAutomation" ADD COLUMN     "subjectType" TEXT NOT NULL DEFAULT 'Lead';
ALTER TABLE "Pipeline" ADD COLUMN     "subjectType" TEXT NOT NULL DEFAULT 'Lead';

-- AlterTable: SegmentMember -- add nullable, backfill, then constrain
ALTER TABLE "SegmentMember" ADD COLUMN     "subjectType" TEXT;
ALTER TABLE "SegmentMember" ADD COLUMN     "subjectId" TEXT;

UPDATE "SegmentMember" SET "subjectType" = 'Lead', "subjectId" = "leadId" WHERE "subjectType" IS NULL;

ALTER TABLE "SegmentMember" ALTER COLUMN "subjectType" SET NOT NULL;
ALTER TABLE "SegmentMember" ALTER COLUMN "subjectId" SET NOT NULL;
-- A property whose vendor is not recorded yet has no contact, so the contact
-- column becomes optional.
ALTER TABLE "SegmentMember" ALTER COLUMN "leadId" DROP NOT NULL;

-- AlterTable: AutomationEnrollment -- same, but leadId stays NOT NULL because
-- every enrollable subject resolves to a mailable contact.
ALTER TABLE "AutomationEnrollment" ADD COLUMN     "subjectType" TEXT;
ALTER TABLE "AutomationEnrollment" ADD COLUMN     "subjectId" TEXT;

UPDATE "AutomationEnrollment" SET "subjectType" = 'Lead', "subjectId" = "leadId" WHERE "subjectType" IS NULL;

ALTER TABLE "AutomationEnrollment" ALTER COLUMN "subjectType" SET NOT NULL;
ALTER TABLE "AutomationEnrollment" ALTER COLUMN "subjectId" SET NOT NULL;

-- DropIndex
DROP INDEX "SegmentMember_segmentationRuleId_leadId_key";

-- DropIndex
DROP INDEX "AutomationEnrollment_automationId_leadId_key";

-- CreateIndex
CREATE UNIQUE INDEX "SegmentMember_segmentationRuleId_subjectType_subjectId_key" ON "SegmentMember"("segmentationRuleId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "SegmentMember_subjectType_subjectId_idx" ON "SegmentMember"("subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationEnrollment_automationId_subjectType_subjectId_key" ON "AutomationEnrollment"("automationId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "AutomationEnrollment_subjectType_subjectId_idx" ON "AutomationEnrollment"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "SegmentationRule_subjectType_idx" ON "SegmentationRule"("subjectType");

-- CreateIndex
CREATE INDEX "EmailAutomation_subjectType_idx" ON "EmailAutomation"("subjectType");

-- AddCheckConstraint: keep the denormalized contact honest. Prisma cannot model
-- CHECK constraints, so every write goes through contactLeadIdFor() in
-- src/lib/crm/subjects.ts rather than building the row by hand.
-- NOT VALID first, then VALIDATE, so the table is not held under ACCESS EXCLUSIVE
-- for the length of the scan.
ALTER TABLE "SegmentMember" ADD CONSTRAINT "SegmentMember_subject_contact_check" CHECK (
    ("subjectType" = 'Lead' AND "leadId" = "subjectId")
    OR ("subjectType" IN ('Property', 'Interest', 'Mandate'))
) NOT VALID;
ALTER TABLE "SegmentMember" VALIDATE CONSTRAINT "SegmentMember_subject_contact_check";

ALTER TABLE "AutomationEnrollment" ADD CONSTRAINT "AutomationEnrollment_subject_check" CHECK (
    "subjectType" IN ('Lead', 'Property', 'Interest', 'Mandate')
    AND ("subjectType" <> 'Lead' OR "leadId" = "subjectId")
) NOT VALID;
ALTER TABLE "AutomationEnrollment" VALIDATE CONSTRAINT "AutomationEnrollment_subject_check";
