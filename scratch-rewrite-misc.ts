import fs from 'fs';
import path from 'path';

const locales = ['en', 'ar', 'de', 'es', 'fr'];
const i18nDir = path.join(process.cwd(), 'src/i18n/messages');

const allKeys = {
  // quotes page
  actionSend: 'Send',
  moreOptions: 'More options',
  statusLabel: 'Status',
  statusDraft: 'Draft',
  statusSent: 'Sent',
  statusViewed: 'Viewed',
  statusAccepted: 'Accepted',
  statusRejected: 'Rejected',
  statusExpired: 'Expired',
  saveChanges: 'Save Changes',
  sendQuote: 'Send Quote',
  downloadPdf: 'Download PDF',
  convertToInvoice: 'Convert to Invoice',
  duplicateQuote: 'Duplicate Quote',
  deleteQuote: 'Delete Quote',
  
  // settings
  updating: 'Updating...',
  updatePassword: 'Update Password',
  integrations: 'Integrations',
  integrationsDesc: 'Connect external services to your workspace',
  loadingIntegrations: 'Loading integrations…',
  calendar: 'Calendar',
  videoConferencing: 'Video Conferencing',
  disconnect: 'Disconnect',

  // email blocks
  watchVideo: 'Watch video',
  unsubscribe: 'Unsubscribe',
  videoThumbnail: 'Video thumbnail',
  emailPreview: 'Email preview',

  // meeting list
  searchMeetings: 'Search meetings…',
  listView: 'List view',
  calendarView: 'Calendar view',
  refresh: 'Refresh',
  syncFromCalcom: 'Sync from Cal.com',

  // meeting modal
  phoneNumber: 'Phone Number',
  locationLabel: 'Location',
  meetingAgendaPlaceholder: 'Agenda or notes for this meeting…',
  crmContact: 'CRM contact',
  searchCrmContacts: 'Search CRM contacts…',
  firstNameRequired: 'First name *',
  lastName: 'Last name',
  emailLabel: 'Email',
  companyLabel: 'Company',
  phoneLabel: 'Phone',

  // templates
  estimatedTotal: 'Estimated total:',
  customTemplate: 'Custom Template',
  searchTemplates: 'Search templates…',
  yourCompany: 'Your Company',
  companyAddress: 'City, State 12345',
  itemDescription: 'Item Description',
  rateLabel: 'Rate',
  amountLabel: 'Amount',
  subtotalLabel: 'Subtotal',
  totalLabel: 'Total',

  // pdf
  billedTo: 'Billed to',
  detailsLabel: 'Details',
  unitPriceLabel: 'Unit price',
  discountLabel: 'Discount',
  issueDateLabel: 'Issue Date',
  validUntilLabel: 'Valid Until',
  notesLabel: 'Notes',
  termsLabel: 'Terms',
  description: 'Description',
  
  // automation engine
  unsubscribeReason: 'You are receiving this email because you signed up or were added to our list.',

  // old ones
  brandName: 'BorsFlow',
  meetingsNoWorkspace: 'Please select a workspace from the sidebar.',
  demoName: 'Avery Cole',
  aliceEditing: 'Alice is editing',
  deliveredLive: 'Delivered live but not saved to history',
  switchLanguage: 'Switch language',
  languageSelector: 'Language selector',
  closeProductPicker: 'Close product picker',
  searchProducts: 'Search by product name, SKU, or description',
  allPlatformsConnected: 'All platforms connected!',
  schedulingSetupComplete: 'Your scheduling is fully set up.',
  templatePreview: 'Template preview'
};

const interfaceProps = Object.keys(allKeys).map(k => `    ${k}: string;`).join('\n');
const valueProps = Object.entries(allKeys).map(([k, v]) => `    ${k}: '${v.replace(/'/g, "\\'")}',`).join('\n');

for (const lang of locales) {
  const filePath = path.join(i18nDir, `${lang}.ts`);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Regex to match misc object in interface (en.ts only)
  if (lang === 'en') {
    content = content.replace(/misc: \{[\s\S]*?\};/m, `misc: {\n${interfaceProps}\n  };`);
  }

  // Regex to match misc object in value
  content = content.replace(/misc: \{[\s\S]*?\},/m, `misc: {\n${valueProps}\n  },`);

  fs.writeFileSync(filePath, content);
  console.log(`Re-wrote misc in ${lang}.ts`);
}
