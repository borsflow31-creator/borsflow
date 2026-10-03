import fs from 'fs';

async function translateText(text: string, targetLang: string) {
  if (!text || typeof text !== 'string') return text;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data[0].map((x: any) => x[0]).join('');
  } catch (e) {
    return text;
  }
}

async function traverseAndTranslate(obj: any, targetLang: string): Promise<any> {
  const translated: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      translated[key] = await traverseAndTranslate(value, targetLang);
    } else if (typeof value === 'string') {
      const parts = value.split(/(\{[^}]+\})/g);
      let result = '';
      for (let part of parts) {
        if (part.startsWith('{') && part.endsWith('}')) {
          result += part;
        } else if (part.trim().length > 0) {
          result += await translateText(part, targetLang);
        } else {
          result += part;
        }
      }
      translated[key] = result.trim();
    } else {
      translated[key] = value;
    }
  }
  return translated;
}

function injectIntoFile(filePath: string, newKeyName: string, translatedObj: any) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes(`${newKeyName}: {`)) {
    console.log(`Already injected into ${filePath}`);
    return;
  }
  const jsonStr = JSON.stringify(translatedObj, null, 2);
  const innerContent = jsonStr.substring(jsonStr.indexOf('{') + 1, jsonStr.lastIndexOf('}')).trim();

  const lines = innerContent.split('\n').map(l => '  ' + l);
  const injection = `\n  ${newKeyName}: {\n${lines.join('\n')}\n  },\n  public: {`;

  content = content.replace(/\n\s*public:\s*\{/, injection);
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath}`);
}

async function main() {
  const missingStr = fs.readFileSync('missing_de.json', 'utf-8');
  const missingDe = JSON.parse(missingStr);

  console.log('Translating to DE...');
  const deData = await traverseAndTranslate(missingDe.scheduling, 'de');
  injectIntoFile('src/i18n/messages/de.ts', 'scheduling', deData);

  console.log('Translating to ES...');
  const esData = await traverseAndTranslate(missingDe.scheduling, 'es');
  injectIntoFile('src/i18n/messages/es.ts', 'scheduling', esData);

  console.log('Translating to AR...');
  const arData = await traverseAndTranslate(missingDe.scheduling, 'ar');
  injectIntoFile('src/i18n/messages/ar.ts', 'scheduling', arData);

  console.log('Done!');
}
main();
