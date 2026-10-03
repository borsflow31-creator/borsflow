import fs from 'fs';
import path from 'path';

const basePath = path.join(process.cwd(), 'src');

const replacements = [
  {
    file: 'app/quotes/[id]/page.tsx',
    replaces: [
      { find: />Send</g, replace: '>{t(\'misc.actionSend\')}<' },
      { find: /title="More options"/g, replace: 'title={t(\'misc.moreOptions\')}' },
      { find: />Status</g, replace: '>{t(\'misc.statusLabel\')}<' },
      { find: />Draft</g, replace: '>{t(\'misc.statusDraft\')}<' },
      { find: />Sent</g, replace: '>{t(\'misc.statusSent\')}<' },
      { find: />Viewed</g, replace: '>{t(\'misc.statusViewed\')}<' },
      { find: />Accepted</g, replace: '>{t(\'misc.statusAccepted\')}<' },
      { find: />Rejected</g, replace: '>{t(\'misc.statusRejected\')}<' },
      { find: />Expired</g, replace: '>{t(\'misc.statusExpired\')}<' },
      { find: />Save Changes</g, replace: '>{t(\'misc.saveChanges\')}<' },
      { find: />Send Quote</g, replace: '>{t(\'misc.sendQuote\')}<' },
      { find: />Download PDF</g, replace: '>{t(\'misc.downloadPdf\')}<' },
      { find: />Convert to Invoice</g, replace: '>{t(\'misc.convertToInvoice\')}<' },
      { find: />Duplicate Quote</g, replace: '>{t(\'misc.duplicateQuote\')}<' },
      { find: />Delete Quote</g, replace: '>{t(\'misc.deleteQuote\')}<' }
    ],
    needsI18n: true
  },
  {
    file: 'app/settings/page.tsx',
    replaces: [
      { find: />Updating\.\.\.</g, replace: '>{t(\'misc.updating\')}<' },
      { find: />Update Password</g, replace: '>{t(\'misc.updatePassword\')}<' },
      { find: />Integrations</g, replace: '>{t(\'misc.integrations\')}<' },
      { find: />Connect external services to your workspace</g, replace: '>{t(\'misc.integrationsDesc\')}<' },
      { find: />Loading integrations…</g, replace: '>{t(\'misc.loadingIntegrations\')}<' },
      { find: />Calendar</g, replace: '>{t(\'misc.calendar\')}<' },
      { find: />Video Conferencing</g, replace: '>{t(\'misc.videoConferencing\')}<' },
      { find: /title="Disconnect"/g, replace: 'title={t(\'misc.disconnect\')}' }
    ],
    needsI18n: true
  },
  {
    file: 'components/email-marketing/EmailBlockEditor.tsx',
    replaces: [
      { find: /alt="Watch video"/g, replace: 'alt={t(\'misc.watchVideo\')}' },
      { find: />Unsubscribe</g, replace: '>{t(\'misc.unsubscribe\')}<' },
      { find: /title="Email preview"/g, replace: 'title={t(\'misc.emailPreview\')}' }
    ],
    needsI18n: false // I'll use TFunction passed as param
  },
  {
    file: 'components/scheduling/MeetingList.tsx',
    replaces: [
      { find: /placeholder="Search meetings…"/g, replace: 'placeholder={t(\'misc.searchMeetings\')}' },
      { find: /aria-label="List view"/g, replace: 'aria-label={t(\'misc.listView\')}' },
      { find: /aria-label="Calendar view"/g, replace: 'aria-label={t(\'misc.calendarView\')}' },
      { find: /aria-label="Refresh"/g, replace: 'aria-label={t(\'misc.refresh\')}' },
      { find: /aria-label="Sync from Cal.com"/g, replace: 'aria-label={t(\'misc.syncFromCalcom\')}' }
    ],
    needsI18n: true
  },
  {
    file: 'components/scheduling/MeetingModal.tsx',
    replaces: [
      { find: />Phone Number</g, replace: '>{t(\'misc.phoneNumber\')}<' },
      { find: />Location</g, replace: '>{t(\'misc.locationLabel\')}<' },
      { find: /placeholder="Agenda or notes for this meeting…"/g, replace: 'placeholder={t(\'misc.meetingAgendaPlaceholder\')}' },
      { find: />CRM contact</g, replace: '>{t(\'misc.crmContact\')}<' },
      { find: /placeholder="Search CRM contacts…"/g, replace: 'placeholder={t(\'misc.searchCrmContacts\')}' },
      { find: /placeholder="First name \*"/g, replace: 'placeholder={t(\'misc.firstNameRequired\')}' },
      { find: /placeholder="Last name"/g, replace: 'placeholder={t(\'misc.lastName\')}' },
      { find: /placeholder="Email"/g, replace: 'placeholder={t(\'misc.emailLabel\')}' },
      { find: /placeholder="Company"/g, replace: 'placeholder={t(\'misc.companyLabel\')}' },
      { find: /placeholder="Phone"/g, replace: 'placeholder={t(\'misc.phoneLabel\')}' }
    ],
    needsI18n: true
  },
  {
    file: 'components/templates/TemplateAIPanel.tsx',
    replaces: [
      { find: />Estimated total:</g, replace: '>{t(\'misc.estimatedTotal\')}<' }
    ],
    needsI18n: true
  },
  {
    file: 'components/templates/TemplateCard.tsx',
    replaces: [
      { find: />Custom Template</g, replace: '>{t(\'misc.customTemplate\')}<' }
    ],
    needsI18n: true
  },
  {
    file: 'components/templates/TemplatePickerModal.tsx',
    replaces: [
      { find: /placeholder="Search templates…"/g, replace: 'placeholder={t(\'misc.searchTemplates\')}' }
    ],
    needsI18n: true
  },
  {
    file: 'components/templates/TemplatePreviewPanel.tsx',
    replaces: [
      { find: />Your Company</g, replace: '>{t(\'misc.yourCompany\')}<' },
      { find: />City, State 12345</g, replace: '>{t(\'misc.companyAddress\')}<' },
      { find: />Item Description</g, replace: '>{t(\'misc.itemDescription\')}<' },
      { find: />Rate</g, replace: '>{t(\'misc.rateLabel\')}<' },
      { find: />Amount</g, replace: '>{t(\'misc.amountLabel\')}<' },
      { find: />Subtotal</g, replace: '>{t(\'misc.subtotalLabel\')}<' },
      { find: />Total</g, replace: '>{t(\'misc.totalLabel\')}<' }
    ],
    needsI18n: true
  },
  {
    file: 'lib/automation-engine.ts',
    replaces: [
      { find: /You are receiving this email because you signed up or were added to our list\./g, replace: '{{unsubscribe_reason}}' }, // I will handle this via template var
      { find: />Unsubscribe</g, replace: '>{t(\'misc.unsubscribe\')}<' }
    ],
    needsI18n: false // I will do manual on this one later if it fails
  },
  {
    file: 'lib/documents/pdf.tsx',
    replaces: [
      { find: />Billed to</g, replace: '>{t(\'misc.billedTo\')}<' },
      { find: />Details</g, replace: '>{t(\'misc.detailsLabel\')}<' },
      { find: />Description</g, replace: '>{t(\'misc.description\')}<' },
      { find: />Unit price</g, replace: '>{t(\'misc.unitPriceLabel\')}<' },
      { find: />Amount</g, replace: '>{t(\'misc.amount\')}<' },
      { find: />Subtotal</g, replace: '>{t(\'misc.subtotalLabel\')}<' },
      { find: />Discount</g, replace: '>{t(\'misc.discountLabel\')}<' },
      { find: />Total</g, replace: '>{t(\'misc.totalLabel\')}<' }
    ],
    needsI18n: true
  }
];

