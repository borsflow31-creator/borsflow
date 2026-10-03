import fs from 'fs';
import path from 'path';

const locales = ['en', 'ar', 'de', 'es', 'fr'];
const i18nDir = path.join(process.cwd(), 'src/i18n/messages');

const keysToAdd: Record<string, string> = {
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
  
  // automation engine
  unsubscribeReason: 'You are receiving this email because you signed up or were added to our list.',
};

function main() {
  if (Object.keys(keysToAdd).length === 0) {
    console.log('No keys to add.');
    return;
  }

  for (const lang of locales) {
    const filePath = path.join(i18nDir, `${lang}.ts`);
    let content = fs.readFileSync(filePath, 'utf-8');

    // Make sure misc namespace exists
    if (lang === 'en' && !content.includes('misc: {')) {
      content = content.replace('export interface Messages {', 'export interface Messages {\n  misc: {\n  };');
    }
    if (!content.includes('misc: {')) {
      if (lang === 'en') {
        content = content.replace('const en: Messages = {', 'const en: Messages = {\n  misc: {\n  },');
      } else {
        content = content.replace(`const ${lang}: Messages = {`, `const ${lang}: Messages = {\n  misc: {\n  },`);
      }
    }

    // Add keys
    for (const [key, value] of Object.entries(keysToAdd)) {
      if (lang === 'en') {
        // Add to interface
        if (!content.includes(`    ${key}: string;`)) {
          content = content.replace(/misc: {/, `misc: {\n    ${key}: string;`);
        }
      }
      
      // Add to value
      if (!content.includes(`    ${key}: `)) {
         const escapedValue = value.replace(/'/g, "\\'");
         content = content.replace(
           new RegExp(`(const ${lang}: Messages = {[\\s\\S]*?misc: {)`),
           `$1\n    ${key}: '${escapedValue}',`
         );
      }
    }

    fs.writeFileSync(filePath, content);
    console.log(`Updated misc keys in ${lang}.ts`);
  }
}

main();
