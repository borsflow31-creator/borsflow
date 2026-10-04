# Context

You asked for your feature request to be rewritten against this platform's real shape, not implemented. The original prompt — *"users can create forms that capture leads automatically into the segmentation, and convert the CRM/products into a real estate CRM, but optional"* — is directionally right but underspecified in three ways an implementing agent would guess wrong on:

1. **"capture into the segmentation"** is ambiguous. This codebase has no contact/subscriber table. Segments (`SegmentationRule`) are *derived*: criteria JSON evaluated against `Lead` rows by `emailSegmentationService.matchesCriteria`, materialised into `SegmentMember`. So a form must create a **Lead**, and segment membership follows for free — nothing new to invent.
2. **"convert into a real estate CRM"** reads as a fork. What you actually want (confirmed) is a reversible, workspace-level **preset** over the existing models.
3. The prompt names no existing code, so an agent would rebuild things that already exist: `createLead`, the `lead_created` automation trigger, the `publicToken` public-view pattern, the `ProductCustomField` custom-field system, plan/usage gating.

Below is the rewritten prompt. Paste it as-is to start implementation.

---

# The improved prompt

> **Written for:** an implementation agent (a future Claude Code session) working in this repo.

## Feature: Lead-capture forms + an optional real-estate preset

Two related features for BorsFlow (Next.js App Router + Prisma, workspace-scoped multi-tenant, i18n via `src/i18n/` with `[lang]` routes).

### Part 1 — Lead-capture forms

Let a workspace build a form, publish it at a public URL, and have every submission land as a `Lead` that flows into the existing CRM, segmentation, and email-automation machinery.

**Requirements**

- A form belongs to a workspace and targets **one pipeline + starting stage**, with optional default `source`, `tags`, and `LeadList` membership.
- Field schema is workspace-authored: label, type, required flag, order. Each field either **maps to a built-in `Lead` column** (`firstName`, `lastName`, `email`, `phone`, `company`, `position`, `value`, `notes`) or to a **custom lead field** (see Part 1b).
- Public rendering + submission must be unauthenticated and must not leak workspace data.
- A submission creates the `Lead`, logs CRM activity, fires existing automations, and refreshes affected segments — in that order, and without the form-owner having to configure anything beyond the form.
- Per-form submission counters, and a "view submissions" surface that reaches the created lead.
- A form can be deactivated; a deactivated or deleted form's public URL stops accepting submissions with a clear message, not a 500.

**Reuse these — do not reimplement**

