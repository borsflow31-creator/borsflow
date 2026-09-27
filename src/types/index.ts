export interface User {
    id: string
    email: string
    name: string | null
    createdAt: Date
    updatedAt: Date
}

export interface Workspace {
    id: string
    name: string
    description: string | null
    icon: string | null
    ownerId: string
    createdAt: Date
    updatedAt: Date
}

export interface Page {
    id: string
    title: string
    icon: string | null
    coverImage: string | null
    workspaceId: string
    parentId: string | null
    order: number
    content: any
    createdAt: Date
    updatedAt: Date
}

export interface Block {
    id: string
    pageId: string
    type: BlockType
    content: BlockContent
    order: number
    createdAt: Date
    updatedAt: Date
}

export type BlockType =
    | 'text'
    | 'heading'
    | 'subheading'
    | 'subsubheading'
    | 'bullet'
    | 'numbered'
    | 'todo'
    | 'divider'
    | 'image'
    | 'code'
    | 'quote'
    | 'callout'
    | 'toggle'
    | 'table'
    | 'link'
    | 'bookmark'
    | 'date'
    | 'tag'
    | 'video'
    | 'file'
    | 'equation'

export interface BlockContent {
    // Common fields
    text?: string
    checked?: boolean
    url?: string
    language?: string
    children?: BlockContent[]
    
    // Callout block
    icon?: string
    color?: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple'
    
    // Toggle block
    toggleTitle?: string
    toggleContent?: string
    isOpen?: boolean
    
    // Image block
    caption?: string
    alt?: string
    
    // Table block
    headers?: string[]
    rows?: string[][]
    
    // Link block
    linkTitle?: string
    
    // Bookmark block
    bookmarkTitle?: string
    description?: string
    bookmarkImage?: string
    
    // Date block
    date?: string
    reminder?: boolean
    reminderTime?: string
    
    // Tag block
    tagColor?: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'pink' | 'orange'
    
    // Video block
    platform?: 'youtube' | 'vimeo'
    videoId?: string
    
    // File block
    fileName?: string
    fileSize?: number
    fileType?: string
    
    // Equation block
    latex?: string
}

export interface KanbanColumn {
    id: string
    title: string
    cards: KanbanCard[]
    order: number
}

export interface KanbanCard {
    id: string
    title: string
    description: string | null
    assignee: string | null
    dueDate: Date | null
    labels: string[]
    order: number
}

export interface SearchFilters {
    workspaceId?: string
    type?: 'page' | 'block'
    dateFrom?: Date
    dateTo?: Date
}

export interface ExportFormat {
    type: 'markdown' | 'html' | 'pdf'
    options?: {
        includeImages?: boolean
        includeMetadata?: boolean
    }
}

// Quote and Invoice Types
export interface Quote {
    id: string
    quoteNumber: string
    workspaceId: string
    leadId: string | null
    clientName: string
    clientEmail: string | null
    clientPhone: string | null
    clientCompany: string | null
    clientAddress: Address | null
    status: QuoteStatus
    issueDate: Date
    validUntil: Date | null
    currency: string
    subtotal: number
    taxRate: number
    taxAmount: number
    discountType: DiscountType | null
    discountValue: number
    discountAmount: number
    total: number
    notes: string | null
    terms: string | null
    internalNotes: string | null
    sentAt: Date | null
    viewedAt: Date | null
    acceptedAt: Date | null
    rejectedAt: Date | null
    createdBy: string
    updatedBy: string | null
    lead?: { id: string; firstName: string; lastName: string } | null
    items: QuoteItem[]
    quoteNotes: QuoteNote[]
    createdAt: Date
    updatedAt: Date
}

export type QuoteStatus =
    | 'draft'
    | 'sent'
    | 'viewed'
    | 'accepted'
    | 'rejected'
    | 'expired'

export interface QuoteItem {
    id: string
    quoteId: string
    description: string
    quantity: number
    unitPrice: number
    discount: number
    taxRate: number
    total: number
    order: number
    createdAt: Date
    updatedAt: Date
}

export interface QuoteNote {
    id: string
    quoteId: string
    content: string
    isPrivate: boolean
    createdBy: string
    createdAt: Date
    updatedAt: Date
}

