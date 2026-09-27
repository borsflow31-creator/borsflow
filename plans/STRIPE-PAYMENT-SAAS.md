# Implementation Plan - SaaS Subscription Billing (Stripe)

This plan outlines the integration of Stripe to monetize the SaaS platform. Workspace owners pay the platform owner (Super Admin) based on their workspace's member count and chosen billing cycle (monthly/annual).

---

## Proposed Changes

### 1. Database Schema (`prisma/schema.prisma`)

#### [MODIFY] [schema.prisma](../prisma/schema.prisma) — `Workspace` model

Add platform subscription fields alongside the existing `stripeAccountId` / `stripeAccountEnabled` (Stripe Connect) fields:

```prisma
// Platform billing (workspace owner pays the platform)
stripeCustomerId      String?  @unique  // Stripe Customer ID for the workspace owner
stripeSubscriptionId  String?  @unique  // Active subscription ID
subscriptionStatus    String?           // 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
planId                String?           // 'free' | 'pro'
billingCycle          String?           // 'monthly' | 'annual'
currentPeriodEnd      DateTime?         // When current billing period ends
trialEndsAt           DateTime?         // When trial expires
```

> Note: Keep separate from the existing `stripeAccountId` (Stripe Connect for workspace-level payments). These new fields are for **platform billing only**.

#### [NEW] `SubscriptionEvent` model — webhook idempotency

```prisma
model SubscriptionEvent {
  id        String   @id @default(cuid())
  stripeId  String   @unique  // Stripe event ID (evt_...)
  type      String
  status    String   @default("pending")  // 'pending' | 'processed' | 'failed'
  createdAt DateTime @default(now())
}
```

---

### 2. Billing Configuration (`src/config/billing.ts`)

#### [NEW] [billing.ts](../src/config/billing.ts)

Single source of truth for all plan/pricing logic:

```ts
export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    memberLimit: 3,         // max members per workspace
    workspaceLimit: 1,      // max workspaces the owner can create
    features: ['Pages', 'Kanban', 'Pipelines'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    memberLimit: Infinity,
    workspaceLimit: Infinity,
    features: ['Everything in Free', 'Email Marketing', 'Scheduling', 'Invoices', 'Priority Support'],
  },
}

export const PRICES = {
  pro: {
    monthly: { basePrice: 15_00, perSeat: 5_00 },  // in cents
    annual:  { basePrice: 12_00, perSeat: 4_00 },
  },
}

// Map to Stripe Price IDs (set these from env or directly)
export const STRIPE_PRICE_IDS = {
  pro_monthly_base: process.env.STRIPE_PRICE_PRO_MONTHLY_BASE!,
  pro_monthly_seat: process.env.STRIPE_PRICE_PRO_MONTHLY_SEAT!,
  pro_annual_base:  process.env.STRIPE_PRICE_PRO_ANNUAL_BASE!,
  pro_annual_seat:  process.env.STRIPE_PRICE_PRO_ANNUAL_SEAT!,
}

export const TRIAL_PERIOD_DAYS = 14
```

---

### 3. Stripe Infrastructure (`src/lib/stripe-platform.ts`)

#### [NEW] [stripe-platform.ts](../src/lib/stripe-platform.ts)

Centralizes all Stripe API calls used by the platform billing layer:

- **`getOrCreateStripeCustomer(workspaceId)`** — looks up `stripeCustomerId` on the workspace; creates one in Stripe if absent and persists it.
- **`createCheckoutSession({ workspaceId, planId, cycle, seatCount, successUrl, cancelUrl })`** — creates a Stripe Checkout Session with a base price item + a metered/quantity seat item.
- **`createBillingPortalSession(stripeCustomerId, returnUrl)`** — opens the Stripe Customer Portal.
- **`syncSubscriptionToDb(subscription)`** — maps a Stripe `Subscription` object to the Workspace fields and upserts via Prisma. Used by webhooks.
- **`syncSubscriptionQuantity(workspaceId)`** — counts `WorkspaceMember` rows for the workspace and updates the Stripe subscription item quantity.

