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

async function traverseAndTranslate(obj: any, lang: string): Promise<any> {
  const result: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'object' && v !== null) {
      result[k] = await traverseAndTranslate(v, lang);
    } else if (typeof v === 'string') {
      const parts = v.split(/(\{[^}]+\})/g);
      let out = '';
      for (const p of parts) {
        out += (p.startsWith('{') && p.endsWith('}')) ? p : (p.trim() ? await translateText(p, lang) : p);
      }
      result[k] = out.trim();
    } else { result[k] = v; }
  }
  return result;
}

function findTopKeyClose(content: string, topKey: string, startAfter: number): number {
  const topKeyIdx = content.indexOf(`\n  ${topKey}: {`, startAfter);
  if (topKeyIdx === -1) return -1;
  let depth = 0;
  for (let i = topKeyIdx; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

async function main() {
  const baseViewToggle = {
    ariaLabel: 'View mode toggle',
    gridView: 'Grid view',
    tableView: 'Table view',
  };

  for (const lang of locales) {
    let c = fs.readFileSync(`src/i18n/messages/${lang}.ts`, 'utf-8');
    const splitIdx = lang === 'en' ? c.indexOf('const en: Messages') : 0;
    
    // 1. Add viewToggle to documents
    const translatedViewToggle = await traverseAndTranslate(baseViewToggle, lang);
    
    const docClose = findTopKeyClose(c, 'documents', splitIdx);
    if (docClose !== -1) {
      // check if it's already there right before docClose
      const beforeClose = c.substring(docClose - 50, docClose);
      if (!beforeClose.includes('viewToggle')) {
        const subBlock = `\n    viewToggle: ${objToTs(translatedViewToggle, 6)},`;
        c = c.substring(0, docClose) + subBlock + '\n  ' + c.substring(docClose);
      }
    }

    // 2. Fix languageSwitcher in non-en
    if (lang !== 'en') {
      const lsStrOld = `languageSwitcher: {
    switchAriaLabel: '${await translateText("Switch language", lang).catch(()=>"")}',
    selectorAriaLabel: '${await translateText("Language selector", lang).catch(()=>"")}'
  }`;
      // Let's just do a string replace with regex for languageSwitcher
      const lsRegex = /languageSwitcher: \{\s*switchAriaLabel: [^,]+,\s*selectorAriaLabel: [^\}]+\}/;
      const lsStrNew = `languageSwitcher: {
    tooltip: '${await translateText("Change language", lang)}',
    closeAriaLabel: '${await translateText("Close language menu", lang)}'
  }`;
      c = c.replace(lsRegex, lsStrNew);
    }
    
    fs.writeFileSync(`src/i18n/messages/${lang}.ts`, c);
    console.log(`Fixed ${lang}.ts`);
  }
}

main().catch(console.error);
