import fs from 'fs';

// Keys that are in the interface but missing from the value section of en.ts
const missingValueKeys: Record<string, any> = {
  workspace: {
    list: {
      switchWorkspace: 'Switch workspace',
      label: 'Workspace',
      noWorkspaces: 'No workspaces yet',
      invitePeople: 'Invite people',
      inviteAriaLabel: 'Invite users to workspace',
      invitations: 'Invitations',
      newWorkspace: 'New workspace',
    },
    switcher: {
      switchWorkspace: 'Switch workspace',
      createNew: 'Create New Workspace',
      loading: 'Loading workspaces...',
      noWorkspaces: 'No workspaces yet',
    },
    invitation: {
      resendTitle: 'Resend invitation',
      cancelTitle: 'Cancel invitation',
      resend: 'Resend',
      cancel: 'Cancel',
      expired: 'This invitation has expired. You can send a new invitation to this email.',
      sent: 'Sent: {date}',
      expires: 'Expires: {date}',
    },
    inviteModal: {
      closeModal: 'Close modal',
      roleLabel: 'Role',
      removeAriaLabel: 'Remove',
    },
    pendingModal: {
      closeAriaLabel: 'Close',
    },
    createModal: {
      closeModal: 'Close modal',
      descPlaceholder: 'What is this workspace for?',
    },
  },
  chat: {
    title: 'Team Chat',
    channels: 'Channels',
    addChannel: 'Add channel',
    deleteChannel: 'Delete channel',
    selectChannel: 'Select a channel to start chatting',
    noChannels: 'No channels yet',
    createFirst: 'Create your first channel',
    addAChannel: 'Add a channel',
    newChannel: 'New Channel',
    notSaved: 'Delivered live but not saved to history',
    createModal: {
      title: 'Create a channel',
      nameLabel: 'Channel name',
      descLabel: 'Description',
      optional: '(optional)',
      descPlaceholder: "What's this channel about?",
      cancel: 'Cancel',
      create: 'Create Channel',
      failedError: 'Failed to create channel',
    },
  },
  ai: {
    chat: {
      heading: "How can I help?",
      subheading: "Ask me anything about your workspace, documents, or tasks.",
      placeholder: "Ask anything...",
    }
  },
  pages: {
    exportShare: {
      members: 'Members',
      export: 'Export',
      publicAccess: 'Public access',
    },
    accessModal: {
      shareWithMembers: 'Share with members',
      applyToChildren: 'Apply to child pages',
    },
    sidebar: {
      newPage: 'New Page',
      searchPlaceholder: 'Search pages...',
    },
  },
};

// Additionally, need to add sub-keys to existing top-level keys (documents.*, templates.*)
const missingSubKeys: Record<string, { path: string; subkey: string; value: any }[]> = {
  'src/i18n/messages/en.ts': [
    {
      path: 'documents',
      subkey: 'calculations',
      value: {
        summary: 'Summary',
        subtotal: 'Subtotal',
        discount: 'Discount',
        discountTypeLabel: 'Discount type',
        discountNone: 'None',
        discountValueLabel: 'Discount value',
        tax: 'Tax',
        taxRateLabel: 'Tax rate',
        total: 'Total',
        amountPaid: 'Amount Paid',
        amountDue: 'Amount Due',
        balance: 'Balance',
      }
    },
    {
      path: 'documents',
      subkey: 'lineItem',
      value: {
        descriptionLabel: 'Description',
        descriptionPlaceholder: 'Item description',
        qtyLabel: 'Qty',
        unitPriceLabel: 'Unit Price',
        discountLabel: 'Discount %',
        taxLabel: 'Tax %',
        totalLabel: 'Total',
        dragToReorder: 'Drag to reorder',
        remove: 'Remove',
      }
    },
    {
      path: 'documents',
      subkey: 'lineItems',
      value: {
        heading: 'Line Items',
        noItems: 'No items added yet',
        itemCount: '{count} item',
        itemsCount: '{count} items',
        noItemsYet: 'No items yet',
        addFirst: 'Add line items using the buttons below',
        addNewAriaLabel: 'Add new line item',
        addItem: 'Add Item',
        pickFromCatalog: 'Pick from catalog',
      }
    },
    {
      path: 'documents',
      subkey: 'filterBar',
      value: {
        clearSearch: 'Clear search',
        clearFilters: 'Clear all filters',
        clear: 'Clear',
      }
    },
    {
      path: 'documents',
      subkey: 'viewToggle',
      value: {
        ariaLabel: 'View mode toggle',
        gridView: 'Grid view',
        tableView: 'Table view',
      }
    },
    {
      path: 'templates',
      subkey: 'ai',
      value: {
        generate: 'Generate with AI',
        contentReady: 'Content ready',
        estimatedTotal: 'Estimated total:',
        applyTemplate: 'Apply this Template',
        regenerate: 'Regenerate',
        generating: 'Generating…',
        generate2: 'Generate',
        describePlaceholder: 'Describe what you want',
        basedOn: 'Based on:',
      }
    },
  ]
};

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

