# Quote and Invoice Management System - UI Design Specification

## Executive Summary

This document provides a comprehensive UI design specification for a modern, minimalist, and highly responsive Quote and Invoice management system. The design leverages the existing Material Design-inspired color system, Inter typography, and component patterns established in the NOTION-ALT project.

## Design Principles

1. **Minimalism**: Clean, uncluttered interface with focus on content
2. **Professionalism**: Business-appropriate color scheme and typography
3. **Responsiveness**: Seamless experience across desktop, tablet, and mobile
4. **Efficiency**: Quick access to common actions and information
5. **Consistency**: Aligns with existing design system and patterns

## Design System

### Typography

**Font Family**: Inter (Google Fonts)
- **Headlines**: 600-700 weight, 1.5-2.75rem
- **Body Text**: 400-500 weight, 0.875-1rem
- **Labels**: 500 weight, 0.6875-0.75rem
- **Numbers/Monospace**: Monaco, Menlo, or Ubuntu Mono for financial data

**Typography Scale**:
```css
.display-md { font-size: 2.75rem; line-height: 1.2; letter-spacing: -0.04em; }
.headline-sm { font-size: 1.5rem; line-height: 1.3; font-weight: 600; }
.headline-xs { font-size: 1.125rem; line-height: 1.4; font-weight: 600; }
.body-lg { font-size: 1rem; line-height: 1.6; }
.body-md { font-size: 0.875rem; line-height: 1.5; }
.label-sm { font-size: 0.6875rem; line-height: 1.2; }
.label-md { font-size: 0.75rem; line-height: 1.3; }
```

### Color Scheme

**Primary Colors** (from existing CSS variables):
- `--primary`: #5f5e5e (neutral gray for text)
- `--secondary`: #4a4bd7 (primary action color - blue-purple)
- `--secondary-dim`: #3d3dcb (hover state)
- `--background`: #ffffff (light mode), #1b2022 (dark mode)
- `--surface`: #ffffff (light mode), #1b2022 (dark mode)

**Surface Colors**:
- `--surface-container-low`: #f1f4f6 (light mode), #262b2d (dark mode)
- `--surface-container-high`: #e2e9ec (light mode), #262b2d (dark mode)
- `--surface-container-highest`: #dbe4e7 (light mode), #42494c (dark mode)

**Text Colors**:
- `--on-surface`: #2b3437 (light mode), #dbe4e7 (dark mode)
- `--on-surface-variant`: #586064 (light mode), #abb3b7 (dark mode)
- `--on-primary`: #faf7f6 (light mode), #2b3437 (dark mode)

**Status Colors**:
- **Success**: #10b981 (green) - for accepted/paid status
- **Warning**: #f59e0b (amber) - for pending/draft status
- **Error**: #ef4444 (red) - for rejected/overdue status
- **Info**: #3b82f6 (blue) - for sent/viewed status

### Shadows and Elevation

```css
/* Subtle shadow for cards */
.card-shadow {
  box-shadow: 0px 2px 8px rgba(43, 52, 55, 0.04),
              0px 8px 16px rgba(43, 52, 55, 0.06);
}

/* Medium shadow for modals */
.modal-shadow {
  box-shadow: 0px 4px 12px rgba(43, 52, 55, 0.08),
              0px 20px 40px rgba(43, 52, 55, 0.12);
}

/* Strong shadow for dropdowns */
.dropdown-shadow {
  box-shadow: 0px 8px 24px rgba(43, 52, 55, 0.12),
              0px 32px 64px rgba(43, 52, 55, 0.16);
}
```

### Border Radius

```css
/* Consistent rounded corners */
.radius-sm { border-radius: 0.5rem; }   /* 8px */
.radius-md { border-radius: 0.75rem; }  /* 12px */
.radius-lg { border-radius: 1rem; }     /* 16px */
.radius-xl { border-radius: 1.5rem; }   /* 24px */
```

## Component Architecture

### Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    AppShell                                  │
│  ┌──────────┐  ┌──────────────────────────────────────┐   │
│  │ Sidebar  │  │         Main Content Area             │   │
│  │          │  │  ┌────────────────────────────────┐  │   │
│  │ - Home   │  │  │   Top Header (breadcrumbs)      │  │   │
│  │ - Pages  │  │  └────────────────────────────────┘  │   │
│  │ - Kanban │  │  ┌────────────────────────────────┐  │   │
│  │ - CRM    │  │  │                                │  │   │
│  │ - Quotes │  │  │   Quotes/Invoices Page         │  │   │
│  │ - Invoices│ │  │   - Filter Bar                 │  │   │
│  │ - Settings│ │  │   - Document List/Grid         │  │   │
│  └──────────┘  │  │   - FAB (Create New)           │  │   │
│                │  │                                │  │   │
│                │  └────────────────────────────────┘  │   │
│                │                                       │   │
│                └───────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
AppShell
├── QuotesPage
│   ├── QuotesList
│   │   ├── QuoteCard
│   │   ├── QuoteStatusBadge
│   │   └── QuoteActions
│   ├── QuotesFilterBar
│   └── CreateQuoteButton (FAB)
│
├── InvoicesPage
│   ├── InvoicesList
│   │   ├── InvoiceCard
│   │   ├── InvoiceStatusBadge
│   │   └── InvoiceActions
│   ├── InvoicesFilterBar
│   └── CreateInvoiceButton (FAB)
│
├── QuoteDetailPage
│   ├── QuoteHeader
│   ├── QuoteSummary
│   ├── QuoteItemsEditor
│   ├── QuoteClientInfo
│   ├── QuoteNotes
│   └── QuoteActionsBar
│
├── InvoiceDetailPage
│   ├── InvoiceHeader
│   ├── InvoiceSummary
│   ├── InvoiceItemsEditor
│   ├── InvoiceClientInfo
│   ├── InvoicePayments
│   ├── InvoiceNotes
│   └── InvoiceActionsBar
│
└── Shared Components
    ├── LineItemsTable
    ├── LineItemRow
    ├── CalculationsSummary
    ├── DocumentPreview
    ├── EmailDocumentModal
    └── StatusBadge
```

## Page Layouts

### 1. Quotes Page (`/quotes`)

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│  Header: Quotes                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Filter: [All ▼] [Search quotes...] [+ New Quote]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Quote List (Grid or Table View)                      │   │
│  │ ┌───────────────────────────────────────────────┐  │   │
│  │ │ Quote #   Client    Status    Total    Actions │  │   │
│  │ ├───────────────────────────────────────────────┤  │   │
│  │ │ Q-2026-0001  ABC Co   Draft     $1,200   ⋮    │  │   │
│  │ │ Q-2026-0002  XYZ Inc  Sent      $3,500   ⋮    │  │   │
│  │ └───────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Pagination: [< Previous] 1 2 3 [Next >]                    │
└─────────────────────────────────────────────────────────────┘
```

**Components**:

#### QuotesFilterBar
- **Status Filter**: Dropdown with options (All, Draft, Sent, Viewed, Accepted, Rejected, Expired)
- **Search Input**: Full-text search across client name, email, company
- **Date Range**: Optional date range picker for issue date
- **Sort**: Dropdown (Date, Client, Total, Status)
- **View Toggle**: Grid vs List view switcher

#### QuotesList (Grid View)
- **QuoteCard**:
  - Quote number (Q-YYYY-NNNN)
  - Client name and company
  - Status badge with color coding
  - Total amount (formatted currency)
  - Issue date
  - Quick actions menu (⋮)
  - Hover effect with subtle lift

#### QuotesList (Table View)
- **Columns**:
  - Quote number (sortable)
  - Client name (sortable)
  - Company (sortable)
  - Status (filterable)
  - Issue date (sortable)
  - Total (sortable)
  - Actions (dropdown menu)

#### CreateQuoteButton (FAB)
- Fixed position bottom-right
- Floating action button style
- Icon: Plus sign
- Opens CreateQuoteModal

