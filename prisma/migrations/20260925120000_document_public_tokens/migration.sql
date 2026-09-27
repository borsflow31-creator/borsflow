-- Public client links for quotes and invoices.
--
-- Both documents were readable only by an authenticated workspace member, so the
-- client a quote was sent to could not open it -- which is also why acceptedAt was
-- only ever written by conversion and rejectedAt/viewedAt were never written at all.
-- These columns hold an unguessable token that /view/{quote,invoice}/[token] resolves.
--
-- Hand-authored on purpose. No migration in this directory ever created Quote,
-- Invoice, InvoiceItem, InvoiceNote or Payment -- those tables exist only from an
-- earlier `prisma db push` -- so letting `migrate dev` autogenerate against this
-- schema would see the whole set as missing and propose creating (or dropping and
-- recreating) them. This file therefore contains only the additive ALTER TABLEs.

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "publicToken" TEXT,
                    ADD COLUMN "publicTokenCreatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "publicToken" TEXT,
                      ADD COLUMN "publicTokenCreatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_publicToken_key" ON "Quote"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_publicToken_key" ON "Invoice"("publicToken");
