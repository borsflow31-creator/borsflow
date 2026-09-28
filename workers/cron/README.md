# Cron Worker

A Cloudflare Worker that drives every cron job for the app.

Vercel Cron on the Hobby plan runs at most once per day, but this app's jobs need
minute, half-hour and hourly granularity. This Worker owns all six schedules and
calls the app's existing HTTP cron endpoints. **Nothing about the app itself
moves to Cloudflare** — this is a scheduler, not a host. `vercel.json` carries no
crons; this Worker is the only scheduler for the app.

| Job | Schedule |
|---|---|
| `/api/cron/process-automations` | every minute |
| `/api/cron/process-email-queue` | every minute |
| `/api/cron/refresh-tokens` | every 30 minutes (minutes `0` and `30` of the tick) |
| `/api/cron/expire-invitations` | hourly (minute `0` of the tick) |
| `/api/cron/mark-overdue` | hourly (minute `0` of the tick) |
| `/api/cron/sync-calendars` | hourly (minute `0` of the tick) |

The every-minute jobs run **sequentially, automations first**: automations
materialize emails into the queue, so draining the queue second means a step
created this minute goes out this minute instead of waiting for the next tick.

The Worker has a single every-minute trigger (Cron Triggers are limited per
account), so the half-hourly and hourly jobs are appended to that same tick only
when the minute matches, rather than spending a second trigger from the
account's limit. `expire-invitations` also prunes old rate-limit events while
it's at it. The manual `fetch` trigger runs every job regardless of the clock.

> Do not add any of these six paths back to `vercel.json` while this Worker is
> deployed — `process-email-queue` has no DB-level lock, so two schedulers
> hitting it concurrently can double-send, and the others aren't idempotent
> against overlap either.

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

On the hour, `refresh-tokens`, `expire-invitations`, `mark-overdue` and
`sync-calendars` log the same way right after those two.

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
- **Subrequests**: 50 per invocation on free. This Worker makes **two** on a
  normal minute, and **six** on the hour (two every-minute jobs, plus
  `refresh-tokens`, plus three more hourly jobs) — still far under the limit.

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
