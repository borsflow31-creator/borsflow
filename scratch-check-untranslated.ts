import en from './src/i18n/messages/en';
import fr from './src/i18n/messages/fr';
import de from './src/i18n/messages/de';
import es from './src/i18n/messages/es';
import ar from './src/i18n/messages/ar';

function getUntranslatedKeys(base: any, target: any, prefix = ''): string[] {
  let untranslated: string[] = [];
  
  // Words that are expected to be the same in all languages
  const ignoredWords = ['BorsFlow', 'PDF', 'CRM', 'Cal.com', 'Zoom', 'Google Meet'];
  
  for (const key in base) {
    if (typeof base[key] === 'object' && base[key] !== null) {
      if (!target[key]) {
        untranslated.push(`${prefix}${key} (MISSING)`);
      } else {
        untranslated = untranslated.concat(
          getUntranslatedKeys(base[key], target[key], prefix + key + '.')
        );
      }
    } else if (typeof base[key] === 'string') {
      if (target[key] === undefined) {
        untranslated.push(`${prefix}${key} (MISSING)`);
      } else if (target[key] === base[key]) {
        // Exclude ignored words or short numeric strings
        if (!ignoredWords.includes(base[key]) && !/^[\d\W]+$/.test(base[key])) {
          untranslated.push(`${prefix}${key} (IDENTICAL: "${base[key]}")`);
        }
      }
    }
  }
  return untranslated;
}

const untranslatedFr = getUntranslatedKeys(en, fr);
const untranslatedDe = getUntranslatedKeys(en, de);
const untranslatedEs = getUntranslatedKeys(en, es);
const untranslatedAr = getUntranslatedKeys(en, ar);

console.log(`French: ${untranslatedFr.length} untranslated keys`);
if (untranslatedFr.length > 0) console.log(untranslatedFr.slice(0, 5));

console.log(`German: ${untranslatedDe.length} untranslated keys`);
if (untranslatedDe.length > 0) console.log(untranslatedDe.slice(0, 5));

console.log(`Spanish: ${untranslatedEs.length} untranslated keys`);
if (untranslatedEs.length > 0) console.log(untranslatedEs.slice(0, 5));

console.log(`Arabic: ${untranslatedAr.length} untranslated keys`);
if (untranslatedAr.length > 0) console.log(untranslatedAr.slice(0, 5));
