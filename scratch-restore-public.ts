import fs from 'fs';

const locales = ['en', 'ar', 'de', 'es', 'fr'];

function main() {
  for (const lang of locales) {
    let c = fs.readFileSync(`src/i18n/messages/${lang}.ts`, 'utf-8');

    // Add public interface
    if (lang === 'en') {
      const splitIdx = c.indexOf('const en: Messages = {');
      let iface = c.substring(0, splitIdx);
      let val = c.substring(splitIdx);
      
      if (!iface.includes('public: {')) {
          iface = iface.replace('export interface Messages {', `export interface Messages {\n  public: {\n    languageSwitcher: {\n      tooltip: string;\n      closeAriaLabel: string;\n    };\n  };`);
      }
      
      if (!val.includes('public: {')) {
          val = val.replace('const en: Messages = {', `const en: Messages = {\n  public: {\n    languageSwitcher: {\n      tooltip: 'Language',\n      closeAriaLabel: 'Close language switcher',\n    },\n  },`);
      }
      
      c = iface + val;
    } else {
        if (!c.includes('public: {')) {
            c = c.replace(`const ${lang}: Messages = {`, `const ${lang}: Messages = {\n  public: {\n    languageSwitcher: {\n      tooltip: 'Language',\n      closeAriaLabel: 'Close language switcher',\n    },\n  },`);
        }
    }

    fs.writeFileSync(`src/i18n/messages/${lang}.ts`, c);
    console.log(`Added public to ${lang}.ts`);
  }
}

main();
