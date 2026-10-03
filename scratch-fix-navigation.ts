import fs from 'fs';

const locales = ['en', 'ar', 'de', 'es', 'fr'];

function main() {
  for (const lang of locales) {
    let c = fs.readFileSync(`src/i18n/messages/${lang}.ts`, 'utf-8');

    // Add navigation interface
    if (lang === 'en') {
      const splitIdx = c.indexOf('const en: Messages = {');
      let iface = c.substring(0, splitIdx);
      let val = c.substring(splitIdx);
      
      if (!iface.includes('navigation: {')) {
          iface = iface.replace('export interface Messages {', `export interface Messages {\n  navigation: {\n    sidebar: {\n      brand: string;\n      search: string;\n      inbox: string;\n      myTasks: string;\n      workspace: string;\n      settings: string;\n      templates: string;\n      trash: string;\n    };\n  };`);
      }
      
      if (!val.includes('navigation: {')) {
          val = val.replace('const en: Messages = {', `const en: Messages = {\n  navigation: {\n    sidebar: {\n      brand: 'Acme Corp',\n      search: 'Search',\n      inbox: 'Inbox',\n      myTasks: 'My Tasks',\n      workspace: 'Workspace',\n      settings: 'Settings',\n      templates: 'Templates',\n      trash: 'Trash',\n    },\n  },`);
      }
      
      c = iface + val;
    } else {
        if (!c.includes('navigation: {')) {
            c = c.replace(`const ${lang}: Messages = {`, `const ${lang}: Messages = {\n  navigation: {\n    sidebar: {\n      brand: 'Acme Corp',\n      search: 'Search',\n      inbox: 'Inbox',\n      myTasks: 'My Tasks',\n      workspace: 'Workspace',\n      settings: 'Settings',\n      templates: 'Templates',\n      trash: 'Trash',\n    },\n  },`);
        }
    }

    fs.writeFileSync(`src/i18n/messages/${lang}.ts`, c);
    console.log(`Added navigation to ${lang}.ts`);
  }
}

main();
