import fs from 'fs';

const locales = ['en', 'ar', 'de', 'es', 'fr'];

function main() {
  for (const lang of locales) {
    let c = fs.readFileSync(`src/i18n/messages/${lang}.ts`, 'utf-8');

    // Add picker interface
    if (lang === 'en') {
      const splitIdx = c.indexOf('const en: Messages = {');
      let iface = c.substring(0, splitIdx);
      let val = c.substring(splitIdx);
      
      if (!iface.includes('picker: {')) {
          iface = iface.replace('export interface Messages {\n  products: {', `export interface Messages {\n  products: {\n    picker: {\n      close: string;\n      searchPlaceholder: string;\n    };`);
      }
      
      if (!val.includes('picker: {')) {
          val = val.replace('const en: Messages = {\n  products: {', `const en: Messages = {\n  products: {\n    picker: {\n      close: 'Close product picker',\n      searchPlaceholder: 'Search by product name, SKU, or description',\n    },`);
      }
      
      c = iface + val;
    } else {
        if (!c.includes('picker: {')) {
            c = c.replace(`const ${lang}: Messages = {\n  products: {`, `const ${lang}: Messages = {\n  products: {\n    picker: {\n      close: 'Close product picker',\n      searchPlaceholder: 'Search by product name, SKU, or description',\n    },`);
        }
    }

    fs.writeFileSync(`src/i18n/messages/${lang}.ts`, c);
    console.log(`Added products.picker to ${lang}.ts`);
  }
}

main();
