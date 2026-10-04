-- Enable row-level security on the tables added after 20260928000000_enable_rls.
--
-- That migration turned RLS on for every table then in the public schema and
-- documented the rule: "Any table added by a later migration must enable RLS in
-- that migration too." Five tables were added afterwards without it, so the
-- Supabase anon and authenticated roles could read and write them through
-- PostgREST:
--   ChannelMember, ChannelRead, MessageReaction  (20261002000000_chat_overhaul)
--   ProductCustomField                           (20261003000000_product_custom_fields)
--   LeadFile                                     (20261004000000_lead_files)
--
-- As elsewhere, RLS is enabled with no policies: those roles are then denied
-- every row, while Prisma connects as postgres, which owns these tables and has
-- BYPASSRLS, so the application is unaffected.

ALTER TABLE "public"."ChannelMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ChannelRead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MessageReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ProductCustomField" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LeadFile" ENABLE ROW LEVEL SECURITY;
