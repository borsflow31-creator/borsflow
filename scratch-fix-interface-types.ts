import fs from 'fs';

function fixInterface() {
  const filePath = 'src/i18n/messages/en.ts';
  const content = fs.readFileSync(filePath, 'utf-8');
  
  const splitIdx = content.indexOf('const en: Messages');
  if (splitIdx === -1) {
    console.error('Could not find const en: Messages');
    return;
  }
  
  let ifacePart = content.substring(0, splitIdx);
  const valuePart = content.substring(splitIdx);
  
  // Replace literal string types with string;
  // Look for keys with string literal values like: switchWorkspace: 'Switch workspace',
  // and replace with: switchWorkspace: string;
  // Also change trailing commas to semicolons in the interface just to be safe, though TS allows commas.
  ifacePart = ifacePart.replace(/: \s*'[^']*'(,|;)?/g, ': string;');
  ifacePart = ifacePart.replace(/: \s*"[^"]*"(,|;)?/g, ': string;');
  
  fs.writeFileSync(filePath, ifacePart + valuePart);
  console.log('Fixed interface types in en.ts');
}

fixInterface();
