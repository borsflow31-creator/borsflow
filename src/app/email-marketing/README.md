# Email Marketing Page

A comprehensive email marketing management interface with full API integration and modern UI components.

## Features

### 📧 Campaigns
- **Campaign Management**: Create, edit, and manage email campaigns
- **Multiple Campaign Types**: Broadcast, Drip, Triggered, Behavioral, and Transactional campaigns
- **Campaign Statistics**: Real-time metrics including open rates, click rates, and delivery stats
- **Campaign Scheduling**: Schedule campaigns for future delivery
- **View Modes**: Switch between list and grid views for better organization
- **Search & Filter**: Quickly find campaigns by name or subject

### 📝 Templates
- **Template Management**: Create and manage reusable email templates
- **Dynamic Variables**: Insert placeholders for personalization (e.g., `{{first_name}}`)
- **HTML & Text Support**: Rich HTML content with plain text fallback
- **Template Types**: Marketing, Transactional, and Automation templates
- **Preview Mode**: Preview templates before sending

### 👥 Segments
- **Dynamic Segmentation**: Create customer segments based on lead attributes
- **Flexible Criteria**: Build complex rules with AND/OR logic
- **Multiple Conditions**: Add multiple conditions per segment
- **Segment Size Estimation**: See estimated number of leads in each segment
- **Active/Inactive Toggle**: Enable or disable segments as needed

### 📊 Analytics
- **Performance Metrics**: Comprehensive analytics dashboard
- **Key Metrics**: 
  - Total emails sent
  - Delivery rates
  - Open rates
  - Click rates
  - Bounce rates
- **Top Campaigns**: View best performing campaigns
- **Visual Charts**: Placeholder for performance over time charts

### ⚙️ Providers
- **Provider Management**: Configure multiple email service providers
- **Supported Providers**:
  - SendGrid
  - AWS SES
  - Resend
  - Mailgun
  - Postmark
  - Custom SMTP
- **Rate Limiting**: Set daily and monthly sending limits
- **Default Provider**: Mark a provider as default
- **Test Configuration**: Verify provider settings before saving

## Components

### Main Page
- **Location**: [`src/app/email-marketing/page.tsx`](src/app/email-marketing/page.tsx)
- **Features**: Tabbed interface with full CRUD operations for all email marketing entities

### Modals
- **CampaignModal**: [`src/components/email-marketing/CampaignModal.tsx`](src/components/email-marketing/CampaignModal.tsx)
- **TemplateModal**: [`src/components/email-marketing/TemplateModal.tsx`](src/components/email-marketing/TemplateModal.tsx)
- **SegmentModal**: [`src/components/email-marketing/SegmentModal.tsx`](src/components/email-marketing/SegmentModal.tsx)
- **ProviderModal**: [`src/components/email-marketing/ProviderModal.tsx`](src/components/email-marketing/ProviderModal.tsx)

## API Integration

### Campaigns API
- **GET** `/api/email-marketing/campaigns?workspaceId={id}` - Fetch all campaigns
- **POST** `/api/email-marketing/campaigns` - Create new campaign

### Templates API
- **GET** `/api/email-marketing/templates?workspaceId={id}` - Fetch all templates
- **POST** `/api/email-marketing/templates` - Create new template

## Data Models

### EmailCampaign
```typescript
interface EmailCampaign {
  id: string
  name: string
  description?: string
  type: 'broadcast' | 'drip' | 'triggered' | 'behavioral' | 'transactional'
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled'
  subject: string
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  bouncedCount: number
  scheduledAt?: string
  createdAt: string
}
```

### EmailTemplate
```typescript
interface EmailTemplate {
  id: string
  name: string
  description?: string
  type: 'marketing' | 'transactional' | 'automation'
  subject: string
  htmlContent: string
  textContent?: string
  variables?: string[]
  isDefault: boolean
  isActive: boolean
  createdAt: string
}
```

### SegmentationRule
```typescript
interface SegmentationRule {
  id: string
  name: string
  description?: string
  criteria: Condition[]
  logicOperator: 'AND' | 'OR'
  isActive: boolean
  estimatedSize?: number
  createdAt: string
}

interface Condition {
  field: string
  operator: string
  value: string
}
```

