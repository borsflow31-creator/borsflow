import fs from 'fs';

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

// Sub-keys to inject into both interface and value sections
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
  let content = fs.readFileSync('src/i18n/messages/en.ts', 'utf-8');
  const splitIdx = content.indexOf('const en: Messages');

  for (const { topKey, subKey, value } of subKeysToAdd) {
    const interfaceSubBlock = `\n    ${subKey}: ${objToTsInterface(value, 6)};`;
    const valueSubBlock = `\n    ${subKey}: ${objToTs(value, 6)},`;

    // 1. Inject into interface section
    const ifaceTopClose = findTopKeyClose(content, topKey, 0);
    if (ifaceTopClose === -1 || ifaceTopClose > splitIdx) {
      console.log(`Could not find ${topKey} in interface section`);
    } else {
      // Check if sub-key already in interface
      const ifacePart = content.substring(0, ifaceTopClose);
      if (!ifacePart.includes(`    ${subKey}: `)) {
        content = content.substring(0, ifaceTopClose) + interfaceSubBlock + '\n  ' + content.substring(ifaceTopClose);
        console.log(`Added ${topKey}.${subKey} to interface`);
      } else {
        console.log(`${topKey}.${subKey} already in interface`);
      }
    }

    // Re-find split since content changed
    const newSplitIdx = content.indexOf('const en: Messages');

    // 2. Inject into value section
    const valueTopClose = findTopKeyClose(content, topKey, newSplitIdx);
    if (valueTopClose === -1) {
      console.log(`Could not find ${topKey} in value section`);
    } else {
      const valuePart = content.substring(newSplitIdx, valueTopClose);
      if (!valuePart.includes(`    ${subKey}: `)) {
        content = content.substring(0, valueTopClose) + valueSubBlock + '\n  ' + content.substring(valueTopClose);
        console.log(`Added ${topKey}.${subKey} to value`);
      } else {
        console.log(`${topKey}.${subKey} already in value`);
      }
    }
  }

  fs.writeFileSync('src/i18n/messages/en.ts', content);
  console.log('Done!');
}

main().catch(console.error);