function main() {
  for (const { file, replaces, needsI18n } of replacements) {
    const filePath = path.join(basePath, file);
    if (!fs.existsSync(filePath)) {
      console.log(`Not found: ${file}`);
      continue;
    }

    let c = fs.readFileSync(filePath, 'utf-8');

    for (const { find, replace } of replaces) {
      c = c.replace(find, replace);
    }

    // Add useI18n import and hook invocation if needed (rudimentary logic)
    if (needsI18n) {
      if (!c.includes('useI18n')) {
        // Insert import
        c = c.replace(/(import .*?;[\n\r]+)/, `$1import { useI18n } from '@/i18n/I18nProvider';\n`);
      }
      
      if (!c.includes('const { t } = useI18n()') && !c.includes('const { t,') && !c.includes(', t } = useI18n()')) {
        // Try to insert `const { t } = useI18n();` inside the component
        // Assuming component exports default function or function
        c = c.replace(/(export default function [a-zA-Z0-9_]+\(.*?\)\s*\{)/, `$1\n  const { t } = useI18n();`);
        c = c.replace(/(export function [a-zA-Z0-9_]+\(.*?\)\s*\{)/, `$1\n  const { t } = useI18n();`);
      }
    }

    fs.writeFileSync(filePath, c);
    console.log(`Patched ${file}`);
  }
}

main();
