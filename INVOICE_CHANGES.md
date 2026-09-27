## Changes made to the invoice feature

**Why:** User requested multiple improvements to the invoice page — Stripe status visibility, duplicate number bug, send modal UX, line items design, and drag-and-drop reordering.
**How to apply:** Reference these when continuing work on invoices, quotes, or related billing features.

---

### 1. Stripe Connected Status Banner
**File:** `src/app/invoices/page.tsx`

- Fetches both `/api/stripe/connect/status` (OAuth) and `/api/stripe/settings` (direct API key) in parallel
- `stripeConnected = true` if either method is configured
- Green success banner when connected: *"Stripe is connected — payment links are enabled on your invoices."*
- Orange warning banner when not connected (unchanged)

---

### 2. Duplicate Invoice Number Fix
**File:** `src/app/api/invoices/route.ts`

- **Bug:** `orderBy: { invoiceNumber: 'desc' }` sorted lexicographically → `INV-2026-0009 > INV-2026-0010` → wrong "last" invoice picked → duplicate number
- **Fix:** replaced with `count()` of existing invoices for the year → `count + 1` = correct next number
- **Race condition:** `prisma.invoice.create()` wrapped in retry loop (up to 5 attempts), catches `P2002` and increments by 1

---

### 3. Send Invoice Modal — Two Modes
**Files:** `src/app/invoices/page.tsx`, `src/app/api/invoices/[id]/send/route.ts`

- Modal replaced with two-card mode toggle:
  - **Invoice only** — sends email with invoice details
  - **Invoice + Pay link** — generates Stripe payment link first, embeds purple "Pay Now" button in email
- "Invoice + Pay link" disabled/greyed when Stripe not connected (tooltip explains)
- Button label and color adapt to selected mode
- Invoice list updated immediately after send with payment link
- Inline error messages instead of `alert()`
- API accepts optional `paymentLink` in body → injects styled "Pay Now" button into email HTML

---

### 4. Line Items Card — Design Redesign
**Files:** `src/components/documents/LineItemRow.tsx`, `src/components/documents/LineItemsTable.tsx`, `src/app/invoices/new/page.tsx`, `src/app/invoices/[id]/page.tsx`

- Each row is a bordered card with hover shadow
- Row number badge top-left corner
- Field labels always visible inside each cell
- Fields separated by thin dividers
- Description uses borderless input
- Delete button hidden until row hovered
- Card wrapper: more padding (`sm:p-8`) + subtitle
- Improved empty state with icon

---

### 5. Drag-to-Reorder — Fully Wired
**Files:** `src/components/documents/LineItemRow.tsx`, `src/components/documents/LineItemsTable.tsx`

- Grip handle is `draggable`, fires HTML5 drag events
- `LineItemsTable` tracks `draggingIndex` + `dropTargetIndex` in state; `dragIndexRef` persists across re-renders
- Dragged row: `opacity-40 scale-[0.98]`
- Drop target row: blue highlight (`border-secondary/60 bg-secondary/5`)
- On `dragEnd`: array reordered via `handleReorderItems`, all drag state reset
