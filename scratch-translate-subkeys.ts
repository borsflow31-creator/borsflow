import fs from 'fs';

const subKeysToAdd = [
  { topKey: 'documents', subKey: 'calculations', value: {
    summary: 'Summary', subtotal: 'Subtotal', discount: 'Discount',
    discountTypeLabel: 'Discount type', discountNone: 'None',
    discountValueLabel: 'Discount value', tax: 'Tax', taxRateLabel: 'Tax rate',
    total: 'Total', amountPaid: 'Amount Paid', amountDue: 'Amount Due', balance: 'Balance',
  }},
  { topKey: 'documents', subKey: 'lineItem', value: {
    descriptionLabel: 'Description', descriptionPlaceholder: 'Item description',
    qtyLabel: 'Qty', unitPriceLabel: 'Unit Price', discountLabel: 'Discount %',
    taxLabel: 'Tax %', totalLabel: 'Total', dragToReorder: 'Drag to reorder', remove: 'Remove',
  }},
  { topKey: 'documents', subKey: 'lineItems', value: {
    heading: 'Line Items', noItems: 'No items added yet', itemCount: '{count} item',
    itemsCount: '{count} items', noItemsYet: 'No items yet',
    addFirst: 'Add line items using the buttons below', addNewAriaLabel: 'Add new line item',
    addItem: 'Add Item', pickFromCatalog: 'Pick from catalog',
  }},
  { topKey: 'documents', subKey: 'filterBar', value: {
    clearSearch: 'Clear search', clearFilters: 'Clear all filters', clear: 'Clear',
  }},
  { topKey: 'documents', subKey: 'viewToggle', value: {
    ariaLabel: 'View mode toggle', gridView: 'Grid view', tableView: 'Table view',
  }},
  { topKey: 'templates', subKey: 'ai', value: {
    generate: 'Generate with AI', contentReady: 'Content ready',
    estimatedTotal: 'Estimated total:', applyTemplate: 'Apply this Template',
    regenerate: 'Regenerate', generating: 'Generating…', generate2: 'Generate',
    describePlaceholder: 'Describe what you want', basedOn: 'Based on:',
  }},
];

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

function objToTsInterface(obj: any, indent = 2): string {
  const pad = ' '.repeat(indent);
  const lines: string[] = ['{'];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      lines.push(`${pad}${key}: ${objToTsInterface(value, indent + 2)};`);
    } else {
      lines.push(`${pad}${key}: string;`);
    }
  }
  lines.push(`${' '.repeat(indent - 2)}}`);
  return lines.join('\n');
}

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
  // First fix lineItems in en.ts interface
  let enContent = fs.readFileSync('src/i18n/messages/en.ts', 'utf-8');
  const splitIdx = enContent.indexOf('const en: Messages');
  const docIfaceClose = findTopKeyClose(enContent, 'documents', 0);
  if (docIfaceClose !== -1 && docIfaceClose < splitIdx && !enContent.substring(0, docIfaceClose).includes('    lineItems: {')) {
    const lineItemsObj = subKeysToAdd.find(x => x.subKey === 'lineItems')?.value;
    const interfaceSubBlock = `\n    lineItems: ${objToTsInterface(lineItemsObj, 6)};`;
    enContent = enContent.substring(0, docIfaceClose) + interfaceSubBlock + '\n  ' + enContent.substring(docIfaceClose);
    fs.writeFileSync('src/i18n/messages/en.ts', enContent);
    console.log('Fixed lineItems in en.ts interface');
  }

  // Now inject translated sub-keys into other languages
  for (const lang of ['ar', 'de', 'es', 'fr']) {
    console.log(`Processing ${lang}...`);
    let content = fs.readFileSync(`src/i18n/messages/${lang}.ts`, 'utf-8');
    
    // Inject top-level keys if missing
    // We only have `workspace`, `chat`, `ai`, `pages` missing potentially in these files?
    // Wait, my previous script scratch-inject-all-keys.ts added workspace, chat, ai, pages to all files correctly.
    // The problem is the subKeys (documents.calculations, etc) which were added later by scratch-fix-value-keys.ts only to en.ts.
    
    for (const { topKey, subKey, value } of subKeysToAdd) {
      if (content.includes(`    ${subKey}: {`)) continue;
      
      console.log(`Translating ${topKey}.${subKey} for ${lang}...`);
      const translated = await traverseAndTranslate(value, lang);
      
      const topKeyClose = findTopKeyClose(content, topKey, 0);
      if (topKeyClose !== -1) {
        const subBlock = `\n    ${subKey}: ${objToTs(translated, 6)},`;
        content = content.substring(0, topKeyClose) + subBlock + '\n  ' + content.substring(topKeyClose);
      }
    }
    
    fs.writeFileSync(`src/i18n/messages/${lang}.ts`, content);
    console.log(`Updated ${lang}.ts`);
  }
}

main().catch(console.error);
