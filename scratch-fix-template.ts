import fs from 'fs';

const locales = ['en', 'ar', 'de', 'es', 'fr'];

function main() {
  for (const lang of locales) {
    let c = fs.readFileSync(`src/i18n/messages/${lang}.ts`, 'utf-8');

    if (lang === 'en') {
      const splitIdx = c.indexOf('const en: Messages = {');
      let iface = c.substring(0, splitIdx);
      let val = c.substring(splitIdx);
      
      if (!iface.includes('templates: {')) {
          iface = iface.replace('export interface Messages {\n  workspace: {', `export interface Messages {\n  templates: {\n    picker: {\n      searchPlaceholder: string;\n    };\n  };\n  workspace: {`);
      }
      
      if (!val.includes('templates: {')) {
          val = val.replace('const en: Messages = {\n  workspace: {', `const en: Messages = {\n  templates: {\n    picker: {\n      searchPlaceholder: 'Search templates…',\n    },\n  },\n  workspace: {`);
      }
      
      c = iface + val;
    } else {
        if (!c.includes('templates: {')) {
            c = c.replace(`const ${lang}: Messages = {\n  workspace: {`, `const ${lang}: Messages = {\n  templates: {\n    picker: {\n      searchPlaceholder: 'Search templates…',\n    },\n  },\n  workspace: {`);
        }
    }

    fs.writeFileSync(`src/i18n/messages/${lang}.ts`, c);
    console.log(`Added templates to ${lang}.ts`);
  }
}

main();