function injectValueKey(content: string, keyName: string, value: any): string {
  const splitIdx = content.indexOf('const en: Messages');
  // Check if value section already has this key
  const valuePart = content.substring(splitIdx);
  if (valuePart.includes(`\n  ${keyName}: {`)) {
    console.log(`  ${keyName} already in value section`);
    return content;
  }
  // Find the public: { in the value section
  const firstPublicInValue = content.indexOf('\n  public: {', splitIdx);
  if (firstPublicInValue === -1) {
    console.error(`Could not find public: { in value section for key ${keyName}`);
    return content;
  }
  const valueBlock = `\n  ${keyName}: ${objToTs(value, 4)},`;
  return content.substring(0, firstPublicInValue) + valueBlock + content.substring(firstPublicInValue);
}

function injectValueSubKey(content: string, topKey: string, subKey: string, value: any): string {
  // Find the top key in the value section
  const splitIdx = content.indexOf('const en: Messages');
  const valuePart = content.substring(splitIdx);
  // Check if subkey already exists
  if (valuePart.includes(`    ${subKey}: {`)) {
    console.log(`  ${topKey}.${subKey} already exists in value section`);
    return content;
  }
  // Find the top key block in value section
  const topKeyIdx = content.indexOf(`\n  ${topKey}: {`, splitIdx);
  if (topKeyIdx === -1) {
    console.error(`Top key ${topKey} not found in value section`);
    return content;
  }
  // Find the closing } of the top-level key block by tracking brace depth
  let depth = 0;
  let i = topKeyIdx;
  let insertBefore = -1;
  while (i < content.length) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        // Found the closing brace of the top-level block
        insertBefore = i;
        break;
      }
    }
    i++;
  }
  if (insertBefore === -1) {
    console.error(`Could not find closing brace for ${topKey}`);
    return content;
  }
  const subBlock = `\n    ${subKey}: ${objToTs(value, 6)},\n  `;
  return content.substring(0, insertBefore) + subBlock + content.substring(insertBefore);
}

async function main() {
  let content = fs.readFileSync('src/i18n/messages/en.ts', 'utf-8');
  
  // Inject top-level value keys
  for (const [keyName, value] of Object.entries(missingValueKeys)) {
    console.log(`Injecting value key: ${keyName}`);
    content = injectValueKey(content, keyName, value);
  }
  
  // Inject sub-keys into existing top-level value keys
  for (const items of Object.values(missingSubKeys)) {
    for (const { path, subkey, value } of items) {
      console.log(`Injecting sub-key: ${path}.${subkey}`);
      content = injectValueSubKey(content, path, subkey, value);
    }
  }
  
  fs.writeFileSync('src/i18n/messages/en.ts', content);
  console.log('Updated en.ts!');
}

main().catch(console.error);
