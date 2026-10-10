-- ProgramMedia_programId_idx was created by an early `prisma db push`, before the
-- developer tables had a migration, and the schema never declared it. The index
-- on ("programId", "position") already serves every lookup by programId, so this
-- one only cost writes. Dropping it makes the database match schema.prisma.
DROP INDEX IF EXISTS "public"."ProgramMedia_programId_idx";