| Need | Existing code |
| --- | --- |
| Lead creation (stage defaulting, lead-list validation, `value` parsing, order) | `createLead` in [src/lib/services/leads.ts](src/lib/services/leads.ts) |
| CRM activity feed entry | `CrmLogger.logLeadCreated` in [src/lib/crm/logger.ts](src/lib/crm/logger.ts) |
| Automation entry on new lead | the `lead_created` `AutomationTrigger` type; engine in [src/lib/automation-engine.ts](src/lib/automation-engine.ts) |
| Segment recomputation | `emailSegmentationService` in [src/lib/email-segmentation.ts](src/lib/email-segmentation.ts) — `calculateSegmentSize` materialises `SegmentMember`; `refreshWorkspaceSegments` does the whole workspace |
| Public, tokenised, unauthenticated access | the `publicToken` / `publicTokenCreatedAt` pattern on `Quote`/`Invoice` ([prisma/schema.prisma:531](prisma/schema.prisma#L531)), served by [src/app/api/public/quotes/[token]/route.ts](src/app/api/public/quotes/[token]/route.ts) and rendered at [src/app/view/quote/[token]/page.tsx](src/app/view/quote/[token]/page.tsx) |
| Plan gating + quotas | `getWorkspacePlan`, `consumeUsage`, `planLimitResponse`, `usageLimitResponse` in [src/lib/billing/entitlements.ts](src/lib/billing/entitlements.ts) |
| Rate limiting | the `RateLimitEvent` model and its existing callers |

**Decisions to make explicitly (and state in your plan before coding)**

- **Submission storage.** Keep the raw submission payload alongside the lead, or write only the lead? Recommended: store the raw payload — it survives field-schema edits and lets you re-map later.
- **Dedupe.** Two submissions with the same email in the same pipeline: new lead, or update the existing one? Note `Lead.email` is indexed but **not** unique.
- **Segment refresh cost.** `refreshWorkspaceSegments` recalculates every rule in the workspace. On a per-submission path that is too heavy — scope it to rules whose criteria could match, or move it off the request.
- **Anti-abuse.** A public POST that writes rows needs a honeypot or captcha, per-IP rate limiting, and a payload size cap. Decide which, and where the limit lives.
- **Consent.** If a form collects email for marketing, reconcile with `EmailUnsubscribe` / `EmailSuppression` — a lead captured from a form must not resurrect a suppressed address.
- **Criteria exposure.** For segments to target "came from form X", `source` alone may be too coarse. Decide whether to add a form-aware criteria field to the evaluator and to the field list in [src/components/email-marketing/SegmentModal.tsx:55-67](src/components/email-marketing/SegmentModal.tsx#L55-L67).

### Part 1b — Custom fields on Lead

`Lead` currently has **fixed columns only** — no `customFields`. `Product` already solves this exact problem: a per-workspace `ProductCustomField` definition table (`key`/`label`/`type`/`position`, key immutable once created) plus a `Product.customFields` JSON column, with validation and coercion shared by API and UI in [src/lib/product-custom-fields.ts](src/lib/product-custom-fields.ts).

Mirror that pattern for leads. Reuse the coercion logic (`coerceCustomValue`, `sanitizeCustomFields`, `toFieldKey`, `guessFieldType`) rather than writing a second, divergent validator — generalise it if needed. Custom lead fields are the mechanism both for arbitrary form questions and for the real-estate preset, so build them once, here.

Make custom lead fields addressable from segment criteria (the evaluator's `getFieldValue` already walks dotted paths, so `customFields.budget` works if the lead object carries it).

### Part 2 — Optional real-estate preset

A workspace-level **vertical** setting, default off/generic. Turning it on must not change the data model, must be reversible, and must leave generic workspaces byte-identical in behaviour.

**What the preset does when enabled**

- **Relabels** existing surfaces through i18n: Leads → *Clients/Prospects*, Products → *Properties/Listings*, Deal value → *Budget*, Quote → *Offer/Mandate* (your naming call). Labels only — route names, model names, and API shapes stay as they are.
- **Seeds** real-estate pipeline stages on new pipelines (e.g. Enquiry → Qualified → Viewing booked → Viewing done → Offer → Under contract → Closed) instead of the generic default, and seeds a matching set of custom lead/product field definitions (budget, bedrooms, surface, city/area, property type, transaction side buy/rent/sell).
- **Shows** those seeded fields in the lead and product forms and tables — which they already will, if Part 1b reuses the `ProductCustomField` rendering path.

**Hard constraints**

- One source of truth for the vertical: a column on `Workspace` (alongside `currency` at [prisma/schema.prisma:133](prisma/schema.prisma#L133)), not a user preference and not a build flag.
- **No conditional business logic keyed on the vertical.** If a code path needs `if (vertical === 'real_estate')` to behave correctly, the preset is leaking into the model — push the difference into seeded data or i18n instead.
- Switching the vertical off must not delete data. Seeded custom fields stay; only labels and future seeding revert.
- Every new string goes through the existing i18n catalogs for all supported languages — see [src/i18n/](src/i18n/) and the `[lang]` routes under [src/app/[lang]/](src/app/[lang]/). The repo is mid-i18n-refactor (see `git status`), so follow the pattern on `main`-adjacent files, not the older ones.

### Deliverable

Before writing code: a plan naming the schema migration, the new API routes, the public page, the components, the i18n keys, and how you will verify the whole path end to end — form built in the app → submitted from the public URL → lead visible on the pipeline board → lead present in a matching segment → automation enrolled.

---

# Notes on what changed and why

- **Removed the word "convert."** Your original phrasing invites a fork of CRM and Products. The preset framing keeps one codebase and makes "optional" structural rather than a flag sprinkled through business logic — that's what the "no conditional business logic" constraint enforces.
- **Named the missing primitive.** "Forms capture leads into segmentation" quietly requires custom fields on `Lead`, which don't exist. That's the single largest piece of work hiding in your prompt, and it's also what makes the real-estate preset cheap — so the rewritten prompt pulls it out as its own part and points at `ProductCustomField` as the template.
- **Pointed at the public-token pattern.** Without it an agent would likely invent a new auth story for the public form endpoint. `Quote`/`Invoice` already do unauthenticated tokenised access in this repo.
- **Surfaced the segment-refresh cost.** `refreshWorkspaceSegments` on every public submission is a performance trap worth flagging up front rather than discovering in review.
- **Added consent, dedupe, and anti-abuse.** A public write endpoint on a multi-tenant SaaS is where these become real; your prompt didn't mention them, and they change the schema.
