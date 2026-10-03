import fs from 'fs';
const c = fs.readFileSync('src/i18n/messages/en.ts','utf-8');
const splitIdx = c.indexOf('const en: Messages');
const before = c.substring(0, splitIdx);
const after = c.substring(splitIdx);
const valStr = `  languageSwitcher: {\n    tooltip: 'Change language',\n    closeAriaLabel: 'Close language menu'\n  },\n`;
const insertAt = after.indexOf('  public: {');
if (insertAt !== -1) {
  fs.writeFileSync('src/i18n/messages/en.ts', before + after.substring(0, insertAt) + valStr + after.substring(insertAt));
  console.log('Added languageSwitcher');
}
