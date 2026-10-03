import en from './src/i18n/messages/en';
import fr from './src/i18n/messages/fr';
import de from './src/i18n/messages/de';
import es from './src/i18n/messages/es';
import ar from './src/i18n/messages/ar';
import * as fs from 'fs';

function getMissingKeys(base: any, target: any, prefix = '') {
  let missing: Record<string, any> = {};
  for (const key in base) {
    if (typeof base[key] === 'object' && base[key] !== null) {
      if (!target[key]) {
        missing[key] = base[key];
      } else {
        const nested = getMissingKeys(base[key], target[key], prefix + key + '.');
        if (Object.keys(nested).length > 0) {
          missing[key] = nested;
        }
      }
    } else {
      if (target[key] === undefined) {
        missing[key] = base[key];
      }
    }
  }
  return missing;
}

const missingFr = getMissingKeys(en, fr);
const missingDe = getMissingKeys(en, de);
const missingEs = getMissingKeys(en, es);
const missingAr = getMissingKeys(en, ar);

fs.writeFileSync('missing_fr.json', JSON.stringify(missingFr, null, 2));
fs.writeFileSync('missing_de.json', JSON.stringify(missingDe, null, 2));
fs.writeFileSync('missing_es.json', JSON.stringify(missingEs, null, 2));
fs.writeFileSync('missing_ar.json', JSON.stringify(missingAr, null, 2));

console.log('Missing French keys count:', Object.keys(missingFr).length, 'top-level sections have missing keys.');
console.log('Missing German keys count:', Object.keys(missingDe).length, 'top-level sections have missing keys.');
console.log('Missing Spanish keys count:', Object.keys(missingEs).length, 'top-level sections have missing keys.');
console.log('Missing Arabic keys count:', Object.keys(missingAr).length, 'top-level sections have missing keys.');
