# Normalise email addresses to lowercase

Lowercases `User.email`, `VerificationToken.identifier` and `Invitation.email`.

## Before you apply

### 1. Deploy the application code first

The code that matches emails case-insensitively (`findUserByEmail` in
`src/lib/api/user.ts`, used by login, Google sign-in, registration and email
verification) must be **live** before this migration runs. It is safe against
both a normalised and an un-normalised database. The reverse is not: applying
this against the old exact-match code locks out anyone whose address is stored
with capitals but who types it the same way at login.

Sanity check before migrating: log in as an account whose address has capital
letters.

### 2. Check for case-variant duplicate users

The migration **aborts without changing anything** if two `User` rows differ
only in case (`User.email` is unique, so lowercasing both would collide).
Find them first:

```sql
SELECT lower("email") AS normalized,
       count(*)                    AS accounts,
       array_agg("id"    ORDER BY "createdAt") AS ids,
       array_agg("email" ORDER BY "createdAt") AS emails,
       array_agg("createdAt" ORDER BY "createdAt") AS created,
       array_agg(("password" IS NOT NULL) ORDER BY "createdAt") AS has_password
FROM "User"
GROUP BY lower("email")
HAVING count(*) > 1;
```

Zero rows means you can apply the migration. Expect 0-2 groups at most: the
only code path that could create a twin was Google sign-in
(`src/lib/auth.ts`), which used an exact-match lookup before creating a user
along with its own workspace and "Getting Started" page.

## Resolving duplicates (manual, on purpose)

This is not automated because `User` is referenced by dozens of tables and the
right survivor is a judgement call.

**Pick the survivor:** the row with a non-null `password` if only one has
one, otherwise the oldest `createdAt` (this is also the row `findUserByEmail`
already resolves to). Call it `keep`; the other is `drop`.

**List every table that points at `User`** so none is missed:

```sql
SELECT conrelid::regclass AS table_name, a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
WHERE c.contype = 'f' AND c.confrelid = '"User"'::regclass
ORDER BY 1, 2;
```

For each row returned, re-point `drop` to `keep`:

```sql
UPDATE "<table>" SET "<column>" = '<keep id>' WHERE "<column>" = '<drop id>';
```

Two things need care:

- **`WorkspaceMember`** is unique on `(workspaceId, userId)`. If both accounts
  are members of the same workspace, delete the `drop` row instead of
  re-pointing it.
- The dropped account's auto-created **"My Workspace"** (and its
  "Getting Started" page) is almost always empty and safe to delete, and
  `Workspace` deletes cascade to its pages. Look before you delete it.

Then delete the `drop` user, re-run the query above (expect zero rows), and
apply the migration.

## Applying

```bash
npx prisma migrate deploy
```

If it aborts on the duplicate check the database is unchanged, but Prisma
records the migration as failed. Once the duplicates are resolved:

```bash
npx prisma migrate resolve --rolled-back 20260926000000_normalize_user_email
npx prisma migrate deploy
```

## Why there is no CHECK constraint

`CHECK (email = lower(email))` would enforce this at the database, but Prisma
does not model CHECK constraints, so it would show as schema drift on every
`migrate dev`. The write sites (`normalizeEmail` in `src/lib/email/normalize.ts`)
are the enforcement instead.
