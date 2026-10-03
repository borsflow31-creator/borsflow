import fs from 'fs';

const locales = ['en', 'ar', 'de', 'es', 'fr'];

function objToTs(obj: any, indent = 2): string {
  const pad = ' '.repeat(indent);
  const lines: string[] = ['{'];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      lines.push(`${pad}${key}: ${objToTs(value, indent + 2)},`);
    } else if (typeof value === 'string') {
      lines.push(`${pad}${key}: '${value.replace(/'/g, "\\'")}',`);
    }
  }
  lines.push(`${' '.repeat(indent - 2)}}`);
  return lines.join('\n');
}

async function translateText(text: string, targetLang: string): Promise<string> {
  if (targetLang === 'en' || !text) return text;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data[0].map((x: any) => x[0]).join('');
  } catch { return text; }
}

async function main() {
  const newKeys = {
    header: {
      title: 'Pages',
      description: 'Create and manage your pages',
    },
    table: {
      actions: 'Actions',
      pageActions: 'Page actions'
    }
  };

  for (const lang of locales) {
    let c = fs.readFileSync(`src/i18n/messages/${lang}.ts`, 'utf-8');
    const isInterface = lang === 'en';
    
    let headerTrans = {
      title: isInterface ? 'string' : await translateText(newKeys.header.title, lang),
      description: isInterface ? 'string' : await translateText(newKeys.header.description, lang)
    };
    let tableTrans = {
      actions: isInterface ? 'string' : await translateText(newKeys.table.actions, lang),
      pageActions: isInterface ? 'string' : await translateText(newKeys.table.pageActions, lang)
    };

    const injectStr = `\n    header: ${objToTs(headerTrans, 6)},\n    table: ${objToTs(tableTrans, 6)},`;

    if (isInterface) {
      const splitIdx = c.indexOf('const en: Messages');
      let iface = c.substring(0, splitIdx);
      const val = c.substring(splitIdx);
      const insertIdx = iface.indexOf('exportShare: {', iface.indexOf('pages: {'));
      iface = iface.substring(0, insertIdx) + injectStr.trimStart() + '\n    ' + iface.substring(insertIdx);
      
      const insertIdxVal = val.indexOf('exportShare: {', val.indexOf('pages: {'));
      let newVal = val.substring(0, insertIdxVal) + injectStr.trimStart() + '\n    ' + val.substring(insertIdxVal);
      c = iface + newVal;
    } else {
      const insertIdx = c.indexOf('exportShare: {', c.indexOf('pages: {'));
      c = c.substring(0, insertIdx) + injectStr.trimStart() + '\n    ' + c.substring(insertIdx);
    }
    
    fs.writeFileSync(`src/i18n/messages/${lang}.ts`, c);
    console.log(`Updated ${lang}.ts`);
  }
}

main().catch(console.error);
