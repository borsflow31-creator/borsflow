# Cron Worker

A Cloudflare Worker that drives the two minute-level cron jobs for the app.

Vercel Cron on the Hobby plan runs at most once per day, but the email queue and
the automation engine both need to tick every minute. This Worker owns those two
schedules and calls the app's existing HTTP cron endpoints. **Nothing about the
app itself moves to Cloudflare** — this is a scheduler, not a host.

| Job | Owner | Schedule |
|---|---|---|
| `/api/cron/process-automations` | this Worker | `* * * * *` |
| `/api/cron/process-email-queue` | this Worker | `* * * * *` |
| `/api/cron/expire-invitations` | this Worker | hourly (minute `0` of the `* * * * *` tick) |
| `/api/cron/refresh-tokens` | `vercel.json` | `*/30 * * * *` |
| `/api/cron/sync-calendars` | `vercel.json` | `0 * * * *` |

The two jobs run **sequentially, automations first**: automations materialize
emails into the queue, so draining the queue second means a step created this
minute goes out this minute instead of waiting for the next tick.

`expire-invitations` is hourly housekeeping. The Worker has a single every-minute
trigger (Cron Triggers are limited per account), so the job is appended to the run
only when the tick lands on minute `0`. It also prunes old rate-limit events.
The manual `fetch` trigger runs every job, hourly ones included.

> The two email jobs were removed from `vercel.json` as part of this change. Do
> not add them back while this Worker is deployed — `process-email-queue` has no
> DB-level lock, so two schedulers hitting it concurrently can double-send.

## Setup

From this directory (`workers/cron`):

```bash
npm install
npx wrangler login
```

### 1. Point it at your app

Edit `APP_URL` in `wrangler.toml` to your deployed origin, no trailing slash:

```toml
[vars]
APP_URL = "https://your-app.vercel.app"
```

### 2. Set the shared secret

This must be byte-identical to `CRON_SECRET` in the app's own environment
(Vercel → Project → Settings → Environment Variables):

```bash
npx wrangler secret put CRON_SECRET
```

If the app doesn't have a `CRON_SECRET` yet, generate one and set it in both
places:

```bash
openssl rand -hex 32
```

### 3. Deploy

```bash
npm run deploy
```

## Verifying it works

**Locally**, without deploying. `--test-scheduled` exposes a `/__scheduled`
route that fires the handler on demand:

```bash
npx wrangler dev --test-scheduled
# then, in another shell:
curl "http://localhost:8787/__scheduled"
```

Local runs read `CRON_SECRET` from a `.dev.vars` file in this directory
(gitignored — create it yourself):

```
CRON_SECRET=<same value as the app>
```

**In production**, tail the logs and wait for a tick:

```bash
npx wrangler tail
```

A healthy minute looks like:

```
[cron-worker] /api/cron/process-automations ok in 412ms {"success":true,"processed":0,...}
[cron-worker] /api/cron/process-email-queue ok in 380ms {"success":true,...}
```

You can also trigger a run by hand — the Worker exposes a `fetch` handler gated
on the same secret:

```bash
curl -X POST https://borsflow-cron.<your-subdomain>.workers.dev \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Troubleshooting

**`401 Unauthorized` in the logs** — `CRON_SECRET` differs between the Worker and
the app. Re-run `wrangler secret put CRON_SECRET` and confirm the app's env var
matches exactly. Note the app accepts both `Authorization: Bearer <secret>` and
`x-cron-secret: <secret>`; this Worker uses the Bearer form.

**Jobs run but no email arrives** — the Worker's job ends at "the endpoint
returned 200". Check the app's own logs next, and confirm an email provider is
configured and passes its test at `/email-marketing?tab=providers`.

**Nothing in `wrangler tail`** — confirm the trigger registered:
`npx wrangler deployments list`, and check the Cron Triggers section of the
Worker in the Cloudflare dashboard.

## Plan limits

This design fits comfortably in the Workers **free** plan:

- **Cron Triggers**: 5 per account on free, 250 on paid. This Worker uses **one**.
- **CPU time**: 10 ms per invocation on free. Waiting on `fetch()` does *not*
  count toward CPU time, so a slow endpoint doesn't threaten this limit — the
  Worker spends almost all its time idle on the network.
- **Wall clock**: cron invocations get 15 minutes. Both jobs together finish in
  well under that.
- **Subrequests**: 50 per invocation on free. This Worker makes **two**.

The real ceiling is on the Vercel side, not here: `process-email-queue` declares
`maxDuration = 300`, which requires a Vercel Pro/Enterprise plan. On Hobby the
function is capped far lower, so a large queue will be cut short mid-drain —
though since the next tick is a minute away, it simply resumes.

## Files

| Path | Purpose |
|---|---|
| `src/index.ts` | `scheduled()` handler plus a secret-gated manual `fetch()` trigger |
| `wrangler.toml` | Worker name, cron expression, `APP_URL` var |
| `tsconfig.json` | Worker-only TS config (the app's root `tsconfig.json` excludes `workers/`) |
