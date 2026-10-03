import fs from 'fs';

const files = [
  'src/app/settings/page.tsx',
  'src/components/scheduling/MeetingModal.tsx',
  'src/components/templates/TemplatePickerModal.tsx',
  'src/components/templates/TemplatePreviewPanel.tsx'
];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf-8');
  if (!c.includes('useI18n')) {
    c = c.replace(/import /, "import { useI18n } from '@/i18n/I18nProvider';\nimport ");
  }
  if (!c.includes('const { t } = useI18n()')) {
    // For React components we just find the export default function or export function
    c = c.replace(/(export (?:default )?function [A-Za-z0-9_]+\([\s\S]*?\)\s*\{)/, "$1\n  const { t } = useI18n();");
  }
  fs.writeFileSync(f, c);
  console.log('Fixed', f);
});
