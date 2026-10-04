# BorsFlow: Real Estate Developer CRM Master Implementation Plan

> **Scope:** Property Development & Promotion Platform (Promoteurs Immobiliers)  
> **Exclusions:** B2B2C Partner Networks & External Broker Lead Protection (handled separately)  
> **Architecture:** Native extension of BorsFlow (Next.js App Router, Prisma ORM, PostgreSQL, TailwindCSS, i18n)

---

## 1. Executive Summary & Architectural Positioning

BorsFlow already contains an **Agency / Resale Real Estate** module (`Property`, `Mandate`, `Offer`, `ViewingFeedback`). 

However, **Real Estate Developers (Promoteurs / Builders)** operate on an entirely different paradigm:
* They don't sell existing single listings; they develop **Multi-Unit Programs (Developments)** across 24–36 month lifecycles.
* They prospect raw land (*Prospection Foncière*) and manage urban permits.
* Units (*Lots*) are sold off-plan (*VEFA* / pre-construction) with temporary reservation hold locks.
* Revenue is collected through **Construction Milestone Billing (*Appels de Fonds*)** certified by architects.
* Buyers customize their lots through **TMA (*Travaux Modificatifs Acquéreurs*)**.
* Handovers require on-site digital inspection protocols (*PV de Livraison*) and multi-year statutory warranties (*GPA, Biennale, Décennale*).

This plan establishes a dedicated **Developer CRM Engine** within BorsFlow that cleanly connects with `Workspace`, `Lead` (the buyer/prospect), `Invoice` (calls for funds), and `User`.

---

## 2. Core Domain Model & Entity Relationships

```
                               ┌─────────────────┐
                               │    Workspace    │
                               └────────┬────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                                                         ▼
  ┌──────────────────┐                                     ┌──────────────────┐
  │     LandDeal     │                                     │     Program      │
  │ (Foncier/Permit) │                                     │  (Development)   │
  └──────────────────┘                                     └────────┬─────────┘
                                                                    │ 1:N
                                                           ┌────────┴─────────┐
                                                           ▼                  ▼
                                                  ┌────────────────┐  ┌──────────────────────┐
                                                  │    Building    │  │ ConstructionMilestone│
                                                  └────────┬───────┘  └──────────┬───────────┘
                                                           │ 1:N                 │
                                                           ▼                     │ triggers
                                                  ┌────────────────┐             │
                                                  │ DevelopmentLot │             │
                                                  └────────┬───────┘             │
                                                           │                     ▼
                                          ┌────────────────┼───────────────►┌────────────────┐
                                          │ 1:N            │ 1:N            │  CallForFunds  │
                                          ▼                ▼                │   (Invoice)    │
                                   ┌──────────────┐ ┌──────────────┐        └────────────────┘
                                   │  TMARequest  │ │ HandoverSnag │
                                   └──────────────┘ └──────────────┘
```

### Entity Overview
1. **`LandDeal` (Prospection Foncière):** Land parcels, landowner contacts, zoning regulations, feasibility calculations, and building permit approval stages.
2. **`Program` (Programme Immobilier):** The top-level development (e.g., "Résidence Les Jardins du Parc"), delivery quarter, architect name, bank guarantee (GFA) details.
3. **`Building` (Bâtiment/Tranche):** Sub-divisions of a program (e.g., "Building A", "Building B"), floor counts.
4. **`DevelopmentLot` (Lot / Stock):** Specific units (Apartment, Commercial, Parking Bay, Cellar). Stores floor, orientation, surface area, base price, status state machine (`AVAILABLE`, `OPTIONED`, `RESERVED`, `DEED_SIGNED`, `DELIVERED`), reservation TTL expiry, and buyer lead link.
5. **`ConstructionMilestone` (Jalons de Chantier):** Statutory completion stages (e.g., Foundations 15%, Roof Watertight 70%, Plastering 90%, Handover 100%) certified by the supervising architect.
6. **`CallForFunds` (Appels de Fonds):** Automated, legally binding milestone billing notices generated when a construction milestone is certified.
7. **`TMARequest` (Modifications Acquéreurs):** Catalog of finishes and change requests, technical feasibility approvals, cost addenda, and signature tracking.
8. **`HandoverSnag` (Livraison & Réserves / GPA):** Snagging items logged during the delivery walk-through with room location, photo proof, contractor assignment, and warranty tracking.

---

