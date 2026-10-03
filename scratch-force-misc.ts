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
};

function main() {
  for (const lang of locales) {
    const filePath = path.join(i18nDir, `${lang}.ts`);
    let content = fs.readFileSync(filePath, 'utf-8');

    // Make sure misc object exists in value
    const valDecl = `const ${lang}: Messages = {`;
    if (!content.includes(valDecl + '\\n  misc: {') && !content.includes(valDecl + '\\r\\n  misc: {')) {
      const splitIdx = content.indexOf(valDecl);
      if (splitIdx !== -1) {
         let before = content.substring(0, splitIdx + valDecl.length);
         let after = content.substring(splitIdx + valDecl.length);
         // Find if it has misc elsewhere in the value
         const miscRegex = new RegExp(`const ${lang}: Messages = {[\\s\\S]*?misc: {`);
         if (!miscRegex.test(content)) {
           content = before + '\n  misc: {\n  },' + after;
         }
      }
    }

    // Now inject keys
    for (const [key, value] of Object.entries(keysToAdd)) {
      if (lang === 'en') {
        if (!content.includes(`    ${key}: string;`)) {
          content = content.replace(/export interface Messages \{[\s\S]*?misc: \{/, match => match + `\n    ${key}: string;`);
        }
      }
      
      const escapedValue = value.replace(/'/g, "\\'");
      if (!content.includes(`    ${key}: '`)) {
        content = content.replace(new RegExp(`(const ${lang}: Messages = {[\\s\\S]*?misc: {)`), `$1\n    ${key}: '${escapedValue}',`);
      }
    }

    fs.writeFileSync(filePath, content);
    console.log(`Force updated ${lang}.ts`);
  }
}

main();
