import fs from 'fs';
import path from 'path';

// Find all .tsx and .ts files in src/ (excluding message catalogs and types)
function getFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getFiles(fullPath));
    } else if ((entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))
      && !fullPath.includes('messages')
      && !fullPath.includes('types')
      && !fullPath.includes('i18n/I18nProvider')
      && !fullPath.includes('route.ts')
      && !fullPath.includes('api/')
      && !fullPath.includes('.d.ts')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

// Patterns that likely indicate hardcoded user-visible English text in JSX
// We look for JSX text content: >Some Text< or strings inside JSX attributes like placeholder/label/title/aria-label
const JSX_TEXT_PATTERN = />([A-Z][a-z]{2,}[\w\s,.'!?-]{3,})</g;
const JSX_ATTR_PATTERN = /(?:placeholder|label|title|aria-label|alt|aria-placeholder)\s*=\s*"([A-Z][a-z]{2,}[^"]{2,})"/g;
const JSX_DYNAMIC_ATTR_PATTERN = /(?:placeholder|label|title|aria-label|alt)\s*=\s*\{`([A-Z][a-z]{2,}[^`]{2,})`\}/g;

function checkFile(filePath: string): { file: string; issues: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues: string[] = [];
  const lines = content.split('\n');

  // Skip if file doesn't use JSX / UI
  if (!content.includes('return (') && !content.includes('return(')) return { file: filePath, issues };

  // Check if file has useI18n or t('
  const hasI18n = content.includes("useI18n") || content.includes("t('") || content.includes('t("');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    // Skip imports
    if (line.trim().startsWith('import ')) return;
    // Skip t() calls and template literals with t()
    if (line.includes("t('") || line.includes('t("') || line.includes('t(`')) return;
    // Skip console.log lines
    if (line.includes('console.')) return;

    // Check for JSX text nodes: >{text}< - at least 4 chars of real english
    const textMatches = [...line.matchAll(/>([A-Z][a-zA-Z]{2,}(?:[\w\s,'!?.:…-]{2,})?)</g)];
    for (const m of textMatches) {
      const text = m[1].trim();
      if (text.length < 4) continue;
      if (text.includes('{') || text.includes('(')) continue; // skip JSX expressions
      if (/^\d/.test(text)) continue; // skip numeric starts
      if (/^[A-Z][A-Z_]+$/.test(text)) continue; // skip ALL_CAPS constants
      issues.push(`L${lineNum}: hardcoded text: "${text}"`);
    }

    // Check for hardcoded placeholder/label attributes
    const attrMatches = [...line.matchAll(/(?:placeholder|label|aria-label|title|alt)\s*=\s*"([A-Z][a-zA-Z]{2,}[^"]{2,})"/g)];
    for (const m of attrMatches) {
      const text = m[1].trim();
      if (text.startsWith('/') || text.startsWith('http')) continue; // skip URLs
      if (/^\d/.test(text)) continue;
      issues.push(`L${lineNum}: hardcoded attr: "${text}"`);
    }
  });

  return { file: filePath, issues };
}

const srcDir = 'src';
const files = getFiles(srcDir);
const results: { file: string; issues: string[] }[] = [];

for (const f of files) {
  const r = checkFile(f);
  if (r.issues.length > 0) {
    results.push(r);
  }
}

if (results.length === 0) {
  console.log('✅ All scanned files appear to be fully translated!');
} else {
  let total = 0;
  for (const r of results) {
    const relPath = r.file.replace(/\\/g, '/').replace('src/', 'src/');
    console.log(`\n📄 ${relPath} (${r.issues.length} issue(s))`);
    for (const issue of r.issues.slice(0, 8)) {
      console.log(`  ⚠️  ${issue}`);
    }
    if (r.issues.length > 8) console.log(`  ... and ${r.issues.length - 8} more`);
    total += r.issues.length;
  }
  console.log(`\n========\nTotal: ${results.length} files with issues, ${total} hardcoded strings found.`);
}
