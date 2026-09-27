---
name: BorsFlow Landing Surface
description: Obsidian architectural marketing surface — one emerald signal, real product captures, hairline material.
colors:
  obsidian-base: "#0a0b0e"
  obsidian-surface: "#121318"
  obsidian-elevated: "#181a20"
  obsidian-elevated-2: "#20232b"
  obsidian-text: "#f5f5f7"
  obsidian-muted: "#8b8f9e"
  obsidian-border: "rgba(255, 255, 255, 0.08)"
  obsidian-border-strong: "rgba(255, 255, 255, 0.16)"
  signal-emerald: "#10b981"
  signal-emerald-dim: "rgba(16, 185, 129, 0.12)"
  paper-base: "#f7f7fa"
  paper-surface: "#ffffff"
  paper-elevated: "#f0f1f5"
  paper-elevated-2: "#e5e7ee"
  paper-text: "#0d0e15"
  paper-muted: "#52566b"
  paper-border: "rgba(13, 14, 21, 0.08)"
  paper-border-strong: "rgba(13, 14, 21, 0.18)"
  signal-emerald-paper: "#047857"
  signal-emerald-paper-dim: "rgba(4, 120, 87, 0.10)"
typography:
  display:
    fontFamily: "Albert Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(2.25rem, 4.4vw, 4rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Albert Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(1.875rem, 3.4vw, 2.875rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  sub:
    fontFamily: "Albert Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(1.375rem, 2.1vw, 1.75rem)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Albert Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(1.0625rem, 1.5vw, 1.3125rem)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  lead:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(1rem, 1.25vw, 1.1875rem)"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.011em"
  body:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.05em"
  data:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
rounded:
  sm: "0.25rem"
  DEFAULT: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  plate-inner: "0.9rem"
  plinth: "1.25rem"
  full: "9999px"
spacing:
  row: "0.875rem"
  gutter-sm: "1.25rem"
  gutter-md: "2rem"
  gutter-lg: "2.5rem"
  card-pad: "1.5rem"
  card-pad-lg: "2rem"
  grid-gap: "1.25rem"
  block-gap: "3.5rem"
  section-y-quiet: "4rem"
  section-y-quiet-lg: "6rem"
  section-y: "6rem"
  section-y-lg: "8rem"
  field-y: "7rem"
  field-y-lg: "9rem"
components:
  button-primary:
    backgroundColor: "{colors.obsidian-text}"
    textColor: "{colors.obsidian-base}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "0.875rem 1.75rem"
  button-ghost:
    backgroundColor: "{colors.obsidian-surface}"
    textColor: "{colors.obsidian-text}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "0.875rem 1.5rem"
  button-ghost-hover:
    backgroundColor: "{colors.obsidian-elevated}"
    textColor: "{colors.obsidian-text}"
  button-on-field:
    backgroundColor: "{colors.obsidian-base}"
    textColor: "{colors.obsidian-text}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "0.875rem 1.75rem"
  card-plinth:
    backgroundColor: "{colors.obsidian-surface}"
    textColor: "{colors.obsidian-text}"
    rounded: "{rounded.plinth}"
    padding: "2rem"
  card-plate-raster:
    backgroundColor: "{colors.obsidian-elevated}"
    textColor: "{colors.obsidian-text}"
    rounded: "{rounded.plinth}"
    padding: "0.5rem"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.obsidian-muted}"
    rounded: "{rounded.full}"
    padding: "0.375rem 0.875rem"
  nav-link-hover:
    backgroundColor: "{colors.obsidian-elevated}"
    textColor: "{colors.obsidian-text}"
  chip-permission:
    backgroundColor: "{colors.signal-emerald-dim}"
    textColor: "{colors.signal-emerald}"
    rounded: "{rounded.md}"
    padding: "0.125rem 0.5rem"
  icon-button:
    backgroundColor: "{colors.obsidian-surface}"
    textColor: "{colors.obsidian-muted}"
    rounded: "{rounded.full}"
    size: "2rem"
  input-field:
    backgroundColor: "{colors.obsidian-elevated}"
    textColor: "{colors.obsidian-text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
  alert-inline:
    backgroundColor: "{colors.obsidian-elevated}"
    textColor: "{colors.obsidian-text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "1rem"
---

# Design System: BorsFlow Landing Surface

> **Scope.** This file documents two surfaces built on one system: the public landing page (`src/app/page.tsx`, `src/components/landing/*`) and the authentication pages (`src/app/login/page.tsx`, `src/app/register/page.tsx`), with tokens in `src/app/globals.css`. Auth is inside the scope because auth is where a visitor converts, and it was the seam where an emerald obsidian landing page handed off to an indigo Material-3 card; closing that gap at the conversion moment was the point. Both auth pages now carry **zero** legacy classes — no `surface-container*`, no `bg-secondary`, no `material-symbols-outlined` — render on the obsidian ground, use `.taste-plinth`, `.font-display` headings at `.t-sub`, `.taste-btn-primary` / `.taste-btn-ghost` and `--n-*` tokens throughout, and set `landing-surface` so the themed browser surfaces apply. The signed-in application **beyond auth** is not described by this file and does not currently comply with it — see *Unreconciled: the application surface* at the end of Overview. Treat this as the recorded system for public/marketing surfaces only until someone scopes a migration. No PRODUCT.md exists for this project; that absence is deliberate and disclosed, and nothing in this file is derived from one.

## Overview

**Creative North Star: "The Obsidian Architectural Plate"**

A near-black ground with almost nothing on it, and what is on it is built rather than decorated: hairline-ruled definition lists, wide plates carrying real screenshots of the running product, one emerald signal, and type that tightens as it grows. The surface is quiet at rest and earns attention through structure — where the frame breaks, where a band changes ground colour, where the column narrows — not through ornament. Nothing glows, nothing floats far, and no section content animates on entry.

