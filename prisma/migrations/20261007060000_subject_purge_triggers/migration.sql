-- Sweep segment memberships and automation enrollments when their subject is deleted.
--
-- SegmentMember and AutomationEnrollment identify their subject by
-- (subjectType, subjectId). That pair is polymorphic, so it cannot carry a foreign
-- key, and deleting a Property, Interest or Mandate would leave orphaned rows
-- behind: a campaign could resolve a segment to a subject that no longer exists,
-- and an enrollment could stay "active" forever.
--
-- The leadId foreign key already cascades when a contact is deleted, so Lead
-- subjects are covered. These triggers cover the other three, whose deletion does
-- not touch the contact.
--
-- Statement-level with a transition table, not per-row, so a bulk delete or a
-- cascade from a workspace is two DELETEs in total rather than two per row. The
-- (subjectType, subjectId) indexes from 20261007010000_subject_typed_criteria make
-- those deletes index-driven.
--
-- THESE TRIGGERS ARE INVISIBLE TO PRISMA. Nothing in schema.prisma shows them, and
-- `prisma migrate reset` recreates them only because this migration exists. The
-- orphan-purge verification scenario fails if they go missing.
--
-- Safe on a live database: metadata only (CREATE TRIGGER briefly takes a lock on
-- the subject table). Rollback: DROP TRIGGER "Property_purge_subject" ON "Property";
-- DROP TRIGGER "Interest_purge_subject" ON "Interest"; DROP TRIGGER
-- "Mandate_purge_subject" ON "Mandate"; DROP FUNCTION "public"."crm_purge_subject"();

CREATE OR REPLACE FUNCTION "public"."crm_purge_subject"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM "SegmentMember" sm
    USING deleted d
    WHERE sm."subjectType" = TG_ARGV[0] AND sm."subjectId" = d."id";

  DELETE FROM "AutomationEnrollment" ae
    USING deleted d
    WHERE ae."subjectType" = TG_ARGV[0] AND ae."subjectId" = d."id";

  RETURN NULL;
END;
$$;

CREATE TRIGGER "Property_purge_subject"
  AFTER DELETE ON "Property"
  REFERENCING OLD TABLE AS deleted
  FOR EACH STATEMENT
  EXECUTE FUNCTION "public"."crm_purge_subject"('Property');

CREATE TRIGGER "Interest_purge_subject"
  AFTER DELETE ON "Interest"
  REFERENCING OLD TABLE AS deleted
  FOR EACH STATEMENT
  EXECUTE FUNCTION "public"."crm_purge_subject"('Interest');

CREATE TRIGGER "Mandate_purge_subject"
  AFTER DELETE ON "Mandate"
  REFERENCING OLD TABLE AS deleted
  FOR EACH STATEMENT
  EXECUTE FUNCTION "public"."crm_purge_subject"('Mandate');