## 3. Phased Implementation Roadmap

### Phase 1: Database Schema & Core Domain Primitives
- [ ] Add Prisma models (`Program`, `Building`, `DevelopmentLot`, `LandDeal`, `ConstructionMilestone`, `CallForFunds`, `TMARequest`, `HandoverSnag`).
- [ ] Establish relations with `Workspace`, `Lead`, `Invoice`, and `User`.
- [ ] Create database migration and verify Prisma client generation.
- [ ] Seed standard construction milestones (VEFA default percentage schedules).

### Phase 2: Upstream Pipeline (Land Acquisition / Foncier)
- [ ] Service: `src/lib/services/developer/land-deals.ts` (CRUD, status transitions, feasibility math).
- [ ] API routes: `/api/developer/land-deals` and `[id]`.
- [ ] UI: Land Acquisition Pipeline board (Prospecting, Feasibility, Promesse de vente, Permis purgé, Land Deed).
- [ ] Feasibility card: Sellable m² estimate, construction cost benchmark, projected margin.

### Phase 3: Dynamic Inventory & Stacking Plan (The Commercial Core)
- [ ] Service: `src/lib/services/developer/programs.ts` & `lots.ts`.
- [ ] Lot State Machine:
  - Option hold locking with 48h/72h TTL automatic release worker.
  - Mandatory unit bundling (e.g., Apartment + Parking + Cellar).
- [ ] API routes: `/api/developer/programs/[id]/lots`, `/api/developer/lots/[id]/option`.
- [ ] UI:
  - Program Dashboard (overview, key dates, sales velocity metrics).
  - Interactive Visual Stacking Plan (2D SVG grid with real-time color-coded unit statuses).
  - Lot Detail modal with buyer attachment, document vault, and pricing breakdown.

### Phase 4: TMA (Customizations & Change Orders)
- [x] Service: `src/lib/services/developer/tma.ts`.
- [x] Multi-stage validation: Buyer request -> Technical Manager feasibility sign-off -> Pricing Addendum -> E-signature.
- [x] Automatic sync: Updating lot balance and invoice tranches.
- [x] UI: TMA review table for site managers, TMA creation modal, and review modal.

### Phase 5: Construction Milestones & Automated Calls for Funds (Appels de Fonds)
- [x] Service: `src/lib/services/developer/milestones.ts` & `calls-for-funds.ts`.
- [x] Milestone Certification Flow: Architect certificate upload -> status change to `CERTIFIED`.
- [x] Batch Billing Generation: Idempotent generator that creates legally compliant stage invoices for all active buyers in the certified building.
- [x] API routes: `/api/developer/milestones/[id]/certify` and `/api/developer/calls-for-funds`.
- [x] UI: Milestone Tracker and Batch Call for Funds review / dispatch console in Program page.

### Phase 6: 24-Month Buyer Construction Portal (Hybrid Security Approach)
- [x] **Hybrid Security Model**:
  - **Public Link by Default (`/view/buyer/[token]`)**: Instant frictionless access (no account creation required) to 24-month construction timeline, certified milestone progress, drone photo/video updates, and architectural specifications.
  - **OTP-Protected Confidential Space**: Sensitive stage invoices (*Appels de Fonds*), financial receipts, and digital TMA change order signatures protected by an on-demand 6-digit OTP dispatched to the registered buyer's email/phone, issuing a 24-hour HMAC-SHA256 session token.
- [x] Document Vault: View and download stage billing receipts (`/view/invoice/[token]`), statutory VEFA certificates, and bank completion guarantees (GFA).
- [x] Interactive Customization (TMA):
  - Direct buyer modification requests (`POST /api/public/buyer/[token]/tma`).
  - Electronic signing and acceptance of developer quotes (`POST /api/public/buyer/[token]/tma/[id]/accept`).
- [x] Developer CRM Link Console: One-click "Copy Portal Link" and "Open Portal" in Lot slide-over drawer with real-time buyer attachment display.

### Phase 7: Handover Protocol, Snagging & Statutory Warranties (SAV)
- [x] Snagging and Warranty models (`HandoverSnag`) linked to `DevelopmentLot` and `Program`.
- [x] Statutory Warranty tracking: 1-Year Perfect Completion (*GPA*), 2-Year Equipment (*Biennale*), 10-Year Structural (*Décennale*).
- [x] Buyer portal integration displaying post-handover snags and contractor resolution status.

