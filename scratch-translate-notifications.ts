import fs from 'fs';

const englishData = {
    bell: {
      title: "Notifications",
      unreadCount: "Notifications, {count} unread",
      all: "All",
      unread: "Unread",
      markAllRead: "Mark all read",
      loading: "Loading…",
      caughtUp: "You're all caught up",
      empty: "No notifications yet",
      today: "Today",
      earlier: "Earlier",
      settings: "Notification settings"
    }
};

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
  if (content.includes(`\n  ${newKeyName}: {`)) {
    console.log(`Already injected into ${filePath}`);
    return;
  }
  
  const jsonStr = JSON.stringify(translatedObj, null, 2);
  let innerContent = jsonStr.substring(jsonStr.indexOf('{') + 1, jsonStr.lastIndexOf('}')).trim();

  // Remove quotes around keys for TS
  innerContent = innerContent.replace(/"([^"]+)":/g, '$1:');

  const lines = innerContent.split('\n').map(l => '  ' + l);
  const injection = `\n  ${newKeyName}: {\n${lines.join('\n')}\n  },\n  public: {`;

  content = content.replace(/\n\s*public:\s*\{/g, injection);
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath}`);
}

async function main() {
  console.log('EN...');
  let enContent = fs.readFileSync('src/i18n/messages/en.ts', 'utf-8');
  if (!enContent.includes('\n  notifications: {')) {
      const interfaceJsonStr = JSON.stringify(englishData, null, 2);
      let interfaceInner = interfaceJsonStr.substring(interfaceJsonStr.indexOf('{') + 1, interfaceJsonStr.lastIndexOf('}')).trim();
      interfaceInner = interfaceInner.replace(/: ".*"(,?)/g, ': string;');
      interfaceInner = interfaceInner.replace(/"([^"]+)":/g, '$1:');
      const interfaceLines = interfaceInner.split('\n').map(l => '  ' + l);
      const interfaceInjection = `\n  notifications: {\n${interfaceLines.join('\n')}\n  },\n  public: {`;

      const valueJsonStr = JSON.stringify(englishData, null, 2);
      let valueInner = valueJsonStr.substring(valueJsonStr.indexOf('{') + 1, valueJsonStr.lastIndexOf('}')).trim();
      valueInner = valueInner.replace(/"([^"]+)":/g, '$1:');
      const valueLines = valueInner.split('\n').map(l => '  ' + l);
      const valueInjection = `\n  notifications: {\n${valueLines.join('\n')}\n  },\n  public: {`;

      const parts = enContent.split(/\n\s*public:\s*\{/);
      if (parts.length === 3) {
          enContent = parts[0] + interfaceInjection + parts[1] + valueInjection + parts[2];
          fs.writeFileSync('src/i18n/messages/en.ts', enContent);
          console.log('Updated en.ts');
      }
  }

  console.log('Translating to FR...');
  const frData = await traverseAndTranslate(englishData, 'fr');
  injectIntoFile('src/i18n/messages/fr.ts', 'notifications', frData);

  console.log('Translating to DE...');
  const deData = await traverseAndTranslate(englishData, 'de');
  injectIntoFile('src/i18n/messages/de.ts', 'notifications', deData);

  console.log('Translating to ES...');
  const esData = await traverseAndTranslate(englishData, 'es');
  injectIntoFile('src/i18n/messages/es.ts', 'notifications', esData);

  console.log('Translating to AR...');
  const arData = await traverseAndTranslate(englishData, 'ar');
  injectIntoFile('src/i18n/messages/ar.ts', 'notifications', arData);

  console.log('Done!');
}
main();