export interface Invoice {
    id: string
    invoiceNumber: string
    workspaceId: string
    leadId: string | null
    quoteId: string | null
    clientName: string
    clientEmail: string | null
    clientPhone: string | null
    clientCompany: string | null
    clientAddress: Address | null
    status: InvoiceStatus
    issueDate: Date
    dueDate: Date | null
    paidDate: Date | null
    currency: string
    subtotal: number
    taxRate: number
    taxAmount: number
    discountType: DiscountType | null
    discountValue: number
    discountAmount: number
    total: number
    amountPaid: number
    amountDue: number
    paymentMethod: string | null
    paymentReference: string | null
    stripeCustomerId: string | null
    stripePaymentLink: string | null
    stripePaymentLinkId: string | null
    notes: string | null
    terms: string | null
    internalNotes: string | null
    sentAt: Date | null
    viewedAt: Date | null
    createdBy: string
    updatedBy: string | null
    items: InvoiceItem[]
    invoiceNotes: InvoiceNote[]
    payments: Payment[]
    createdAt: Date
    updatedAt: Date
}

export type InvoiceStatus =
    | 'draft'
    | 'sent'
    | 'viewed'
    | 'partially_paid'
    | 'paid'
    | 'overdue'
    | 'cancelled'

export interface InvoiceItem {
    id: string
    invoiceId: string
    description: string
    quantity: number
    unitPrice: number
    discount: number
    taxRate: number
    total: number
    order: number
    createdAt: Date
    updatedAt: Date
}

export interface InvoiceNote {
    id: string
    invoiceId: string
    content: string
    isPrivate: boolean
    createdBy: string
    createdAt: Date
    updatedAt: Date
}

export interface Payment {
    id: string
    invoiceId: string
    amount: number
    paymentDate: Date
    paymentMethod: PaymentMethod
    referenceNumber: string | null
    notes: string | null
    createdBy: string
    createdAt: Date
    updatedAt: Date
}

export type PaymentMethod =
    | 'cash'
    | 'bank_transfer'
    | 'check'
    | 'credit_card'
    | 'other'

export type DiscountType = 'percentage' | 'fixed'

export interface Address {
    street: string
    city: string
    state: string
    postalCode: string
    country: string
}

export interface QuoteFilters {
    status?: QuoteStatus
    leadId?: string
    search?: string
    dateFrom?: Date
    dateTo?: Date
}

export interface InvoiceFilters {
    status?: InvoiceStatus
    leadId?: string
    quoteId?: string
    search?: string
    dateFrom?: Date
    dateTo?: Date
}

export interface EmailData {
    to: string
    subject?: string
    message?: string
    template?: string
}

// ─── Universal Template System ────────────────────────────────────────────────

export type TemplateType = 'page' | 'quote' | 'invoice' | 'kanban'

export interface TemplateCategory {
    id: string
    name: string
    slug: string
    description: string | null
    icon: string | null
    order: number
    createdAt: Date
    updatedAt: Date
}

export interface UniversalTemplate {
    id: string
    name: string
    description: string | null
    type: TemplateType
    categoryId: string | null
    category?: { id: string; name: string; slug: string; icon: string | null } | null
    workspaceId: string | null
    isSystem: boolean
    isPublic: boolean
    content: string // raw JSON blob — parse with JSON.parse()
    previewImage: string | null
    icon: string | null
    tags: string | null // JSON array string
    version: number
    parentId: string | null
    usageCount: number
    createdById: string | null
    createdAt: Date
    updatedAt: Date
}

// Parsed content shapes (result of JSON.parse(template.content))

export interface PageTemplateContent {
    title: string
    icon?: string
    blocks: Array<{
        type: BlockType
        content: BlockContent
    }>
}

export interface QuoteTemplateContent {
    notes?: string
    terms?: string
    currency?: string
    taxRate?: number
    items: Array<{
        description: string
        quantity: number
        unitPrice: number
    }>
}

export type InvoiceTemplateContent = QuoteTemplateContent

export interface KanbanTemplateContent {
    projectName: string
    projectColor?: string
    description?: string
    cards: Array<{
        title: string
        status: 'todo' | 'inprogress' | 'done'
        priority: 'low' | 'medium' | 'high'
    }>
}

export interface Product {
    id: string
    workspaceId: string
    name: string
    description: string | null
    sku: string | null
    price: number
    unit: string | null
    category: string | null
    taxRate: number
    stockQuantity: number | null
    isActive: boolean
    createdById: string | null
    createdAt: Date
    updatedAt: Date
}

export interface ProductPickResult {
    description: string
    unitPrice: number
    taxRate: number
    unit: string | null
}

export type ProductCSVField =
    | 'name'
    | 'description'
    | 'sku'
    | 'price'
    | 'unit'
    | 'category'
    | 'taxRate'
    | 'stockQuantity'
    | '__skip__'

export interface CSVImportResult {
    created: number
    skipped: number
    errors: Array<{ row: number; message: string }>
}
