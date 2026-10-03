import { mysigmailTemplateHtml } from './email-starter-templates-html'

export type StarterTemplateType = 'marketing' | 'transactional' | 'automation'

export type StarterTemplateLayout = 'editorial' | 'promotion' | 'confirmation'

export interface EmailStarterTemplate {
  id: string
  name: string
  tagline: string
  description: string
  category: string
  type: StarterTemplateType
  layout: StarterTemplateLayout
  subject: string
  accent: string
  mood: string
  previewImage: string
  variables: string[]
  tags: string[]
  metrics: {
    industry: string
    useCase: string
    layout: string
  }
  highlights: string[]
  htmlContent: string
  textContent: string
}

// Images must be absolute URLs: the HTML is stored on import and later sent to
// inboxes, where a relative path resolves to nothing.
const ASSET_PATH = '/email-templates/mysigmail'
const ASSET_BASE = `${(process.env.NEXT_PUBLIC_APP_URL || 'https://borsflow-oprg.vercel.app').replace(/\/$/, '')}${ASSET_PATH}`

const unsplash = (photo: string) => `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1200&q=60`

type ModelTemplateConfig = Omit<EmailStarterTemplate, 'htmlContent'>

const modelTemplates: ModelTemplateConfig[] = [
  {
    id: 'newsletter-1',
    name: 'Blog Digest',
    tagline: 'Three article cards with date, image and title',
    description: 'A clean list-style newsletter for sharing your latest posts. Each story gets a photo, a date and a headline that links to the full article.',
    category: 'Newsletter',
    type: 'marketing',
    layout: 'editorial',
    subject: 'This week from {{company_name}}',
    accent: '#222222',
    mood: 'Minimal',
    previewImage: `${ASSET_PATH}/newsletter-1/simon-migaj-Yui5vfKHuzs-unsplash.jpg`,
    variables: ['company_name', 'unsubscribe_url'],
    tags: ['newsletter', 'blog', 'digest'],
    metrics: { industry: 'Media & content', useCase: 'Weekly digest', layout: 'Stacked article cards' },
    highlights: ['Three stacked stories', 'Image-led cards', 'Social links in footer'],
    textContent: 'This week from {{company_name}}\n\nIs There a Perfect Time of Day to Meditate?\nHow Music Affects Your Productivity\nBackground Music for Coding\n\nUnsubscribe: {{unsubscribe_url}}',
  },
  {
    id: 'newsletter-2',
    name: 'Feature Story',
    tagline: 'Full-width hero story followed by two side-by-side reads',
    description: 'A magazine-style newsletter that leads with one big feature and a call to action, then two shorter articles in a two-column row.',
    category: 'Newsletter',
    type: 'marketing',
    layout: 'editorial',
    subject: 'Our latest story from {{company_name}}',
    accent: '#409eff',
    mood: 'Magazine',
    previewImage: unsplash('photo-1417577097439-425fb7dec05e'),
    variables: ['company_name', 'unsubscribe_url'],
    tags: ['newsletter', 'feature', 'editorial'],
    metrics: { industry: 'Media & content', useCase: 'Feature announcement', layout: 'Hero + two columns' },
    highlights: ['Big hero image', 'Primary call to action', 'Two-column follow-ups'],
    textContent: 'Video Stock: Your New Secret Weapon in Galaxy\n\nPocket Vlogging\nHow to become a pro video maker\n\nUnsubscribe: {{unsubscribe_url}}',
  },
  {
    id: 'ecommerce-1',
    name: 'New Arrivals',
    tagline: 'Product grid with price and Buy Now buttons',
    description: 'Show off new products side by side, each with an image, a short description, a price and its own Buy Now button.',
    category: 'E-commerce',
    type: 'marketing',
    layout: 'promotion',
    subject: 'New arrivals at {{company_name}}',
    accent: '#222222',
    mood: 'Retail',
    previewImage: `${ASSET_PATH}/ecommerce-1/t-shirt-1.png`,
    variables: ['company_name', 'unsubscribe_url'],
    tags: ['ecommerce', 'products', 'new arrivals'],
    metrics: { industry: 'Retail', useCase: 'Product drop', layout: 'Two-product grid' },
    highlights: ['Side-by-side products', 'Price on every card', 'Per-product buttons'],
    textContent: 'New arrivals at {{company_name}}\n\nExtended Shirt - $24.99\nExtended Shirt - $24.99\n\nUnsubscribe: {{unsubscribe_url}}',
  },
  {
    id: 'ecommerce-2',
    name: 'Product Launch',
    tagline: 'Dark hero spotlighting a single product',
    description: 'A bold, dark-background launch email that puts one product front and centre with a headline, a short pitch and a Buy Now button.',
    category: 'E-commerce',
    type: 'marketing',
    layout: 'promotion',
    subject: 'Introducing our newest product',
    accent: '#409eff',
    mood: 'Bold',
    previewImage: `${ASSET_PATH}/ecommerce-2/mbp-13-space.png`,
    variables: ['company_name', 'unsubscribe_url'],
    tags: ['ecommerce', 'launch', 'product'],
    metrics: { industry: 'Tech & retail', useCase: 'Single product launch', layout: 'Dark product hero' },
    highlights: ['One product, one message', 'Dark premium look', 'Single strong CTA'],
    textContent: "Unheard of Power\n\nWith our latest model of laptop, you'll get the most amazing features in your professional work.\n\nUnsubscribe: {{unsubscribe_url}}",
  },
  {
    id: 'request-reset-password-1',
    name: 'Password Reset (Simple)',
    tagline: 'Short message with a single reset button',
    description: 'A plain, text-first account email with one clear button. Works for password resets or any single-action notice.',
    category: 'Account',
    type: 'transactional',
    layout: 'confirmation',
    subject: 'Reset your {{company_name}} password',
    accent: '#409eff',
    mood: 'Plain',
    previewImage: unsplash('photo-1512941937669-90a1b58e7e9c'),
    variables: ['company_name'],
    tags: ['transactional', 'account', 'password'],
    metrics: { industry: 'Any', useCase: 'Account action', layout: 'Single CTA' },
    highlights: ['One clear action', 'Light and fast to load', 'Easy to repurpose'],
    textContent: "Reset your password\n\nNeed to reset your password? No problem! Just click the link below and you'll be on your way. If you did not make this request, please ignore this email.",
  },
  {
    id: 'request-reset-password-2',
    name: 'Password Reset (Image)',
    tagline: 'Image header with a centred reset call to action',
    description: 'A more visual account email with a photo banner and a centred button. Easy to adapt for verification or other account notices.',
    category: 'Account',
    type: 'transactional',
    layout: 'confirmation',
    subject: 'Reset your {{company_name}} password',
    accent: '#222222',
    mood: 'Visual',
    previewImage: unsplash('photo-1482887843465-b75f64e09f66'),
    variables: ['company_name'],
    tags: ['transactional', 'account', 'password'],
    metrics: { industry: 'Any', useCase: 'Account action', layout: 'Image banner + CTA' },
    highlights: ['Photo banner', 'Centred call to action', 'Branded footer'],
    textContent: 'Reset your password\n\nVisit this link to set a new password for your account.',
  },
]

export const emailStarterTemplates: EmailStarterTemplate[] = modelTemplates.map((template) => ({
  ...template,
  htmlContent: mysigmailTemplateHtml[template.id].split('__ASSET_BASE__').join(ASSET_BASE),
}))

export const starterTemplateCategories = [
  'All',
  ...Array.from(new Set(emailStarterTemplates.map((template) => template.category))),
]
