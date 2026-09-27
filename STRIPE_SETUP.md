# Stripe Setup Guide

## Problem

The previous implementation used **Stripe Connect Express accounts**, which requires enrolling your Stripe account at https://dashboard.stripe.com/connect. Without enrollment, creating Express accounts throws:

```
StripeInvalidRequestError: You can only create new accounts if you've signed up for Connect
```

## Solution: Direct API Keys per Workspace

Each workspace owner can now enter their own Stripe API keys directly in **Settings → Integrations → Payments**. Keys are stored encrypted in the database using AES-256-CBC.

---

## How to Configure

1. Go to **Settings → Integrations**
2. Scroll to the **Payments — Stripe Keys** section
3. Enter your:
   - **Secret Key** — starts with `sk_live_` or `sk_test_`
   - **Publishable Key** — starts with `pk_live_` or `pk_test_`
4. Click **Save Keys**

Keys are stored encrypted. The UI only shows the last 4 characters of the secret key as confirmation.

---

## Where to Get Your Keys

1. Log in to https://dashboard.stripe.com
2. Go to **Developers → API Keys**
3. Copy your **Secret key** (revealed once — keep it safe) and **Publishable key**

For test mode, use keys starting with `sk_test_` / `pk_test_`.  
For production, use keys starting with `sk_live_` / `pk_live_`.

---

## Architecture

### Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `stripeSecretKey` (encrypted) and `stripePublishableKey` to `Workspace` model |
| `prisma/migrations/20260408120000_add_workspace_stripe_keys/migration.sql` | SQL migration for new columns |
| `src/lib/stripe.ts` | Added `getStripeForWorkspace()` — returns a Stripe client using workspace keys. Updated `createInvoicePaymentLink`, `getOrCreateCustomer`, `deactivatePaymentLink` to accept optional `stripeClient` param |
| `src/app/api/stripe/settings/route.ts` | New: `GET` returns masked key info; `POST` saves/clears keys (encrypted) |
| `src/app/api/invoices/[id]/payment-link/route.ts` | Now tries workspace direct keys first, falls back to legacy Connect account |
| `src/app/settings/page.tsx` | Replaced Connect onboarding UI with key entry form (secret + publishable) |

### Key Security

- Secret keys are encrypted with **AES-256-CBC** before being stored in the database
- The encryption key is `ENCRYPTION_KEY` in `.env`
- The API never returns the full secret key — only the last 4 characters for UI confirmation
- Publishable keys are stored as plaintext (they are public by design)

### Fallback Behavior

If a workspace has no direct keys configured but has a legacy Connect account, the system falls back to Connect mode. Both modes are supported simultaneously.

---

## ENV Variables (Platform-level defaults)

These env vars are used as platform defaults if no workspace-specific keys are set:

```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PLATFORM_FEE_PERCENT=0
ENCRYPTION_KEY=<32-byte hex string>
```

To generate a strong `ENCRYPTION_KEY`:
```bash
node -e "require('crypto').randomBytes(32).toString('hex')"
```

---

## Running the Migration

```bash
npx prisma migrate deploy
# or for dev:
npx prisma migrate dev --name add_workspace_stripe_keys
```