### 2. Invoices Page (`/invoices`)

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│  Header: Invoices                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Filter: [All ▼] [Search invoices...] [+ New Invoice]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Invoice List (Grid or Table View)                    │   │
│  │ ┌───────────────────────────────────────────────┐  │   │
│  │ │ Inv #     Client    Status    Due     Actions │  │   │
│  │ ├───────────────────────────────────────────────┤  │   │
│  │ │ INV-2026-001 ABC Co   Draft     Mar 30   ⋮    │  │   │
│  │ │ INV-2026-002 XYZ Inc  Sent      Apr 15   ⋮    │  │   │
│  │ └───────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Pagination: [< Previous] 1 2 3 [Next >]                    │
└─────────────────────────────────────────────────────────────┘
```

**Components**:

#### InvoicesFilterBar
- **Status Filter**: Dropdown (All, Draft, Sent, Viewed, Partially Paid, Paid, Overdue)
- **Search Input**: Full-text search
- **Date Range**: Issue date or due date range
- **Sort**: Dropdown (Date, Client, Total, Status, Due Date)
- **View Toggle**: Grid vs List view

#### InvoicesList (Grid View)
- **InvoiceCard**:
  - Invoice number (INV-YYYY-NNNN)
  - Client name and company
  - Status badge with color coding
  - Total amount
  - Due date (highlighted if overdue)
  - Amount paid / Amount due (for partial payments)
  - Quick actions menu

#### InvoicesList (Table View)
- **Columns**:
  - Invoice number
  - Client name
  - Company
  - Status
  - Issue date
  - Due date
  - Total
  - Amount paid
  - Amount due
  - Actions

### 3. Quote Detail Page (`/quotes/[id]`)

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│  Header: Quote Q-2026-0001                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [← Back]  Quote #Q-2026-0001  [⋮ Actions]           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Status: [Draft ▼]  Issue Date: [2026-03-28]         │   │
│  │ Valid Until: [2026-04-28]  Currency: [USD ▼]        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────┬────────────────────────────┐ │
│  │                          │                            │ │
│  │  Client Information      │   Line Items               │ │
│  │  ┌────────────────────┐ │   ┌──────────────────────┐ │ │
│  │  │ Name: [John Doe]  │ │   │ Desc   Qty   Price    │ │ │
│  │  │ Email: [...]       │ │   ├──────────────────────┤ │ │
│  │  │ Phone: [...]       │ │   │ Service A  1   $500  │ │ │
│  │  │ Company: [...]     │ │   │ Service B  2   $350  │ │ │
│  │  │ Address: [...]     │ │   │ [+ Add Item]         │ │ │
│  │  └────────────────────┘ │   └──────────────────────┘ │ │
│  │                          │                            │ │
│  │                          │   Summary                  │ │
│  │                          │   ┌──────────────────────┐ │ │
│  │                          │   │ Subtotal:    $1,200 │ │ │
│  │                          │   │ Discount:    -$120  │ │ │
│  │                          │   │ Tax (10%):   $108   │ │ │
│  │                          │   │ Total:       $1,188 │ │ │
│  │                          │   └──────────────────────┘ │ │
│  └──────────────────────────┴────────────────────────────┘ │
│                                                              │
│  Notes & Terms                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Notes: [Additional notes...]                         │   │
│  │ Terms: [Payment terms...]                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Save Draft] [Send Email] [Download PDF] [Convert]   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Components**:

#### QuoteHeader
- Back button
- Quote number (editable in draft mode)
- Actions dropdown menu
  - Duplicate
  - Delete
  - Convert to Invoice
  - View History

#### QuoteStatusControls
- Status dropdown (Draft, Sent, Viewed, Accepted, Rejected, Expired)
- Issue date picker
- Valid until date picker
- Currency selector

#### QuoteClientInfo
- **Sender Information**:
  - From workspace (auto-populated)
  - Company name
  - Contact email
  - Contact phone
  - Company address
  
- **Recipient Information**:
  - Client name (required)
  - Client email
  - Client phone
  - Client company
  - Client address (multiline)
  - Link to Lead (optional, auto-fills client info)

#### LineItemsTable
- **Columns**:
  - Description (text input, required)
  - Quantity (number input, min 1)
  - Unit Price (number input, currency formatted)
  - Discount % (number input, optional)
  - Tax Rate % (number input, optional)
  - Total (calculated, read-only)
  - Actions (delete row, reorder)

- **Features**:
  - Add new row button
  - Auto-calculation of line totals
  - Drag-and-drop reordering
  - Delete confirmation
  - Inline editing

#### CalculationsSummary
- **Fields**:
  - Subtotal (calculated)
  - Discount Type (None, Percentage, Fixed)
  - Discount Value (number input)
  - Discount Amount (calculated)
  - Tax Rate % (number input)
  - Tax Amount (calculated)
  - Total (calculated, prominent display)

#### QuoteNotes
- **Notes Section**:
  - Textarea for client-facing notes
  - Character limit indicator
  
- **Terms Section**:
  - Textarea for payment terms
  - Predefined templates dropdown
  
- **Internal Notes**:
  - Textarea for internal notes
  - Not visible to client

#### QuoteActionsBar
- **Primary Actions**:
  - Save Draft
  - Send Email (opens EmailDocumentModal)
  - Download PDF
  
- **Secondary Actions**:
  - Convert to Invoice
  - Mark as Accepted
  - Mark as Rejected

### 4. Invoice Detail Page (`/invoices/[id]`)

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│  Header: Invoice INV-2026-001                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [← Back]  Invoice #INV-2026-001  [⋮ Actions]        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Status: [Sent ▼]  Issue Date: [2026-03-28]          │   │
│  │ Due Date: [2026-04-28]  Currency: [USD ▼]           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────┬────────────────────────────┐ │
│  │                          │                            │ │
│  │  Client Information      │   Line Items               │ │
│  │  ┌────────────────────┐ │   ┌──────────────────────┐ │ │
│  │  │ Name: [John Doe]  │ │   │ Desc   Qty   Price    │ │ │
│  │  │ Email: [...]       │ │   ├──────────────────────┤ │ │
│  │  │ Phone: [...]       │ │   │ Service A  1   $500  │ │ │
│  │  │ Company: [...]     │ │   │ Service B  2   $350  │ │ │
│  │  │ Address: [...]     │ │   │ [+ Add Item]         │ │ │
│  │  └────────────────────┘ │   └──────────────────────┘ │ │
│  │                          │                            │ │
│  │                          │   Summary                  │ │
│  │                          │   ┌──────────────────────┐ │ │
│  │                          │   │ Subtotal:    $1,200 │ │ │
│  │                          │   │ Discount:    -$120  │ │ │
│  │                          │   │ Tax (10%):   $108   │ │ │
│  │                          │   │ Total:       $1,188 │ │ │
│  │                          │   │ Paid:        $500   │ │ │
│  │                          │   │ Due:         $688   │ │ │
│  │                          │   └──────────────────────┘ │ │
│  └──────────────────────────┴────────────────────────────┘ │
│                                                              │
│  Payments                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [+ Record Payment]                                 │   │
│  │ ┌─────────────────────────────────────────────┐   │   │
│  │ │ Date      Method      Amount     Reference   │   │   │
│  │ ├─────────────────────────────────────────────┤   │   │
│  │ │ Mar 28    Bank Transfer  $500     REF-001   │   │   │
│  │ └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Notes & Terms                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Notes: [Additional notes...]                         │   │
│  │ Terms: [Payment terms...]                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Save] [Send Email] [Download PDF] [Record Payment]  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Components**:

#### InvoiceHeader
- Back button
- Invoice number (editable in draft mode)
- Actions dropdown menu
  - Duplicate
  - Delete
  - View History

#### InvoiceStatusControls
- Status dropdown (Draft, Sent, Viewed, Partially Paid, Paid, Overdue)
- Issue date picker
- Due date picker
- Currency selector

#### InvoiceClientInfo
- Same structure as QuoteClientInfo
- Additionally shows linked Quote if converted from one

#### LineItemsTable
- Same structure as QuoteLineItemsTable
- Can be pre-populated from linked Quote

#### CalculationsSummary
- Same fields as QuoteCalculationsSummary
- Additional fields:
  - Amount Paid (calculated from payments)
  - Amount Due (calculated: Total - Amount Paid)
  - Progress bar showing payment status

#### InvoicePayments
- **Payments Table**:
  - Date
  - Payment Method (Bank Transfer, Credit Card, Cash, Check, Other)
  - Amount
  - Reference Number
  - Notes
  - Actions (edit, delete)

- **Add Payment Button**:
  - Opens PaymentModal
  - Pre-fills remaining amount due

#### InvoiceNotes
- Same structure as QuoteNotes

#### InvoiceActionsBar
- **Primary Actions**:
  - Save
  - Send Email
  - Download PDF
  - Record Payment

- **Secondary Actions**:
  - Mark as Paid
  - Mark as Overdue

## Shared Components

### StatusBadge

**Purpose**: Display document status with color coding

**Variants**:
- **Quote Statuses**:
  - Draft: Gray (#6b7280)
  - Sent: Blue (#3b82f6)
  - Viewed: Indigo (#6366f1)
  - Accepted: Green (#10b981)
  - Rejected: Red (#ef4444)
  - Expired: Orange (#f97316)

- **Invoice Statuses**:
  - Draft: Gray (#6b7280)
  - Sent: Blue (#3b82f6)
  - Viewed: Indigo (#6366f1)
  - Partially Paid: Amber (#f59e0b)
  - Paid: Green (#10b981)
  - Overdue: Red (#ef4444)

**Design**:
- Pill-shaped badge
- Status text
- Small dot indicator (colored)
- Hover effect showing tooltip with description

### LineItemsTable

**Purpose**: Editable table for line items

**Features**:
- Inline editing
- Auto-calculation
- Add/remove rows
- Reorder rows
- Validation

**Columns**:
1. **Description**: Text input, required, min 3 chars
2. **Quantity**: Number input, min 1, default 1
3. **Unit Price**: Number input, min 0, currency formatted
4. **Discount %**: Number input, 0-100, optional
5. **Tax Rate %**: Number input, 0-100, optional
6. **Total**: Read-only, calculated as:
   ```
   Total = Quantity × Unit Price × (1 - Discount/100) × (1 + Tax Rate/100)
   ```

**Actions**:
- Add Item button at bottom
- Delete button per row
- Drag handle for reordering

### CalculationsSummary

**Purpose**: Display and edit financial calculations

**Layout**:
```
┌────────────────────────────────┐
│ Subtotal          $1,200.00    │
├────────────────────────────────┤
│ Discount [10% ▼]  -$120.00    │
│ Tax Rate [10%]     $108.00     │
├────────────────────────────────┤
│ Total            $1,188.00     │
└────────────────────────────────┘
```

**Features**:
- Real-time calculation
- Currency formatting
- Editable fields (discount type, discount value, tax rate)
- Read-only fields (subtotal, discount amount, tax amount, total)

### DocumentPreview

**Purpose**: Preview document before sending/downloading

**Features**:
- PDF preview in modal
- Print view
- Download option
- Email from preview

### EmailDocumentModal

**Purpose**: Send document via email

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Send Quote/Invoice                                        │
│ ┌───────────────────────────────────────────────────┐  │
│ │ To: [client@email.com]                            │  │
│ │ Subject: [Quote Q-2026-0001 from Company]         │  │
│ │                                                   │  │
│ │ Message:                                          │  │
│ │ [Dear Client,                                     │  │
│ │  Please find attached quote for your review...]  │  │
│ │                                                   │  │
│ │ Attach PDF: [✓]                                   │  │
│ │ Include tracking link: [✓]                        │  │
│ └───────────────────────────────────────────────────┘  │
│                                                         │
│ [Cancel] [Send Email]                                  │
└─────────────────────────────────────────────────────────┘
```