```ts
import Stripe from 'stripe'
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' })
```

---

### 4. API Endpoints

#### [NEW] [billing/checkout/route.ts](../src/app/api/billing/checkout/route.ts)

```
POST /api/billing/checkout
Body: { planId: 'pro', cycle: 'monthly' | 'annual' }
```

- Auth-guards to workspace owner only.
- Reads current `WorkspaceMember` count for initial seat quantity.
- Creates Checkout Session via `stripe-platform.ts`.
- Returns `{ url }` — the client redirects to it.

#### [NEW] [billing/portal/route.ts](../src/app/api/billing/portal/route.ts)

```
POST /api/billing/portal
Body: { returnUrl: string }
```

- Auth-guards to workspace owner only.
- Calls `createBillingPortalSession`.
- Returns `{ url }`.

#### [NEW] [webhooks/stripe/platform/route.ts](../src/app/api/webhooks/stripe/platform/route.ts)

```
POST /api/webhooks/stripe/platform
```

Handles (at minimum):

| Stripe Event | Action |
|---|---|
| `checkout.session.completed` | Write `stripeSubscriptionId` + initial status to workspace |
| `customer.subscription.updated` | Call `syncSubscriptionToDb` |
| `customer.subscription.deleted` | Set `subscriptionStatus = 'canceled'` |
| `invoice.payment_succeeded` | Refresh `subscriptionStatus = 'active'`, update `currentPeriodEnd` |
| `invoice.payment_failed` | Set `subscriptionStatus = 'past_due'`, optionally notify owner |

**Idempotency**: Before processing, insert into `SubscriptionEvent` with `status: 'pending'`. If insert fails (duplicate `stripeId`), skip. On success set `status: 'processed'`.

**Signature verification**: Always verify with `stripe.webhooks.constructEvent` using `STRIPE_WEBHOOK_SECRET`.

> Important: This webhook route must be excluded from CSRF/body-parsing middleware. Use `export const config = { api: { bodyParser: false } }` (or the Next.js 13 App Router equivalent: read raw body via `request.text()`).

---

### 5. Billing Enforcement Middleware / Helpers (`src/lib/billing-guards.ts`)

#### [NEW] [billing-guards.ts](../src/lib/billing-guards.ts)

Reusable guard functions called from existing API routes:

- **`canInviteMember(workspaceId)`** — returns `true` if `subscriptionStatus` is `active` or `trialing`, AND current member count is below plan limit.
- **`canCreateWorkspace(userId)`** — checks how many workspaces the user already owns against `PLANS[planId].workspaceLimit`.

These should be thin — just read from DB, no Stripe API calls on the hot path.

---

### 6. Billing Logic Synchronization

#### [MODIFY] [invitations/[id]/accept/route.ts](../src/app/api/invitations/[id]/accept/route.ts)

After `prisma.workspaceMember.create(...)` succeeds, call `syncSubscriptionQuantity(workspaceId)` in the background (fire-and-forget with error logging, do not block the response).

Also add a pre-check using `canInviteMember(workspaceId)` **in the invite-send endpoint** ([workspaces/[id]/invitations/route.ts](../src/app/api/workspaces/[id]/invitations/route.ts)) — block new invitations if the workspace is `past_due` or `canceled`.

#### [MODIFY] [workspaces/[id]/members/[memberId]/route.ts](../src/app/api/workspaces/[id]/members/[memberId]/route.ts)

After `prisma.workspaceMember.delete(...)` in the `DELETE` handler, call `syncSubscriptionQuantity(workspaceId)` (fire-and-forget).

---

### 7. Management UI

#### [NEW] [settings/billing/page.tsx](../src/app/(dashboard)/[workspaceId]/settings/billing/page.tsx)

