-- Give every existing workspace the three boards the product now assumes.
--
--   Contacts        (Lead)      enquiries not yet attached to a property
--   Buyer journey   (Interest)  one buyer's journey on one property
--   Owner / mandate (Property)  the owner-acquisition funnel
--
-- New workspaces get the same three from ensureDefaultPipelines() in
-- src/lib/services/pipelines.ts, which is what keeps "every workspace has these
-- boards" true going forward; this migration makes it true for the workspaces that
-- already exist.
--
-- Idempotent, and it never touches a board an agency already has: each subject
-- type is only added where the workspace has no pipeline of that type, so a
-- workspace that already runs its own lead pipeline keeps it and only gains the
-- two new boards. Existing leads are untouched: they stay on their pipeline, and
-- Lead.stage remains the enquiry-qualification state before a property is attached.
--
-- Stage names are workspace data, like Pipeline.name, so they are stored in English
-- and are not i18n keys: an agency renames them freely, and translating them would
-- desync the stored stage from the board column that is keyed on it.
--
-- Ids are gen_random_uuid()::text rather than cuids: SQL cannot mint a cuid, the
-- column is TEXT, and nothing parses an id's shape.
--
-- Safe on a live database (inserts only). Rollback: delete the seeded pipelines
-- that have no children, e.g.
--   DELETE FROM "Pipeline" p WHERE p."subjectType" IN ('Interest', 'Property')
--     AND NOT EXISTS (SELECT 1 FROM "Interest" i WHERE i."pipelineId" = p."id")
--     AND NOT EXISTS (SELECT 1 FROM "Property" pr WHERE pr."pipelineId" = p."id");
-- Never delete a pipeline that has children: Lead and Interest cascade from it.

INSERT INTO "Pipeline" ("id", "name", "workspaceId", "order", "stages", "subjectType", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  v."name",
  w."id",
  COALESCE((SELECT MAX(p."order") FROM "Pipeline" p WHERE p."workspaceId" = w."id"), -1) + v."ord",
  v."stages",
  v."subjectType",
  NOW(),
  NOW()
FROM "Workspace" w
CROSS JOIN (VALUES
  ('Contacts',        1, '["New","Contacted","Qualified","Nurturing","Lost"]',                                                              'Lead'),
  ('Buyer journey',   2, '["Enquiry","Qualified","Brief recorded","Viewing booked","Viewing done","Offer","Under contract","Closed"]',      'Interest'),
  ('Owner / mandate', 3, '["Prospect","Valuation booked","Valuation done","Mandate signed","Live","Under offer","Sold"]',                  'Property')
) AS v("name", "ord", "stages", "subjectType")
WHERE NOT EXISTS (
  SELECT 1 FROM "Pipeline" p
  WHERE p."workspaceId" = w."id" AND p."subjectType" = v."subjectType"
);