**Features**:
- Pre-filled recipient email
- Editable subject line
- Editable message body
- Email template selection
- Attachment options
- Tracking link inclusion
- Send confirmation

## Responsive Design

### Breakpoints

```css
/* Mobile First Approach */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

### Responsive Behavior

#### Mobile (< 640px)
- Sidebar: Collapsible (off-canvas)
- Navigation: Bottom tab bar or hamburger menu
- Document List: Single column cards
- Document Detail: Stacked layout
- Line Items Table: Horizontal scroll or stacked cards
- Actions: Bottom sheet or modal

#### Tablet (640px - 1024px)
- Sidebar: Collapsible or icon-only
- Document List: 2-column grid
- Document Detail: Two-column layout
- Line Items Table: Full width with horizontal scroll
- Actions: Inline buttons

#### Desktop (≥ 1024px)
- Sidebar: Fixed, full width
- Document List: 3-4 column grid or table view
- Document Detail: Two-column layout
- Line Items Table: Full width
- Actions: Inline buttons

### Mobile-Specific Considerations

1. **Touch Targets**: Minimum 44x44px for buttons
2. **Input Fields**: Larger touch-friendly inputs
3. **Modals**: Full-screen on mobile
4. **Tables**: Horizontal scroll or card-based layout
5. **FAB**: Positioned bottom-right, accessible
6. **Navigation**: Bottom tab bar for quick access

## State Management

### Component State

**QuotesPage/InvoicesPage**:
- `documents`: Array of quotes/invoices
- `loading`: Boolean
- `error`: Error object
- `filters`: Filter object (status, search, dateRange)
- `sort`: Sort object (field, direction)
- `viewMode`: 'grid' | 'table'
- `pagination`: { page, limit, total }

**QuoteDetailPage/InvoiceDetailPage**:
- `document`: Quote/Invoice object
- `loading`: Boolean
- `error`: Error object
- `isEditing`: Boolean
- `hasChanges`: Boolean
- `showEmailModal`: Boolean
- `showPreviewModal`: Boolean

### Global State (Zustand)

**Use existing appStore**:
- `currentWorkspaceId`: string
- `sidebarOpen`: boolean
- `toggleSidebar()`: function

**Add new store for documents**:
```typescript
interface DocumentStore {
  // Quotes
  quotes: Quote[];
  currentQuote: Quote | null;
  setCurrentQuote: (quote: Quote | null) => void;
  
