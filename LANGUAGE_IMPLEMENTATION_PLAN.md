# Language Implementation Plan

## Goal

Implement multi-language support across the platform in a way that is consistent, scalable, and safe for both UI and server-generated content.

## Objectives

- Support multiple languages from a single app-wide localization system
- Allow users to switch languages easily
- Persist the selected language across sessions
- Standardize translation, formatting, and fallback behavior
- Translate both frontend UI and customer-facing generated content

## Initial Scope

### Recommended first locales

- English
- French

### Recommended default behavior

- Default to English on first load
- Allow manual switching between English and French
- Persist the selected language locally
- Optionally add browser-language detection later

## Architecture

### Core requirements

- One centralized i18n provider for the entire app
- One message catalog per locale
- Shared translation helper for all UI components
- Shared formatting helpers for dates, times, numbers, and currency
- One reusable language switcher component

### Translation domains

Organize messages by feature area to keep catalogs maintainable:

- `app`
- `common`
- `language`
- `nav`
- `auth`
- `dashboard`
- `settings`
- `crm`
- `products`
- `documents`
- `quotes`
- `invoices`
- `meetings`
- `emailMarketing`
- `admin`
- `landing`

## Implementation Phases

### Phase 1: Foundation

- Create or finalize `src/i18n/`
- Define supported locales
- Add locale state management in the i18n provider
- Add persistence using `localStorage`
- Update `<html lang>` behavior based on active locale
- Add shared helpers:
  - `t(key, values?)`
  - `formatDate`
  - `formatDateTime`
  - `formatRelativeTime`
  - `formatNumber`
  - `formatCurrency`

### Phase 2: Language Switcher

- Create a reusable `LanguageSwitcher` component
- Add it to:
  - app shell
  - login page
  - register page
- Optionally add a dedicated language section in settings later

### Phase 3: Shared UI

Translate the most reused surfaces first:

- navigation labels
- breadcrumbs
- search placeholders
- buttons
- empty states
- toast messages
- common modal actions
- account menu

This gives the widest visible coverage with the lowest risk.

### Phase 4: Core App Screens

Translate feature screens in this order:

1. Auth
2. Dashboard
3. Settings
4. CRM
5. Products
6. Documents
7. Quotes
8. Invoices
9. Meetings
10. Email marketing
11. Admin and superadmin
12. Landing and public screens

Each feature should be completed end-to-end before moving on.

### Phase 5: Generated Content

Localize all server-generated user-facing output:

- quote emails
- invoice emails
- PDFs
- export labels
- notification content
- unsubscribe pages
- system email templates

This phase is important because UI-only translation leaves external customer content inconsistent.

### Phase 6: Persistence and User Preference

Current baseline:

- persist locale in browser storage

Future improvement:

- add locale preference to the user profile
- sync it after login across devices

## Formatting Rules

All locale-sensitive formatting must use shared helpers rather than hardcoded locale strings.

### Replace hardcoded usage such as

- `toLocaleDateString('en-US')`
- `Intl.NumberFormat('en-US', ...)`
- `toLocaleString()`

### With shared helpers

- `formatDate(...)`
- `formatDateTime(...)`
- `formatRelativeTimeFromNow(...)`
- `formatNumber(...)`
- `formatCurrency(...)`

## Translation Standards

### Glossary

Define canonical terms before full rollout so wording stays consistent.

Recommended examples:

- Workspace
- Page
- Lead
- Client
- Quote / Estimate
- Invoice
- Draft
- Sent
- Pending
- Overdue
- Paid
- Meeting
- Product

### Key naming

Use stable dot-separated keys:

- `common.cancel`
- `nav.dashboard`
- `dashboard.noWorkspaces`
- `auth.login.submit`
- `invoices.status.overdue`

### Fallback behavior

- If a translation key is missing, fall back to the default locale
- If still missing, surface the key string in development to make the issue obvious

## QA Plan

### Functional QA

Verify:

- switching language updates visible UI immediately
- selected language persists after refresh
- selected language persists after navigation
- auth pages and signed-in pages both support switching

### UI QA

Check:

- text truncation
- button overflow
- modal layout stability
- sidebar label spacing
- table headers and filters

### Formatting QA

Verify:

- date formatting
- time formatting
- relative time formatting
- number separators
- currency display

### Content QA

Verify:

- no untranslated user-facing strings remain in target modules
- PDFs and emails use the selected language where supported
- status labels and business terminology remain consistent

## Developer Workflow

### For every new feature

1. Add locale keys before or during UI implementation
2. Avoid hardcoded UI strings
3. Use shared formatting helpers
4. Test at least English and French before merge

### For every translated feature

Use a simple checklist:

- page text translated
- shared components translated
- validation and errors translated
- dates and currency localized
- empty states localized
- server-generated content localized
- QA completed

## Suggested File Structure

```text
src/
  i18n/
    I18nProvider.tsx
    messages/
      en.ts
      fr.ts
  components/
    LanguageSwitcher.tsx
```

Future extension:

```text
src/i18n/messages/
  en/
    common.ts
    auth.ts
    dashboard.ts
  fr/
    common.ts
    auth.ts
    dashboard.ts
```

## Recommended Next Steps

1. Keep the current provider and switcher as the base implementation
2. Translate `settings`
3. Translate `quotes` and `invoices`
4. Translate generated emails and PDFs
5. Audit remaining hardcoded strings across `src/app`, `src/components`, and API routes

## Success Criteria

The language implementation is considered complete when:

- English and French are both available platform-wide
- language preference is persistent
- no major user-facing screen relies on hardcoded copy
- formatting is locale-aware everywhere
- customer-facing generated content is localized
- untranslated string regressions are easy to detect and fix