Density is editorial rather than dashboard-like: a two-tier vertical rhythm that gives the opening, the mid-page colour field and the close more air than the quieter middle sections, prose clamped to a 68ch measure, and heading-plus-lead openings at a consistent 3xl-wide block. Composition deliberately varies the frame per section instead of running one identical column, and it varies the framing of the three product captures against each other: the hero capture bleeds off the right edge, the editor capture is inset in a narrower `max-w-5xl` column, the financials capture bleeds off the left edge. Ten `<section>` elements over 8,848px at 1440, with imagery landing at roughly 7%, 28% and 63% of the scroll and the two emerald fields at 36% and 88%.

The surface refuses the standard SaaS-marketing vocabulary outright. There are no kickers or eyebrows above headings, no rows of same-size icon+heading+text cards standing in for page structure, no nested cards, no gradient text, no monospace worn as a technical costume, no simulated product UI, and no pricing, testimonials, metrics, customer names, uptime or compliance claims — all of those were removed as unverifiable. Product depiction is by real capture or not at all.

**Key Characteristics:**
- Obsidian ground (#0a0b0e) with a single emerald signal; every accent routes through `var(--n-emerald)`
- Two committed emerald regions — one mid-page, one closing — kept distinct by material, not by scarcity
- Hairline-first material: 1px rules and border-separated rows carry structure, not fills
- One fluid clamp type scale with five ranks; three faces with one job each, and no alpha on text over a colour field
- The frame varies per section, and each of the three captures is framed a different way
- Real product screenshots cropped to their content, with provenance sidecars; no reconstructed interface in markup
- Three authored motion moments and one easing: `cubic-bezier(0.16, 1, 0.3, 1)`, expressed in GSAP as `CustomEase.create('obsidian', '0.16, 1, 0.3, 1')`
- The landing page and both auth pages run on the same tokens, plinth, pill and hairline vocabulary
- Hand-rolled dark/light theming, resolved before first paint

**Unreconciled: the application surface.** The signed-in app beyond auth carries an older, different vocabulary that still lives in the same stylesheet: Material-3-style tokens (`surface-container`, `on-surface-variant`, `outline-variant`), Material Symbols glyphs alongside lucide, ad-hoc per-feature modals, no shared Button component, and a **different accent colour** (indigo/violet, `--n-indigo: #4f46e5` / `--n-indigo-lt: #6366f1`). Because the landing page embeds real captures of that app, its indigo is visible on this emerald surface. This brand-coherence gap is recorded, not hidden; resolving it in either direction is unscoped future work. Do not read this file as evidence of one unified system.

## Colors

A neutral obsidian palette with exactly one chromatic voice, plus a light theme that is a full token re-map rather than an inversion.

### Primary
- **Signal Emerald** (dark `#10b981`, light `#047857`): the only chromatic colour on the surface. It appears as small affordance marks (feature icons at 20px, checkmarks at 14px, permission-matrix ticks), as the mono tool identifiers in the assistant table, as the focus ring and caret, and as the ground of two full-bleed fields — the four-stage journey mid-page and the closing call to action. The light value is emerald-700, not emerald-600, on purpose: `#059669` measured 3.6:1 on the light ground and failed AA for small text.
- **Signal Emerald Dim** (12% of the signal in dark, 10% in light): the only tinted fill on the surface — role chips in the permissions matrix, and text selection. Never a card background.

### Neutral
- **Obsidian Base** (`#0a0b0e` dark / `#f7f7fa` light): the page ground, the scrollbar track, and the text colour used *on* both emerald fields. On the fields it also draws the journey's 2px progress rule — an emerald rule on an emerald field is invisible.
- **Obsidian Surface** (`#121318` dark / `#ffffff` light): plinth interiors, and at 40% opacity the footer band.
- **Obsidian Elevated / Elevated-2** (`#181a20` / `#20232b` dark; `#f0f1f5` / `#e5e7ee` light): hover ground for nav pills and ghost buttons, and the backing of `.plate-raster` behind a dark screenshot. Elevated-2 tops the tonal ladder and is used sparingly.
- **Obsidian Text** (`#f5f5f7` dark / `#0d0e15` light): headings, emphasis rows, and the fill of the primary button — the brightest neutral *is* the button, which is why the accent does not have to be.
- **Obsidian Muted** (`#8b8f9e` dark / `#52566b` light): all body prose, secondary rows, nav at rest, footer links. Measured 6.11:1 dark and 6.77:1 light on their grounds.
- **Hairline / Hairline Strong** (8% / 16% white on dark; 8% / 18% ink on light): every rule, divider, table head and card outline. Strong is reserved for the top edge of a set, for hover on an outlined surface, and for the light-theme edge of a raster plate.

### Named Rules
**The One Signal Rule.** One chromatic hue on the whole surface, and every use of it resolves through `var(--n-emerald)`; zero hardcoded emerald utilities. If a new element needs colour to be understood, it gets the emerald or it gets a hairline — never a second hue.

**The Committed Region Rule.** The accent may own at most **two** full regions per page: one mid-page and one closing, and they must be materially unalike. The journey field is divided into four cells by `gap-px` rules — dense, interactive, hover- and focus-driven; the closing field is open, with a four-step first-run list anchoring its right half. The close still reads as the ending because of that difference, not because it is the only field. Sameness, not count, is what costs a page its ending: two fields built the same way means neither one closes.

**The No-Alpha-On-Field-Text Rule.** Text set on an emerald field is always full-opacity `--n-base`. Never an alpha step. Measured on the light emerald (`#047857`): `--n-base` at 75% gives 3.63:1 and at 85% gives 4.21:1 — both fail AA — and an `/80` step planned for the journey measured 3.92:1. At full opacity the same text measures **7.76:1 dark and 5.13:1 light** on both fields at 12px. Hierarchy on a colour field comes from size and weight. Opacity remains correct on non-text: the journey's `gap-px` divider at `/20`, its hover and focus ground at `/10`, the closing list's row rules at `/25`, and the on-field ghost button's border at `/40`.

**The Painted Colour Rule.** A region whose colour carries legibility is painted in CSS and never animated in. The journey field and the closing field are both plain painted backgrounds with no reveal of any kind. Colour at that scale has to survive with no JavaScript at all.

**The Contrast Floor Rule.** A palette value earns its place by measurement, never by making a finding disappear. Muted body measures 6.11:1 / 6.77:1; field text measures 7.76:1 / 5.13:1. A value that reads well but fails AA at its size is replaced, not excused — that is why the light emerald is a step darker than the dark one, and why the alpha steps above were deleted rather than shipped.

## Typography

**Display Font:** Albert Sans (with `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif), self-hosted via `next/font` as `--font-albert`, weights **600/700** only.
**Body Font:** DM Sans (with `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, sans-serif), `--font-dm-sans`, weights **400/500/600** only.
**Label/Mono Font:** JetBrains Mono (with `ui-monospace`, `SFMono-Regular`, `Menlo`), `--font-jetbrains`, weight **400** only, data and identifiers.

**Character:** Two closely related geometric sans faces doing different jobs — Albert Sans is tighter and more architectural at display size, DM Sans more neutral and legible at 11–19px. The pairing reads as one voice in two registers rather than a contrast pairing. Body copy runs with `tnum`, `cv02` and `cv03` enabled, so figures align inside running prose.

### Hierarchy
- **Display** (700, `clamp(2.25rem, 4.4vw, 4rem)`, lh 1.05, ls -0.04em, `text-wrap: balance`): the h1 and the closing h2 only — the open and the close. The h1 is split into two `<span class="block">` sentences, each inside an `overflow-hidden` mask, so each balances its own wrap independently and can be masked in by the opening sequence.
- **Headline** (700, `clamp(1.875rem, 3.4vw, 2.875rem)`, lh 1.1, ls -0.035em, balanced): page-level section h2s — the argument headings.
- **Sub** (600, `clamp(1.375rem, 2.1vw, 1.75rem)`, lh 1.25, ls -0.025em): the rank between headline and title. It exists because the scale previously jumped 46px straight to 21px, forcing `.t-h3` to serve as card title, column label and section-internal heading at once. Both Evidence captions use it: they are captions in a narrow column, not page-level arguments.
- **Title** (600, `clamp(1.0625rem, 1.5vw, 1.3125rem)`, lh 1.3, ls -0.02em): card h3 only. Column and set labels no longer borrow this step — they dropped out of it entirely to 12px uppercase tracked on a `border-strong` rule.
- **Lead** (400, `clamp(1rem, 1.25vw, 1.1875rem)`, lh 1.6, ls -0.011em): the one paragraph under a section heading, clamped to a 68ch measure.
- **Body** (400, 14px rising to 16px at `sm`, lh ~1.6): card prose and list bodies.
- **Label** (500, 12px, uppercase, ~0.05em tracking): column and set labels above a hairline — the feature grid's "Underneath", the comparison columns.
- **Fine** (400, 12px and 11px, lh ~1.5): definition-list rows, table cells, footer links, hero assurances. This surface does much of its work at 12px on hairlines; that density is intentional and is what keeps the page from collapsing into card rows.
- **Data** (JetBrains Mono 400, 11–12px, tabular figures, ls -0.01em): numeric and identifier content only. No weight modifier ever accompanies `font-mono` or `.t-data`.

### Named Rules
**The One Fluid Scale Rule.** Landing type uses the five clamp classes (`.t-display`, `.t-h2`, `.t-sub`, `.t-h3`, `.t-lead`) and nothing else — no ad-hoc breakpoint pairs (`text-3xl sm:text-5xl`). Steps must relate to each other, and tracking tightens as size grows. A rank is added when a real gap forces one element to do two jobs, not to give a section its own size.

**The Measure Rule.** Running prose is clamped: 68ch by default (`.measure`), 46ch in a narrow column (`.measure-tight`). Nothing on this surface sets an unbounded paragraph width — including the assistant's lead and the FAQ answers, which are wrapped in a `.measure` container rather than running the full column.

**The Mono-Earns-It Rule.** Monospace is for data, identifiers and measurement, never as a technical costume. The face now has a legitimate job: the assistant section sets a real table of the five tool identifiers and the Prisma models each queries (`search_pages`/`Page`, `get_crm_leads`/`Lead`, `get_financials`/`Quote, Invoice`, `get_meetings`/`Meeting`, `list_templates`/`UniversalTemplate`), each verified against `src/app/api/ai/chat/route.ts`. Mono usage on the surface is four: two columns of that table, the journey step numerals, and the closing list's numerals. If the data ever goes away again, the correct response is to drop the third family, never to reintroduce decorative mono.

## Layout

**Container.** `max-w-7xl` (1280px) centred, gutters `1.25rem`, `2rem` at `sm`, `2.5rem` at `lg`. The `lg` step exists because the container max equals 1280: without it, a 1280 viewport would get the smallest gutter of any size. Narrower columns are used deliberately: the editor Evidence block at `max-w-5xl`, the FAQ at `max-w-3xl`, and heading blocks inside wide sections cap at `max-w-3xl` (hero at `max-w-4xl`).

**Vertical rhythm — two tiers.** The three loud moments carry the air: hero (`pt-28 pb-16`, `sm:pt-32 sm:pb-20`), the journey field (`6rem` / `8rem`) and the closing field (`7rem` / `9rem`). Every quieter middle section runs `4rem` / `6rem`. The footer runs `4rem` top / `3rem` bottom. Inside a section: heading → lead at `1.25rem`, lead → content at `3.5rem`, hairline rows at `0.875rem` vertical, card interiors at `1.5rem` rising to `2rem`, grid gaps at `1.25rem` for cards and `2rem`–`3.5rem` for editorial pairs. Ten `<section>` elements; 8,848px document height at 1440. Recorded honestly: this pass targeted roughly 15% shorter and delivered 3% (9,126 to 8,848), because the restructure added a section's worth of chrome that the prose trim and the capture crops only just offset. Further reduction needs two sections merged, which the scope did not permit.

**Grids.** The feature grid is a 6-column `lg` grid used asymmetrically (3+3, then 2+2+2) — never six equal thirds. Editorial pairs run on a 12-column grid at 8/4, and the closing field splits 7/5 with its content bottom-aligned. The journey is four equal steps (`sm:grid-cols-2 lg:grid-cols-4`) separated by `gap-px` over a base-at-20% ground, so the separators are the grid gap itself.

**Responsive.** One `sm` (640px) and one `lg` (1024px) breakpoint carry nearly everything; verified at 390 / 1280 / 1440 in both themes with no horizontal overflow, zero console errors, zero page errors, all seven anchors resolving, and a 390px document in a 390px viewport. The roles matrix renders as a stacked definition list below `sm` and as a `<table>` from `sm` up — two markup paths, not one scrolling table.

**Auth column.** Both auth pages are a single `max-w-md` column centred in a `min-h-screen` main on the page ground, gutters `1.25rem`, `4rem` vertical. Brand link, heading, lead, then one plinth holding the form: no second column, no split illustration panel, no card inside the card. Registration's post-submit state is the same column, centred and text-only.

**Client islands.** Five on the landing page: `LandingHeader`, `HeroStage`, `FourStageJourney`, `SupportSection`, `DemoVideo`. Everything else is a server component. All three documented routes are statically prerendered: `/` at 41.6 kB / 193 kB first load, `/login` at 2.64 kB / 111 kB, `/register` at 2.65 kB / 102 kB. Verified at 1440 in both themes and at 390: no horizontal overflow, zero console errors, zero page errors on the landing page and both auth pages.

### Named Rules
**The Frame Variation Rule.** Sections must not all run in the same column. Across a page, at least one element breaks the reading column, at least one section is a full-bleed band on a different ground, and at least one runs at text width. Nine identical columns is the failure mode this rule exists to prevent.

**The Per-Capture Framing Rule.** Each product capture gets its own framing, and no two share one. The hero bleeds off the **right** edge (`pl-[max(2.5rem,calc((100vw-80rem)/2+2.5rem))]` with no right padding), the editor capture is **inset** in a narrower `max-w-5xl` column, the financials capture bleeds off the **left**. A repeated frame flattens three different kinds of claim into one, and a mirrored module reads as one component used twice rather than two ideas.

**The No-Min-Width-Table Rule.** A `min-width` on a `<table>` escapes its `overflow-x-auto` parent in Chrome and widens the whole document — it produced a 509px document in a 390px viewport. Wide tabular data stacks into a definition list at small sizes rather than scrolling.

**The One Anchor Per Argument Rule.** A block long enough to be linked to gets an `id` and `scroll-mt-24`. Seven anchors resolve on the surface, and the header and footer navigation use the same nouns for the same destinations.

## Elevation & Depth

The surface is **tonal-first with a restrained ambient shadow on one component family**. Depth comes from a four-step ground ladder (base → surface → elevated → elevated-2) and from hairlines; almost nothing is lifted. The shadow vocabulary is the plate's own soft ambient pair, a deeper light-theme pair for plates carrying a dark raster, a 1px definition shadow on small inverted chips, and an inset top highlight that gives the primary button and the dark plinth a lit top edge. There is no hard offset shadow anywhere, and no element casts a shadow to signal hierarchy — hierarchy is ground tone and rule weight.

### Shadow Vocabulary
- **Plate ambient, light** (`box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 8px 24px -4px rgba(0,0,0,.06)`): the plinth at rest in the light theme. Diffuse and low-contrast; it separates a white plinth from a near-white ground.
- **Plate ambient, light hover** (`0 1px 3px rgba(0,0,0,.06), 0 14px 34px -8px rgba(0,0,0,.12)`): paired with a hairline step to `border-strong`.
- **Raster plate, light** (`0 1px 3px rgba(13,14,21,.10), 0 18px 44px -14px rgba(13,14,21,.28)`, plus `border-color: var(--n-border-strong)`): `.plate-raster` in light only. All three captures are of the *dark* app, and the ordinary ambient pair is tuned to separate a white plinth from a near-white page — behind a near-black raster it does nothing, and the capture lands as an unmediated slab. This is the one place the system spends more shadow, and it spends it to give a dark object an edge.
- **Plate ambient, dark** (`inset 0 1px 0 rgba(255,255,255,.05), 0 12px 36px -10px rgba(0,0,0,.55)`): in dark the visible cue is the inset top highlight, not the drop — the drop only deepens the surrounding ground. Hover raises both (`inset ...,.08`, `0 18px 44px -10px rgba(0,0,0,.7)`).
- **Definition** (`0 1px 2px 0 rgb(0 0 0 / 0.06)`, the `shadow-xs` token): the header's inverted pill CTA and the footer mark. Defined in `tailwind.config.ts` because it is a Tailwind v4 name used under v3 and would otherwise compile to nothing.
- **Button lift** (`0 4px 14px rgba(0,0,0,.12), inset 0 1px 0 rgba(255,255,255,.18)` at rest; `0 8px 24px -4px rgba(0,0,0,.22)` on hover): the primary CTA only.

### Named Rules
**The Tonal-First Rule.** Reach for the next ground step or a hairline before reaching for a shadow. Shadows here are ambient atmosphere on plates and buttons; they never encode hierarchy, and no surface gets a shadow to look important. `.plate-raster` is the sanctioned exception, and it earns it by material contrast, not importance.

**The Portal-Out Rule.** Any fixed overlay on a surface that runs GSAP must portal to `document.body`. This is not stylistic. A transformed ancestor becomes the containing block for `position: fixed`, and the hero timeline leaves a transform on its wrapper — the demo dialog rendered in place was pinned inside the hero at roughly a third of the viewport. Portalled, the overlay measures 1440x900 against a 1440x900 viewport with `body` as its parent.

**The Unspent Device Rule.** Depth is the one device this surface has deliberately not spent. `.taste-plinth` does carry a real shadow vocabulary; what is unspent is that the plate reads as an outline with atmosphere rather than a genuinely lifted object. Accent-at-region-scale and frame variation are both committed and are no longer headroom. A future pass needing a new register should escalate the plate's depth rather than add a second hue or a new composition trick. Recorded so it is inherited as a decision, not rediscovered as an idea.

## Shapes

Two radii do nearly all the work: the **plate** at `1.25rem`, with its inner image clipped to `0.9rem` — a deliberate ~5px inset so the raster sits inside the frame rather than tangent to it — and the **pill** at `9999px` for every button, nav item and small affordance. Between them sit `1rem` for the square brand mark and mobile menu button and `0.75rem` for permission chips; the focus ring rounds to `4px` regardless of what it wraps.

Borders are hairlines, always 1px. There is no coloured left border anywhere above 1px, and no border is used to tint — a stronger border means "top of a set", "hovered", or "a dark raster needs an edge", never "important". The recurring silhouette is a wide plate and a stack of full-width rules. The plates no longer share one aspect ratio: each capture is cropped to where its interface content actually ends, so the page ships 2160×930, 2160×1058 and 2160×1350. The frame follows the content rather than the content being padded to fit the frame.

### Named Rules
**The Hairline Rule.** Structure is drawn with 1px rules and border-separated rows. A definition list on hairlines is the default way to present a set of facts — not a card, and never a card inside a card.

**The Bare Material Rule.** At least one block in a card grid may sit on the page ground without a plinth (the foundations list sits inside the feature grid under a `border-strong` top edge and a 12px uppercase label, with no plate), so the row reads as a change of surface rather than one more card.

## Components

### Buttons
- **Shape:** fully pilled (`9999px`), inline-flex, with a 16px lucide chevron where the label implies forward motion.
- **Icon gap:** both pill classes set `gap: 0.5rem`. They previously set none, so every icon sat flush against its label wherever the classes appeared — "Start free→", "GContinue with Google". The fix belongs to the component layer; it is not a new spacing token, and no button should re-add its own gap utility.
- **Primary** (`.taste-btn-primary`): the brightest neutral as the fill — `--n-text` ground, `--n-base` label, 600 weight, `0.875rem 1.75rem` at 14px. Carries the button-lift shadow and an inset top highlight.
- **Hover / Focus / Active:** `brightness(1.05)` with a 1px rise and a deepened shadow on hover; `scale(0.98)` on press; a 2px emerald focus ring at 2px offset from the global focus rule. Transitions run 200ms on the house easing.
- **Ghost** (`.taste-btn-ghost`): surface ground, hairline border, 500 weight, `0.875rem 1.5rem`. Hover moves the ground to elevated and the border to strong, with the same 1px rise.
- **On-field** (the closing call to action): the ground colour becomes the button — `--n-base` fill, `--n-text` label, rising 2px on hover — paired with a ghost variant outlined in `--n-base/40` resolving to full `--n-base`. No shadow: on a saturated field a drop shadow reads as dirt. The border alpha is non-text and therefore allowed; the label beside it is not.
- **The Sheen Rule.** `.taste-sheen`, the 750ms skewed highlight sweep, is reserved for the single primary conversion path (hero primary, header pill). A page with sheen on three buttons has no primary button.

### Cards / Containers
- **Character:** a plate, not a panel — an outlined surface with soft ambient atmosphere, holding either prose or a screenshot.
- **Corner Style:** `1.25rem`; nested imagery `0.9rem`.
- **Background:** `--n-surface`, or `--n-elevated` when the plate carries a raster. **Border:** 1px hairline, strengthening on hover and in light-theme raster plates.
- **Shadow Strategy:** the plate ambient pair (see Elevation), inset-highlight-led in dark, deepened for rasters in light.
- **Internal Padding:** `1.5rem`, `2rem` from `sm` up; image plates pad to `0.375rem`/`0.5rem` so the frame reads as a mat.
- **Interior structure:** a 20px emerald icon, then h3, then prose — or a definition list on hairlines. Never a nested card.

### Inputs / Fields
- **Character:** a recessed field inside a plinth rather than an outlined box on the page — the field is one ground step up from the plinth interior, so the form reads as carved into the card.
- **Style:** `--n-elevated` ground, 1px hairline border, `0.75rem` radius, `0.75rem 1rem` padding, 14px body, muted placeholder. The label sits above the field at 12px 500 weight in full-contrast text, never inside it as a placeholder.
- **Hover / Focus:** hover strengthens the hairline. Keyboard focus takes the surface's own `:focus-visible` ring — 2px solid emerald at 2px offset, inherited from `.landing-surface :focus-visible` — and the border also goes to `--n-emerald` as a secondary cue layered on top of it, never instead of it. Measured on `:focus-visible` via Tab: `2px solid rgb(16, 185, 129)` dark and `2px solid rgb(4, 120, 87)` light on both pages.
- **Disabled:** `opacity: 0.5`, with the pointer cursor removed on the submit control.
- **Divider:** a federated option is separated by two `h-px` hairlines flanking a 12px muted "or" — not a heading, not a boxed rule.

**The Inherited Ring Rule.** A component on this surface may add to the focus signal but may never suppress it. `focus:outline-none` on the auth field beat `.landing-surface :focus-visible`, and the outline computed to `rgba(0, 0, 0, 0)` while the border stayed at its resting hairline (`rgba(255,255,255,0.08)` dark, `rgba(13,14,21,0.08)` light) — a sign-in form with no keyboard focus indicator at all. The utility was removed from both auth pages; `focus:outline-none` appears nowhere on this surface. A border colour change is a second cue, not a replacement for the ring.

**The Colourless Error Rule.** An error state gets **no hue**. The One Signal Rule permits the emerald or a hairline and forbids a second colour, so the auth error block is `--n-elevated` ground, a `--n-border-strong` rule, a 16px `AlertCircle` and full-contrast `--n-text` at 14px, with `role="alert"`. Meaning is carried by icon, weight and rule, which also keeps the state from being conveyed by colour alone. The implementation this replaced referenced `--error-container`, a variable defined nowhere in the stylesheet — the old error styling was inert, so the red it appeared to promise never existed either.

### Navigation
- **Header:** sticky translucent bar over the obsidian ground; wordmark in Albert Sans 600 at 16px beside a squared brand mark. Section links are 12px, 500 weight, muted at rest, resolving to full text colour on an elevated pill ground over 200ms. They are anchors, not routes — every product page sits behind the auth middleware, so a route link would bounce a visitor to sign-in. Header and footer use one shared vocabulary for the same destinations.
- **Actions:** a 32px circular icon button for the theme toggle (hairline border, muted glyph, lucide Sun/Moon rendered only after mount so server markup cannot disagree with the pre-paint script), a text "Sign in", and an inverted pill CTA carrying `shadow-xs` and the sheen.
- **Mobile:** below `lg` the links collapse behind a 16px hamburger into an animated panel; the primary CTA stays visible at every width.

### Chips
- **Style:** `0.75rem` radius, 11px label, emerald-dim ground with emerald text, no border. Used only for permission values in the roles matrix.
- **State:** presence-only — a chip means the role has that capability. There is no unselected or filter variant.

### Journey Stepper (signature)
Four equal steps on the emerald field, separated by the grid gap itself over a `--n-base/20` ground, each a full-height button that activates on hover, focus and click and carries `aria-current="step"`. Active and prior steps show a **2px `--n-base` rule** scaling from the left across the full width of the step — an emerald rule on an emerald field would be invisible — animated with framer-motion over 450ms on the house easing, collapsed to zero duration under `useReducedMotion`. Hover and focus tint the cell with `--n-base/10`. All text in the cell is full-opacity `--n-base`; the numerals are mono, zero-padded, and hierarchy runs through 12px body against a 16px semibold title rather than alpha.

### Product Plate (signature)
A plinth wrapping a WebP capture of the running application, with an exact descriptive alt sentence and a `sizes` hint matched to its column. All three captures are of the dark app, so all three carry `.plate-raster`. Each is cropped to where its interface content ends before scaling — `crm` from 2880×1800 to 2880×1240 (content ended at 61% of height), `invoices` to 2880×1410 (72%), `pages` uncropped because it fills its frame — and ships at 2160×930, 2160×1058 and 2160×1350, 53–69 KB each. The hero plate is `priority` and is the LCP element; the editor plate carries `.plate-reveal`; the financials plate carries none. Each raster has a provenance sidecar at `public/shots/<name>.webp.json` recording how it was made and what was cropped: a local production build against a temporary seeded workspace that was deleted immediately afterwards.

**The Real Capture Rule.** This surface depicts the product with real captures or not at all. No reconstructed interface in markup — a hand-built mock DOM is a claim the build cannot keep, and every such mockup was deleted. A capture is cropped to its content and never retouched beyond the crop.

### Auth Card (signature)
A single `max-w-md` column on the page ground: the brand mark and wordmark linking home, a `.font-display` `.t-sub` heading that ends in a full stop ("Welcome back.", "Create a workspace.", "Check your email."), one 14px muted lead, then a `.taste-plinth` at `1.5rem` rising to `2rem` holding the form. The submit is a full-width `.taste-btn-primary` with a 16px chevron, swapping to a `border-current` spinner and a present-tense label while in flight; the federated option is a full-width `.taste-btn-ghost` below the hairline "or" divider. The link out is body text underlined on a `border-strong` decoration that resolves to full text colour on hover. Registration's success view is the same column, centred: a 48px emerald-dim disc holding a single emerald mail glyph, the heading, and the address the verification link went to named in full-contrast text inside muted prose.

The one chromatic exception on the documented surface is the Google brandmark, drawn inline in Google's own four hues because it is a third-party identity asset rather than a palette decision; its wordmark path uses `currentColor`. Nothing else on either page introduces a hue.

**The Copy-Tracks-Behaviour Rule.** State copy names what the build actually does next. Registration sends a mandatory verification email and sign-in refuses an unverified address, so the success state reads "Check your email." and names the address. The previous "Account created! Redirecting you to login…" was accurate about the redirect and walked people into a wall at the end of it.

### Demo Dialog (signature)
A `.taste-btn-ghost` trigger in the hero ("Watch the demo", a 14px `Play` glyph, the mono `0:21` duration in muted) opens a modal dialog over a full-viewport scrim holding a 21-second recording of the running app (`public/demo/borsflow-demo.mp4`, 2.8 MB H.264 + AAC at 1920x1080; poster `public/demo/poster.webp`, 1600x900, 34 KB). The video sits in a `.taste-plinth` padded `0.375rem`/`0.5rem` with the frame clipped to `0.9rem` — the same mat the product plates use. The trigger replaced the hero's duplicate "Sign in" link; sign-in already lives in the header.

- **Scrim:** `--n-base/95` with `backdrop-blur-md`. It was `/85` with `blur-sm`, which let the hero's white display type read through and left the dialog's own caption illegible. The caption is full-contrast `--n-text`, not muted — a caption over a scrim is not secondary text.
- **Nothing loads until asked.** The `<video>` element is mounted only while the dialog is open, so the 2.8 MB file is never fetched on page load (verified: zero requests for the mp4 before the trigger is pressed). An inline hero video would have loaded for every visitor and competed with the hero capture for LCP.
- **Sound is opt-in.** Autoplay is muted, looping and `playsInline` — autoplay is only permitted muted — with an explicit pill control that flips `muted` to false on request. Verified playing on open (`paused: false`, 21.5s duration); audio never arrives unasked.
- **Portalled to `document.body`**, per The Portal-Out Rule (see Elevation & Depth).
- **Modal behaviour is complete:** `role="dialog"`, `aria-modal="true"`, an `aria-label`, focus moved into the dialog on open, Tab trapped inside, Escape and backdrop click both close, body scroll locked and restored, focus returned to the trigger. On Escape the dialog and the video both unmount, so playback stops rather than continuing behind a closed overlay.

**The Ask-Before-You-Load Rule.** Heavy media is mounted on intent, never on arrival. A megabyte-scale asset that every visitor pays for and few visitors watch is a cost this surface refuses; the dialog is the sanctioned pattern for it.

### Motion
Three authored moments and one easing (`cubic-bezier(0.16, 1, 0.3, 1)`, registered in GSAP as `CustomEase.create('obsidian', '0.16, 1, 0.3, 1')` — the documented curve exactly, not `power3.out`); everything else is a 200–300ms state transition.

1. **The hero opening sequence** (`HeroStage.tsx`, GSAP 3.15.0 + `CustomEase`). `HeroStage` is the client wrapper; `HeroSection` stays a server component. One timeline masks the two h1 lines up from `yPercent: 108` with an 0.08s stagger, then lifts the lead, the actions and the assurances, and wipes the capture in. Scoped to the opening only.
2. **The journey step advance** (above), framer-motion, reduced-motion aware.
3. **`.plate-reveal`**, a CSS scroll-driven reveal on the editor plate: `animation-timeline: view()` with `animation-range: entry 10% entry 70%`, rising 24px from opacity .35 with a 6px blur, wrapped in `@supports (animation-timeline: view())` and `@media (prefers-reduced-motion: no-preference)`.

**The From-Not-To Rule.** Every tween in the hero uses `gsap.from()`, never `gsap.to()` out of a hidden CSS state. `from()` reads the DOM's own resting state and animates toward it, so a bundle that never loads, never hydrates, or throws leaves the hero complete. Verified with JavaScript disabled: h1 at opacity 1, no transform, no clip-path, CTA present. This is the Painted Colour Rule applied to motion.

**The LCP-Never-Fades Rule.** The largest contentful paint never animates opacity. The hero capture takes a `clip-path` wipe and a 10px `y` only, so it is painted from the first frame; fading it would defer the metric by the length of the tween.

**The Never-Stranded Rule.** A reveal is written in CSS with `view()` rather than a JavaScript scroll listener, so a browser without support simply shows the finished state. The hero timeline registers only inside `gsap.matchMedia('(prefers-reduced-motion: no-preference)')` and never registers under `reduce` — verified: no transform, opacity 1, no clip. Global `prefers-reduced-motion: reduce` collapses animation and transition to 0.01ms, and there are still **no** scroll-entrance animations on section content — only the one plate.

**Cost, recorded honestly.** Adding GSAP moved first-load JS from 161 kB to 192 kB. That +31 kB buys one opening sequence on a marketing page. The demo dialog since added 1 kB (193 kB) because the video is not part of the bundle and is not fetched until asked for. Any future library purchase gets stated in the same terms.

### Browser Surfaces
Scoped to the landing surface with `html:has(.landing-surface)` / `.landing-surface` so the app chrome keeps its own: selection in emerald-dim, an emerald caret, a 2px emerald focus ring at 2px offset rounded to 4px, a thin scrollbar with a `border-strong` thumb on a base track (hover to muted), and `0.2em` underline offset on textual links. Theme is hand-rolled — no `next-themes`. A blocking pre-paint script in `layout.tsx` reads the persisted Zustand `app-storage` key plus `matchMedia` and sets both the `dark`/`light` class and `data-theme` on `<html>` before first paint, so there is neither a flash nor a hydration mismatch.

## Do's and Don'ts

### Do:
- **Do** route every accent through `var(--n-emerald)`, and add colour only as a mark, a 1px rule, a focus ring, or a committed region.
- **Do** spend the accent at region scale at most twice per page — one mid-page, one closing — and make the two materially unalike: one divided and interactive, one open. Paint both in CSS.
- **Do** set every piece of text on a colour field at full-opacity `--n-base`, and get hierarchy from size and weight. Alpha is for dividers, hover grounds and borders only.
- **Do** use the five clamp classes (`.t-display`, `.t-h2`, `.t-sub`, `.t-h3`, `.t-lead`) for landing type, and clamp prose to `.measure` (68ch) or `.measure-tight` (46ch) — including FAQ answers and section leads.
- **Do** drop column and set labels to 12px uppercase tracked on a `border-strong` rule rather than borrowing the card-title step.
- **Do** vary the frame across a page, and give each product capture its own framing: one bleeding right, one inset in a narrower column, one bleeding left.
- **Do** back a dark raster with `.plate-raster` so it gets an edge and a deeper shadow on the light ground.
- **Do** crop a capture to where its interface content ends, then scale; record the crop in its provenance sidecar at `public/shots/<name>.webp.json` alongside an exact descriptive alt sentence and a `sizes` hint matched to its column.
- **Do** animate with `gsap.from()` toward the DOM's resting state, register timelines only inside `gsap.matchMedia('(prefers-reduced-motion: no-preference)')`, and verify the surface with JavaScript disabled.
- **Do** keep one easing (`cubic-bezier(0.16, 1, 0.3, 1)` / `CustomEase 'obsidian'`) and pair any framer-motion entrance with `useReducedMotion`.
- **Do** verify every factual claim against `prisma/schema.prisma`, the API tree, or `src/lib` before it ships as copy — the assistant table's tool identifiers and models are checked against `src/app/api/ai/chat/route.ts`.
- **Do** give any block long enough to be linked an `id` and `scroll-mt-24`, and keep header and footer navigation on the same nouns.
- **Do** measure contrast before committing a colour value, and take the darker step when the lighter one fails AA at its size.
- **Do** mount heavy media on intent: a video lives inside a dialog whose `<video>` element exists only while the dialog is open, autoplays muted and looping with an explicit sound control, and unmounts on close so playback stops.
- **Do** portal any fixed overlay to `document.body` on a surface that runs GSAP, and verify the overlay measures the full viewport.
- **Do** ship a dialog complete: `role="dialog"`, `aria-modal`, a label, focus moved in, Tab trapped, Escape and backdrop close, body scroll locked and restored, focus returned to the trigger.
- **Do** let every control inherit the surface's `:focus-visible` ring (2px emerald at 2px offset) and layer any border or ground change on top of it.
- **Do** build error and success states without a hue — `--n-elevated` ground, a `--n-border-strong` rule, an icon and full-contrast text, with `role="alert"` — so state is never carried by colour alone.
- **Do** keep the pill classes' own `gap: 0.5rem` and let icons space from the component layer rather than from per-button utilities.
- **Do** write state copy that names what the build does next, including the address a verification link was sent to.
- **Do** state the byte cost when a new library lands.

### Don't:
- **Don't** put a kicker or eyebrow above a heading. A heading opens a section on its own.
- **Don't** set text over a colour field at any opacity below 100% — `/75` measured 3.63:1, `/85` measured 4.21:1, `/80` measured 3.92:1, and all three fail AA.
- **Don't** build two committed regions that look alike; if the mid-page field and the close use the same material, the page has no ending.
- **Don't** build page structure as rows of same-size icon + heading + text cards, and don't nest a card inside a card.
- **Don't** introduce a second hue, a gradient text fill, or a coloured left border above 1px.
- **Don't** use monospace as a technical costume, and don't put a weight modifier on `font-mono` or `.t-data` — the mono face ships at 400 only.
- **Don't** load a font weight no element uses; the loaded set is DM Sans 400/500/600, Albert Sans 600/700, JetBrains Mono 400, and `font-light` appears nowhere in `src/`.
- **Don't** simulate product UI in markup, and don't pad a capture to fit a frame instead of cropping it.
- **Don't** animate in a region whose colour carries its text's legibility, and don't animate opacity on the LCP element.
- **Don't** write `gsap.to()` out of a hidden CSS state; a hero that needs JavaScript to become visible is the same failure as a colour field that needs a scroll listener.
- **Don't** add scroll-entrance animation to section content; one plate is the only revealed element.
- **Don't** reuse one framing for every capture — a repeated frame flattens three different claims into one.
- **Don't** put `min-width` on a `<table>` inside `overflow-x-auto` — stack to a definition list below `sm` instead.
- **Don't** ship pricing, testimonials, metrics, customer names, or compliance and uptime assertions on this surface; all of those were removed as fabrications.
- **Don't** ship a strip of muted 12px text that restates a footer column in different words — that block was deleted, not reworded.
- **Don't** use a shadow to make something look important, and don't reach for a hard offset shadow — this is not a neobrutalist world.
- **Don't** put a video inline on the fold or load one before the visitor asks for it, and don't let audio start unrequested.
- **Don't** render a fixed overlay inside a transformed subtree — it will be pinned to that subtree's box instead of the viewport.
- **Don't** thin an overlay scrim until the layer beneath reads through it; `/85` with `blur-sm` left the hero's display type and the dialog's caption fighting each other.
- **Don't** write `focus:outline-none` (or any outline suppression) on a control — it beats the global `:focus-visible` ring and can leave a form with no keyboard focus indicator whatsoever.
- **Don't** reach for red, amber or any other status hue for an error, and don't reference a token the stylesheet never defines — `--error-container` is undefined here, and styling that cited it did nothing.
- **Don't** import the app's Material-3 tokens, Material Symbols glyphs, or indigo accent into this surface, and don't export this surface's tokens into the app without a scoped migration.
