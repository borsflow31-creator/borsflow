import fs from 'fs';
import path from 'path';

const files = ['en.ts', 'ar.ts', 'fr.ts', 'de.ts', 'es.ts'];
for (const f of files) {
  let p = path.join(process.cwd(), 'src/i18n/messages', f);
  let c = fs.readFileSync(p, 'utf-8');
  c = c.replace(/amount: 'Amount',\r?\n\s+amount: 'Amount',/g, "amount: 'Amount',");
  c = c.replace(/amount: string;\r?\n\s+amount: string;/g, "amount: string;");
  fs.writeFileSync(p, c);
}
console.log('Fixed double amount');