### EmailProvider
```typescript
interface EmailProvider {
  id: string
  name: string
  type: 'sendgrid' | 'ses' | 'resend' | 'mailgun' | 'postmark' | 'custom'
  apiKey: string
  region?: string
  fromEmail: string
  fromName?: string
  replyTo?: string
  dailyLimit?: number
  monthlyLimit?: number
  isActive: boolean
  isDefault: boolean
}
```

## Usage

### Basic Setup
```typescript
import EmailMarketingPage from '@/app/email-marketing/page'

// The page automatically fetches workspace ID from localStorage
// and loads campaigns and templates from the API
```

### Using Modals
```typescript
import { CampaignModal, TemplateModal, SegmentModal, ProviderModal } from '@/components/email-marketing'

// Campaign Modal
<CampaignModal
  isOpen={showCampaignModal}
  onClose={() => setShowCampaignModal(false)}
  onSave={handleSaveCampaign}
  workspaceId={workspaceId}
  templates={templates}
  segments={segments}
/>

// Template Modal
<TemplateModal
  isOpen={showTemplateModal}
  onClose={() => setShowTemplateModal(false)}
  onSave={handleSaveTemplate}
  workspaceId={workspaceId}
/>

// Segment Modal
<SegmentModal
  isOpen={showSegmentModal}
  onClose={() => setShowSegmentModal(false)}
  onSave={handleSaveSegment}
  workspaceId={workspaceId}
/>

// Provider Modal
<ProviderModal
  isOpen={showProviderModal}
  onClose={() => setShowProviderModal(false)}
  onSave={handleSaveProvider}
  workspaceId={workspaceId}
/>
```

## Features in Detail

### Campaign Management
1. **Create Campaign**: Click "Create Campaign" button to open the modal
2. **Fill Details**: 
   - Campaign name and description
   - Campaign type (broadcast, drip, etc.)
   - Subject line
   - Select template (optional)
   - Select segment (optional)
   - Schedule (optional)
   - Sender information
   - Tags
3. **Save**: Campaign is created and appears in the list
4. **Actions**: View, Edit, Duplicate, or Delete campaigns

### Template Management
1. **Create Template**: Click "Create New Template" card
2. **Fill Details**:
   - Template name and type
   - Subject line with variables
   - Define dynamic variables
   - HTML content
   - Plain text content (optional)
   - Tags
3. **Save**: Template is created and available for campaigns
4. **Preview**: Preview template before using

### Segment Management
1. **Create Segment**: Click "Create Segment" button
2. **Define Criteria**:
   - Segment name and description
   - Add conditions (field, operator, value)
   - Choose AND/OR logic
   - Add tags
3. **Save**: Segment is created and can be used in campaigns
4. **Estimate**: See estimated number of leads in segment

### Analytics Dashboard
1. **Overview**: View key metrics at a glance
2. **Performance**: Detailed statistics for sent, delivered, opened, clicked
3. **Rates**: Open rate, click rate, bounce rate
4. **Top Campaigns**: Best performing campaigns ranked by open rate

### Provider Configuration
1. **Add Provider**: Click "Add New Provider" card
2. **Configure**:
   - Provider name and type
   - API key
   - Email settings (from email, from name, reply to)
   - Rate limits (daily, monthly)
   - Set as default (optional)
3. **Test**: Verify configuration before saving
4. **Save**: Provider is added and ready to use

## Styling

The page uses Tailwind CSS for styling with a modern, clean design:
- **Color Scheme**: Indigo primary color with gray neutrals
- **Components**: Rounded corners, subtle shadows, hover effects
- **Responsive**: Mobile-friendly layout with grid and list views
- **Icons**: Lucide React icons for visual consistency

## Future Enhancements

- [ ] Real-time analytics with charts (Chart.js/Recharts)
- [ ] A/B testing functionality
- [ ] Email automation workflows
- [ ] Advanced segmentation with custom fields
- [ ] Email preview in multiple clients
- [ ] Bulk operations on campaigns
- [ ] Campaign cloning with customization
- [ ] Email performance reports export
- [ ] Integration with CRM for lead tracking
- [ ] Webhook support for external integrations

## Dependencies

- **React**: UI framework
- **Lucide React**: Icon library
- **Tailwind CSS**: Styling
- **Next.js**: Framework and routing

## Notes

- All API calls require authentication
- Workspace ID is required for all operations
- Data is automatically refreshed when switching tabs
- Form validation ensures data integrity
- Loading states provide visual feedback during operations
