import fs from 'fs';

// ─── ALL MISSING EN KEYS ───────────────────────────────────────────────────────
const newEnglishKeys = {
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
  documents: {
    calculations: {
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
      paid: '{percent}% paid',
    },
    lineItem: {
      descriptionLabel: 'Description',
      descriptionPlaceholder: 'Item description',
      qtyLabel: 'Qty',
      unitPriceLabel: 'Unit Price',
      discountLabel: 'Discount %',
      taxLabel: 'Tax %',
      totalLabel: 'Total',
      dragToReorder: 'Drag to reorder',
      remove: 'Remove',
    },
    lineItems: {
      heading: 'Line Items',
      noItems: 'No items added yet',
      itemCount: '{count} item',
      itemsCount: '{count} items',
      noItemsYet: 'No items yet',
      addFirst: 'Add line items using the buttons below',
      addNewAriaLabel: 'Add new line item',
      addItem: 'Add Item',
      pickFromCatalog: 'Pick from catalog',
    },
    filterBar: {
      clearSearch: 'Clear search',
      clearFilters: 'Clear all filters',
      clear: 'Clear',
    },
    viewToggle: {
      ariaLabel: 'View mode toggle',
      gridView: 'Grid view',
      tableView: 'Table view',
    },
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
  templates: {
    ai: {
      generate: 'Generate with AI',
      contentReady: 'Content ready',
      estimatedTotal: 'Estimated total:',
      applyTemplate: 'Apply this Template',
      regenerate: 'Regenerate',
      generating: 'Generating…',
      generate2: 'Generate',
      describePlaceholder: 'Describe what you want',
      basedOn: 'Based on:',
    },
    card: {
      customTemplateAlt: 'Custom Template',
    },
    picker: {
      searchPlaceholder: 'Search templates…',
    },
    preview: {
      yourCompany: 'Your Company',
      address: 'City, State 12345',
      itemDescription: 'Item Description',
      rate: 'Rate',
      amount: 'Amount',
      subtotal: 'Subtotal',
      total: 'Total',
    },
  },
  ai: {
    chat: {
      heading: 'How can I help?',
      subheading: 'Ask me anything about your workspace, documents, or tasks.',
      placeholder: 'Ask anything...',
    },
  },
  products: {
    picker: {
      closeAriaLabel: 'Close product picker',
      searchAriaLabel: 'Search by product name, SKU, or description',
    },
  },
  languageSwitcher: {
    switchAriaLabel: 'Switch language',
    selectorAriaLabel: 'Language selector',
  },
  scheduling: {
    integrationsPanel: {
      allConnected: 'All platforms connected!',
      allConnectedSub: 'Your scheduling is fully set up.',
    },
  },
};

// ─── Translate helper ──────────────────────────────────────────────────────────
async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || typeof text !== 'string') return text;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data[0].map((x: any) => x[0]).join('');
  } catch {
    return text;
  }
}

async function traverseAndTranslate(obj: any, targetLang: string): Promise<any> {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      result[key] = await traverseAndTranslate(value, targetLang);
    } else if (typeof value === 'string') {
      const parts = value.split(/(\{[^}]+\})/g);
      let translated = '';
      for (const part of parts) {
        if (part.startsWith('{') && part.endsWith('}')) {
          translated += part;
        } else if (part.trim().length > 0) {
          translated += await translateText(part, targetLang);
        } else {
          translated += part;
        }
      }
      result[key] = translated.trim();
    } else {
      result[key] = value;
    }
  }
  return result;
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

function injectKeys(filePath: string, keys: Record<string, any>, inInterface = false) {
  let content = fs.readFileSync(filePath, 'utf-8');

  for (const [topKey, value] of Object.entries(keys)) {
    if (content.includes(`\n  ${topKey}: {`)) {
      // Key exists — skip
      continue;
    }

    if (inInterface) {
      // Inject interface shape before public
      const interfaceShape = objToTs(value, 4).replace(/: '.*?'(,?)/g, ': string$1');
      const interfaceBlock = `\n  ${topKey}: {\n  ${interfaceShape.slice(2).slice(0, -1).trim()}\n  };`;
      content = content.replace(/\n  public: \{/, `${interfaceBlock}\n  public: {`);
    }

    // Inject value
    const valueBlock = `\n  ${topKey}: ${objToTs(value, 4)},\n  public: {`;
    content = content.replace(/\n\s*public:\s*\{/, valueBlock);
  }

  fs.writeFileSync(filePath, content);
}

async function main() {
  // 1. Inject into en.ts (both interface and values — en.ts has both in one file)
  console.log('Updating en.ts...');
  injectKeys('src/i18n/messages/en.ts', newEnglishKeys, false);

  // 2. Translate + inject into each locale
  for (const [lang, label] of [['fr', 'French'], ['de', 'German'], ['es', 'Spanish'], ['ar', 'Arabic']]) {
    console.log(`Translating to ${label}...`);
    const translated = await traverseAndTranslate(newEnglishKeys, lang);
    injectKeys(`src/i18n/messages/${lang}.ts`, translated, false);
    console.log(`  Done ${label}`);
  }

  console.log('All translation files updated!');
}

main().catch(console.error);
