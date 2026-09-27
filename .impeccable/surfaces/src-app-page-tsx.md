---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/components/landing"]
---

## Scope

The public landing page at `/` (`src/app/page.tsx` + `src/components/landing/`). Visitor mode: Persuade. The signed-in app is out of scope.

## Audience and job

A sales team lead at an SMB of 3-20 people, evaluating whether one workspace can replace the five tools their team currently stitches together. They care about pipeline visibility, a shared workspace, roles, and inviting the team. Action: start a free workspace (`/register`).

## Proof and constraints

The product itself only. No customers, metrics, logos, compliance claims, uptime figures, latency figures, or pricing: no subscription system exists in the codebase, and every previously shipped testimonial and statistic was invented. Demonstration data is authored and labelled as sample. Name "BorsFlow" and the `Layers` mark are fixed.

## Direction contract

THESIS: One demonstration surface, revisited at depth, replaces six competing mock renditions. Refuses the SaaS-landing default of stacking equal-weight feature cards until the page feels substantial by length.

OWN-WORLD: Obsidian ground (`--n-base` #0a0b0e) with one full-bleed movement lifted to `--n-surface`; hairline rgba(255,255,255,.08) borders; `.taste-plinth` at 1.25rem radius; one emerald accent routed through `var(--n-emerald)`; Albert Sans display, DM Sans body, JetBrains Mono for data and measurement only; cubic-bezier(0.16, 1, 0.3, 1) as the single easing.

STORY: The visitor understands that documents, pipeline, quotes, invoices, email and scheduling sit on one database with real roles; believes it because the page lets them operate the thing; starts a free workspace.

FIRST VIEWPORT: One headline at display scale on a tight measure, one subhead, one primary action left-aligned with a secondary beside it, then the Workbench filling the majority of the fold as a real interactive object captioned as a live demo on sample data. Trust row sits below the Workbench, not above it.

FORM: Refinement of the incumbent obsidian/emerald system; position 1 of 1 on the ordered list because the user confirmed refine scope, so no direction round was run and there is no seed key.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Memorable moment

The four-stage journey's advance is the page's one authored motion moment: the stage rail fills, the detail plate resolves from blur, and the document numbers advance lead -> scope -> quote -> paid. Every other section enters at rest.

## Amendments

OWN-WORLD's full-bleed movement was recorded pre-build as #07080a and amended
AFTER the build to `--n-surface`, to match what shipped. The amendment describes
the artifact rather than constraining it, so it carries no authority to fail a
future build; treat the lifted surface as the recorded decision from here.

## Unresolved

Legal pages (privacy, terms) do not exist; footer links to them are removed rather than stubbed. No social accounts confirmed.
