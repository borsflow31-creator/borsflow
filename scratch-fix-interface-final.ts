import fs from 'fs';

function main() {
  const file = 'src/i18n/messages/en.ts';
  let c = fs.readFileSync(file, 'utf-8');
  const splitIdx = c.indexOf('const en: Messages');
  let iface = c.substring(0, splitIdx);
  const val = c.substring(splitIdx);

  // 1. Remove viewToggle from notifications in interface
  const viewToggleStr = `
    viewToggle: {
      ariaLabel: string;
      gridView: string;
      tableView: string;
    };`;
  iface = iface.replace(viewToggleStr, '');

  // 2. Add viewToggle to documents in interface
  // Find end of documents: {
  let docIdx = iface.indexOf('documents: {');
  let depth = 0;
  let endDoc = -1;
  for(let i = docIdx; i < iface.length; i++) {
    if(iface[i] === '{') depth++;
    if(iface[i] === '}') {
      depth--;
      if(depth === 0) {
        endDoc = i;
        break;
      }
    }
  }
  
  if (endDoc !== -1) {
    iface = iface.substring(0, endDoc) + viewToggleStr + '\n  ' + iface.substring(endDoc);
  }

  // 3. Fix languageSwitcher in interface to match value
  const badLangStr = `languageSwitcher: {
    switchAriaLabel: string;
    selectorAriaLabel: string;
  }`;
  const goodLangStr = `languageSwitcher: {
    tooltip: string;
    closeAriaLabel: string;
  }`;
  iface = iface.replace(badLangStr, goodLangStr);

  fs.writeFileSync(file, iface + val);
  console.log('Fixed en.ts interface');
}

main();
