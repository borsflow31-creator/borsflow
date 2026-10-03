import fs from 'fs';

const locales = ['en', 'ar', 'de', 'es', 'fr'];

function main() {
  for (const lang of locales) {
    let c = fs.readFileSync(`src/i18n/messages/${lang}.ts`, 'utf-8');
    
    // Fix applyToChildren -> applyToChildPages
    c = c.replace(/applyToChildren/g, 'applyToChildPages');

    if (lang === 'en') {
      const splitIdx = c.indexOf('const en: Messages');
      let iface = c.substring(0, splitIdx);
      let val = c.substring(splitIdx);
      
      // Fix 'string' in interface
      iface = iface.replace(/title: 'string',/g, 'title: string;');
      iface = iface.replace(/description: 'string',/g, 'description: string;');
      iface = iface.replace(/actions: 'string',/g, 'actions: string;');
      iface = iface.replace(/pageActions: 'string',/g, 'pageActions: string;');

      // Fix values (they also got 'string' instead of the actual text!)
      val = val.replace(/title: 'string',/g, "title: 'Pages',");
      val = val.replace(/description: 'string',/g, "description: 'Create and manage your pages',");
      val = val.replace(/actions: 'string',/g, "actions: 'Actions',");
      val = val.replace(/pageActions: 'string',/g, "pageActions: 'Page actions',");
      
      c = iface + val;
    }

    fs.writeFileSync(`src/i18n/messages/${lang}.ts`, c);
    console.log(`Fixed ${lang}.ts`);
  }
}

main();