  // Invoices
  invoices: Invoice[];
  currentInvoice: Invoice | null;
  setCurrentInvoice: (invoice: Invoice | null) => void;
  
  // UI State
  viewMode: 'grid' | 'table';
  setViewMode: (mode: 'grid' | 'table') => void;
}
```

## Interactions and Animations

### Page Transitions

- Fade in: 300ms ease-in-out
- Slide in (modals): 300ms cubic-bezier(0.4, 0, 0.2, 1)

### Micro-interactions

1. **Hover Effects**:
   - Cards: Subtle lift (translateY -2px)
   - Buttons: Background color change
   - Table rows: Background highlight

2. **Focus States**:
   - Inputs: Ring focus (2px, secondary color)
   - Buttons: Scale effect (1.02)

3. **Loading States**:
   - Skeleton loaders
   - Spinner for buttons
   - Progress bars for file operations

4. **Success/Error Feedback**:
   - Toast notifications
   - Inline validation messages
   - Color changes (green/red)

### Drag and Drop

- Visual feedback during drag
- Smooth reordering animations
- Drop zone indicators

## Accessibility

### Keyboard Navigation

- Tab order: Logical flow
- Focus indicators: Visible outline
- Shortcuts: 
  - Ctrl/Cmd + N: New document
  - Ctrl/Cmd + S: Save
  - Ctrl/Cmd + E: Send email
  - Escape: Close modals

### Screen Reader Support

- ARIA labels for all interactive elements
- Semantic HTML structure
- Alt text for images
- Status announcements

### Color Contrast

- Minimum 4.5:1 for normal text
- Minimum 3:1 for large text
- Color not the only indicator (use icons, patterns)

## Performance Considerations

### Code Splitting

- Lazy load components
- Dynamic imports for modals
- Route-based code splitting

### Data Fetching

- Pagination for lists
- Infinite scroll option
- Cache strategies
- Optimistic updates

### Rendering

- Virtual scrolling for long lists
- Debounce search input
- Memoize expensive calculations

## File Structure

```
src/
├── app/
│   ├── quotes/
│   │   ├── page.tsx                    # Quotes list page
│   │   └── [id]/
│   │       └── page.tsx                # Quote detail page
│   ├── invoices/
│   │   ├── page.tsx                    # Invoices list page
│   │   └── [id]/
│   │       └── page.tsx                # Invoice detail page
│
├── components/
│   ├── quotes/
│   │   ├── QuotesList.tsx              # Quote list container
│   │   ├── QuoteCard.tsx               # Quote card component
│   │   ├── QuoteStatusBadge.tsx        # Status badge
│   │   ├── QuoteActions.tsx            # Action buttons
│   │   ├── QuoteDetail.tsx             # Quote detail container
│   │   ├── QuoteHeader.tsx             # Quote header
│   │   ├── QuoteClientInfo.tsx         # Client information form
│   │   ├── QuoteItemsEditor.tsx        # Line items editor
│   │   ├── QuoteSummary.tsx            # Calculations summary
│   │   ├── QuoteNotes.tsx              # Notes and terms
│   │   ├── QuoteActionsBar.tsx         # Action buttons bar
│   │   └── QuoteModal.tsx              # Create/edit modal
│   │
│   ├── invoices/
│   │   ├── InvoicesList.tsx            # Invoice list container
│   │   ├── InvoiceCard.tsx             # Invoice card component
│   │   ├── InvoiceStatusBadge.tsx      # Status badge
│   │   ├── InvoiceActions.tsx          # Action buttons
│   │   ├── InvoiceDetail.tsx           # Invoice detail container
│   │   ├── InvoiceHeader.tsx           # Invoice header
│   │   ├── InvoiceClientInfo.tsx       # Client information form
│   │   ├── InvoiceItemsEditor.tsx      # Line items editor
│   │   ├── InvoiceSummary.tsx         # Calculations summary
│   │   ├── InvoicePayments.tsx         # Payments section
│   │   ├── InvoiceNotes.tsx            # Notes and terms
│   │   ├── InvoiceActionsBar.tsx       # Action buttons bar
│   │   ├── InvoiceModal.tsx            # Create/edit modal
│   │   └── PaymentModal.tsx            # Record payment modal
│   │
│   └── documents/
│       ├── LineItemsTable.tsx          # Shared line items table
│       ├── LineItemRow.tsx             # Single line item row
│       ├── CalculationsSummary.tsx     # Shared calculations summary
│       ├── DocumentPreview.tsx         # Document preview modal
│       ├── EmailDocumentModal.tsx      # Email sending modal
│       ├── StatusBadge.tsx             # Shared status badge
│       ├── FilterBar.tsx               # Shared filter bar
│       └── ViewToggle.tsx              # Grid/table view toggle
│
├── store/
│   └── documentStore.ts                # Document state management
│
└── types/
    └── documents.ts                    # Document-specific types
```

## Implementation Phases

### Phase 1: Foundation (Week 1)
1. Set up file structure
2. Create base components (StatusBadge, FilterBar, ViewToggle)
3. Implement shared components (LineItemsTable, CalculationsSummary)
4. Set up document store

### Phase 2: Quotes UI (Week 2)
1. Implement Quotes page
2. Implement Quote detail page
3. Create Quote-specific components
4. Implement Quote actions

### Phase 3: Invoices UI (Week 3)
1. Implement Invoices page
2. Implement Invoice detail page
3. Create Invoice-specific components
4. Implement Invoice actions
5. Add payment recording

### Phase 4: Polish (Week 4)
1. Responsive design adjustments
2. Accessibility improvements
3. Performance optimization
4. Testing and bug fixes

## Success Criteria

1. **Visual Design**: Modern, minimalist, professional appearance
2. **User Experience**: Intuitive navigation, efficient workflows
3. **Responsiveness**: Seamless experience across all devices
4. **Accessibility**: WCAG 2.1 AA compliance
5. **Performance**: Fast load times, smooth interactions
6. **Consistency**: Aligns with existing design system

## Next Steps

1. Review this design specification
2. Provide feedback and approval
3. Begin implementation in Code mode
4. Iterate based on user testing
