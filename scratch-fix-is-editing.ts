import fs from 'fs';

const locales = ['en', 'ar', 'de', 'es', 'fr'];

function main() {
  for (const lang of locales) {
    let c = fs.readFileSync(`src/i18n/messages/${lang}.ts`, 'utf-8');

    // Add isEditing interface
    if (lang === 'en') {
      const splitIdx = c.indexOf('const en: Messages = {');
      let iface = c.substring(0, splitIdx);
      let val = c.substring(splitIdx);
      
      if (!iface.includes('isEditing: string;')) {
          iface = iface.replace('export interface Messages {\n  workspace: {', `export interface Messages {\n  workspace: {\n    isEditing: string;`);
      }
      
      if (!val.includes('isEditing:')) {
          val = val.replace('const en: Messages = {\n  workspace: {', `const en: Messages = {\n  workspace: {\n    isEditing: '{name} is editing',`);
      }
      
      c = iface + val;
    } else {
        if (!c.includes('isEditing:')) {
            c = c.replace(`const ${lang}: Messages = {\n  workspace: {`, `const ${lang}: Messages = {\n  workspace: {\n    isEditing: '{name} is editing',`);
        }
    }

    fs.writeFileSync(`src/i18n/messages/${lang}.ts`, c);
    console.log(`Added isEditing to ${lang}.ts`);
  }
}

main();
