import fs from 'fs';
import path from 'path';

const i18nDir = path.join(process.cwd(), 'src/i18n/messages');
const enFile = path.join(i18nDir, 'en.ts');

const missingKeys = {
  common: {
    unexpectedError: 'Unexpected error',
    tryAgain: 'Try again',
    clearFilters: 'Clear filters',
    previous: 'Previous',
    or: 'Or'
  },
  auth: {
    signIn: 'Sign In',
    nameRequired: 'Name is required',
    passwordTooShort: 'Password too short',
    passwordMismatch: 'Passwords do not match',
    name: 'Name',
    createWorkspace: 'Create Workspace'
  },
  misc: {
    amount: 'Amount'
  }
};

let enContent = fs.readFileSync(enFile, 'utf-8');

for (const [top, obj] of Object.entries(missingKeys)) {
  for (const [k, v] of Object.entries(obj)) {
    if (!enContent.includes(`    ${k}: string;`)) {
      const iRegex = new RegExp(`(\\n  ${top}: \\{[\\s\\S]*?)(\\n  \\};)`);
      enContent = enContent.replace(iRegex, `$1\n    ${k}: string;$2`);
    }
    if (!enContent.includes(`    ${k}: '`)) {
      const vRegex = new RegExp(`(const en: Messages = \\{[\\s\\S]*?\\n  ${top}: \\{[\\s\\S]*?)(\\n  \\},)`);
      enContent = enContent.replace(vRegex, `$1\n    ${k}: '${v}',$2`);
    }
  }
}

fs.writeFileSync(enFile, enContent);
console.log('Fixed final keys');

for (const lang of ['ar', 'de', 'es', 'fr']) {
  const content = enContent.replace(/export const en: Messages = \{/, `export const ${lang}: Messages = {`);
  fs.writeFileSync(path.join(i18nDir, `${lang}.ts`), content);
}
