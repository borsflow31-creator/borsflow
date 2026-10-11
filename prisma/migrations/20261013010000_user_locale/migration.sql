-- The language a person chose at sign-up or in the app, for their emails.
ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "locale" TEXT;
