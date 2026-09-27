-- Normalise email addresses to lowercase.
--
-- DEPLOY ORDER: the application code that reads emails case-insensitively
-- (src/lib/api/user.ts, findUserByEmail) MUST be live before this runs. With
-- the old exact-match code, lowercasing "Bob@x.com" here would lock Bob out of
-- a login he types as "Bob@x.com".
--
-- Read the sibling README.md first and run its pre-flight query.

-- 1. Refuse before touching anything if two users differ only in case.
--    User.email is unique, so lowercasing both would collide; merging them is a
--    judgement call about which account to keep and is deliberately manual.
DO $$
DECLARE
  dupes integer;
BEGIN
  SELECT count(*) INTO dupes
  FROM (
    SELECT lower("email")
    FROM "User"
    GROUP BY lower("email")
    HAVING count(*) > 1
  ) d;

  IF dupes > 0 THEN
    RAISE EXCEPTION
      'Cannot normalise emails: % case-variant duplicate group(s) exist in "User". Merge them first - see this migration''s README.md.',
      dupes;
  END IF;
END $$;

-- 2. User.email
UPDATE "User" SET "email" = lower("email") WHERE "email" <> lower("email");

-- 3. VerificationToken.identifier is value-joined to User.email (no foreign key),
--    so it has to move in lockstep or in-flight verification links stop matching.
UPDATE "VerificationToken" SET "identifier" = lower("identifier")
WHERE "identifier" <> lower("identifier");

-- 4. Invitation.email. Invitations have always been written lowercase, so this
--    is normally a no-op; the delete guards @@unique([workspaceId, email]) in
--    case a case-variant pair slipped in, keeping the newer row.
DELETE FROM "Invitation" a
USING "Invitation" b
WHERE a."workspaceId" = b."workspaceId"
  AND lower(a."email") = lower(b."email")
  AND a."id" <> b."id"
  AND (a."createdAt", a."id") < (b."createdAt", b."id");

UPDATE "Invitation" SET "email" = lower("email") WHERE "email" <> lower("email");
