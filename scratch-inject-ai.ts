import fs from 'fs';

const newKeys: Record<string, any> = {
  ai: {
    chat: {
      heading: "How can I help?",
      subheading: "Ask me anything about your workspace, documents, or tasks.",
      placeholder: "Ask anything...",
    }
  }
};

async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text) return text;
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

function injectKey(filePath: string, keyName: string, value: any) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes(`\n  ${keyName}: {`)) { console.log(`${filePath}: ${keyName} already exists`); return; }
  const valueBlock = `\n  ${keyName}: ${objToTs(value, 4)},\n  public: {`;
  content = content.replace(/\n\s*public:\s*\{/, valueBlock);
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath}`);
}

async function main() {
  // en.ts needs both interface and values
  let enContent = fs.readFileSync('src/i18n/messages/en.ts', 'utf-8');
  
  // Inject interface
  if (!enContent.includes('\n  ai: {')) {
    const interfaceBlock = `\n  ai: {\n    chat: {\n      heading: string;\n      subheading: string;\n      placeholder: string;\n    };\n  };\n  public: {`;
    enContent = enContent.replace(/\n\s*public:\s*\{/, interfaceBlock);
    fs.writeFileSync('src/i18n/messages/en.ts', enContent);
    console.log('Updated en.ts interface');
  }
  
  // Inject values into each locale
  for (const [keyName, value] of Object.entries(newKeys)) {
    injectKey('src/i18n/messages/en.ts', keyName, value);
    for (const [lang, label] of [['fr','FR'], ['de','DE'], ['es','ES'], ['ar','AR']]) {
      console.log(`Translating ${keyName} to ${label}...`);
      const translated = await traverseAndTranslate(value, lang);
      injectKey(`src/i18n/messages/${lang}.ts`, keyName, translated);
    }
  }
  console.log('Done!');
}

main().catch(console.error);
