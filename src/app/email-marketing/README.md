# Email marketing

Campaigns, templates, drip automations and sending setup for one workspace.

## The page

`page.tsx` is the shell only: workspace resolution, one parallel fetch of every
list, the modals, and tab routing. Each tab lives in
`src/components/email-marketing/tabs/`:

| Tab | File | Holds |
|---|---|---|
| Campaigns | `CampaignsTab.tsx` | the list, with a totals strip that used to be an Analytics tab |
| Templates | `TemplatesTab.tsx` | the starter gallery and the workspace's saved templates |
| Automations | `AutomationsTab.tsx` | drip sequences, their triggers and schedules |
| Settings | `SettingsTab.tsx` | two sections: audiences (segments) and sending (providers) |

The tab is in the URL (`?tab=`). Three names were retired — `segments`,
`providers` and `analytics` — and `RETIRED_TABS` in `page.tsx` resolves them to
the tab that absorbed them, so old links and bookmarks still land somewhere
sensible. `?editTemplate=<id>` opens the editor on that template; `/templates`
links to it.

Shared types are in `components/email-marketing/types.ts`, so a tab never has to
import the page.

## Writing an email

There is **one** editor: `SimpleEmailEditor`, a contentEditable compose window.
There were three (a block designer and a click-to-edit mode for imported HTML);
a new template had to choose between them, and switching was a lossy conversion
behind a confirm dialog.

A template's HTML is the editor's own when it carries
`<meta name="bf-editor" content="simple">`; `src/lib/email-editor-mode.ts` reads
that, wraps and unwraps the body, and converts anything else. `TemplateModal`
shows a template from the retired designer as it will send, with the choice to
bring its text across (`htmlToSimpleBody`, lossy, confirmed) or to edit its HTML
and leave it untouched. Raw HTML is offered **only** for such a template: for its
own content the tab is a way to break the markup the editor relies on.

`Send me a test` (`/api/email-marketing/templates/test`) mails the draft — not
the saved version — to the signed-in user's own address, with sample values
filled in, rate limited, counted against nothing.

## Fields

`src/lib/email/tokens.ts` is the one list of `{{tokens}}`: names, labels and
sample values. `buildTokenMap` in `src/lib/email/render.ts` declares its return
type from it, so a token the editor can insert that nothing fills in is a
compile error rather than a blank in someone's inbox. Add a token in both places
or in neither.

## Starter templates

`src/lib/email/starters/` — ten real-estate letters in English and French,
authored as short bodies and built with `simpleToHtml`, which is what makes them
editable in the editor. The gallery follows the UI language and falls back to
English for the other three locales. `scripts/verify/19-email-starters.ts` holds
the invariants: each one round-trips through the editor unchanged, every token in
one is real, both languages offer the same set.

## Sending

Providers are `EmailProvider` rows per workspace: Resend, SendGrid, SES, Mailgun,
Postmark, Brevo, and the workspace's own mail server over SMTP.

SMTP has no schema of its own — the password is the encrypted `apiKey` (which the
API masks), and host/port/secure/user live in the `config` JSON (which the API
returns to the browser as it is, so no credential may ever go there).
`src/lib/email/smtp.ts` holds the settings, the guard and the verify;
`providers/smtp-provider.ts` sends. The guard matters: the host is typed in by a
user and the server then opens a socket to it, so submission ports only and
nothing on a private network — `scripts/verify/18-smtp-provider.ts` covers it.

SMTP gets no webhook, so a 5xx rejection at send time is the only bounce signal
there will be; `email-queue.ts` records it as a hard bounce and suppresses the
address instead of retrying it twice more.

Sends go through `email-campaign.ts` → `email-queue.ts`, drained by the
Cloudflare Worker in `workers/cron/`.