Visible to workspace **owner** only. Layout:

```
┌─────────────────────────────────────────────────┐
│  Current Plan: Pro (Monthly)         [Manage]   │
│  Status: Active   Renews: Apr 30, 2026          │
│  Seats: 5 used · $15 base + 4 × $5 = $35/mo    │
├─────────────────────────────────────────────────┤
│  Plan Cards                                      │
│  [ Free  ]  [ Pro — toggle Monthly / Annual ]   │
│                                                  │
│  [  Upgrade to Pro  ]                            │
└─────────────────────────────────────────────────┘
```

- Fetches workspace subscription data from a server component (no separate API call needed).
- "Manage" button calls `POST /api/billing/portal` and redirects.
- "Upgrade" button calls `POST /api/billing/checkout` and redirects.
- Show a warning banner at the top of all workspace pages when `subscriptionStatus === 'past_due'`.

---

## Open Questions

> [!IMPORTANT]
> 1. **Proration on seat changes**: Should Stripe bill immediately for added seats mid-cycle (default Stripe behavior), or prorate at next billing date? Recommendation: keep Stripe default (immediate) — simpler and expected by users.
> 2. **Invite gate**: Block invite-sending (not just acceptance) when `past_due` or `canceled`? Recommended: yes, gate at send time via `canInviteMember`.
> 3. **Trial behavior**: Should the Free plan get an auto-trial of Pro on signup, or start Free immediately? Affects `TRIAL_PERIOD_DAYS` usage.
> 4. **Owner workspace limit on downgrade**: If an owner cancels Pro and has 2 workspaces, should extra workspaces be locked (read-only) or require manual deletion?
> 5. **Super Admin revenue dashboard**: Use native Stripe Dashboard, or build a `/admin` page in-app? Recommendation: Stripe Dashboard for now — avoids scope creep.

---

## Environment Variables

Add to `.env`:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY_BASE=price_...
STRIPE_PRICE_PRO_MONTHLY_SEAT=price_...
STRIPE_PRICE_PRO_ANNUAL_BASE=price_...
STRIPE_PRICE_PRO_ANNUAL_SEAT=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## Implementation Order

1. `prisma/schema.prisma` — add fields + `SubscriptionEvent` model, run `prisma migrate dev`
2. `src/config/billing.ts` — plan/price config
3. `src/lib/stripe-platform.ts` — Stripe client + helpers
4. `src/lib/billing-guards.ts` — enforcement helpers
5. Webhook endpoint — critical, test with `stripe listen --forward-to localhost:3000/api/webhooks/stripe/platform`
6. Checkout + portal endpoints
7. Modify `accept` + `delete member` routes
8. Billing UI page + past-due banner

---

## Verification Plan

### With `stripe-cli`

```bash
# Install and login
stripe login

# Forward webhooks locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe/platform

# Trigger individual events
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

### Manual flow tests

1. **Upgrade to Pro**: Create workspace → go to Billing → click Upgrade → complete Stripe test checkout → confirm `subscriptionStatus = 'active'` in DB.
2. **Seat sync on invite**: Invite 2 users → accept both → confirm Stripe subscription quantity incremented by 2.
3. **Seat sync on remove**: Remove 1 member → confirm Stripe quantity decremented.
4. **Past-due gate**: Use Stripe test card `4000 0000 0000 0341` to trigger payment failure → confirm invite button is disabled in UI.
5. **Cancel flow**: Cancel via Portal → confirm workspace `subscriptionStatus = 'canceled'` → confirm invite is blocked.
6. **Annual discount**: Upgrade with Annual toggle → confirm correct Stripe Price IDs used and UI reflects annual pricing.

### Integration tests

- `syncSubscriptionQuantity`: assert Stripe subscription item quantity equals `WorkspaceMember` count in DB after each member change.
- Webhook idempotency: send the same Stripe event ID twice → assert second is a no-op (no DB change, no error).
