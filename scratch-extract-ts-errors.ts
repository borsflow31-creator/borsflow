import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const i18nDir = path.join(process.cwd(), 'src/i18n/messages');
const enFile = path.join(i18nDir, 'en.ts');

function runTsc() {
  try {
    console.log('Running tsc...');
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    return '';
  } catch (err: any) {
    return err.stdout ? err.stdout.toString() : err.message;
  }
}

function parseKeys(output: string) {
  const keys = new Set<string>();
  // Match "Argument of type '"key"' is not assignable..." and "Type '"key"' is not assignable..."
  const regex1 = /Argument of type '"([^"]+)"' is not assignable/g;
  const regex2 = /Type '"([^"]+)"' is not assignable to type 'MessageKey'/g;
  
  let match;
  while ((match = regex1.exec(output)) !== null) {
    keys.add(match[1]);
  }
  while ((match = regex2.exec(output)) !== null) {
    keys.add(match[1]);
  }
  return Array.from(keys);
}

function toEnglishText(keyPart: string) {
  let txt = keyPart.replace(/([A-Z])/g, ' $1');
  return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
}

function main() {
  const tscOut = runTsc();
  const keys = parseKeys(tscOut);
  
  if (keys.length === 0) {
    console.log('No missing MessageKey errors found.');
    return;
  }
  
  console.log(`Found ${keys.length} missing keys.`);
  
  let enContent = fs.readFileSync(enFile, 'utf-8');
  
  for (const key of keys) {
    const parts = key.split('.');
    if (parts.length === 2) {
      const topK = parts[0];
      const leafK = parts[1];
      const val = toEnglishText(leafK);
      
      // Inject into Interface
      const iRegex = new RegExp(`(\\n  ${topK}: \\{[\\s\\S]*?)(\\n  \\};)`);
      if (iRegex.test(enContent) && !enContent.includes(`${leafK}: string;`)) {
        enContent = enContent.replace(iRegex, `$1\n    ${leafK}: string;$2`);
      }
      
      // Inject into Value
      const vRegex = new RegExp(`(const en: Messages = \\{[\\s\\S]*?\\n  ${topK}: \\{[\\s\\S]*?)(\\n  \\},)`);
      if (vRegex.test(enContent) && !enContent.includes(`${leafK}: '`)) {
        enContent = enContent.replace(vRegex, `$1\n    ${leafK}: '${val.replace(/'/g, "\\'")}',$2`);
      }
    }
  }
  
  fs.writeFileSync(enFile, enContent);
  console.log('Updated en.ts with missing keys.');
  
  // Mirror to others
  for (const lang of ['ar', 'de', 'es', 'fr']) {
    const content = enContent.replace(/export const en: Messages = \{/, `export const ${lang}: Messages = {`);
    fs.writeFileSync(path.join(i18nDir, `${lang}.ts`), content);
  }
  console.log('Mirrored to all locales.');
}

main();
