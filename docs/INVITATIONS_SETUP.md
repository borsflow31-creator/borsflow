# Workspace Invitations - Setup Guide

This guide explains how to set up and configure the workspace invitation feature.

## Overview

The workspace invitation feature allows users to:
- Send email invitations to other users to join their workspace
- Accept or decline invitations
- Manage workspace members and roles
- Automatically expire pending invitations

## Prerequisites

1. Ensure you have completed the database migration:
   ```bash
   npx prisma db push
   ```

2. Regenerate the Prisma client (if needed):
   ```bash
   npx prisma generate
   ```

## Environment Variables

Add the following variables to your `.env` file:

```env
# Cron Job Security (Required for expiring invitations)
CRON_SECRET="your-cron-secret-here"

# Email - required to actually deliver invitations
EMAIL_PROVIDER="resend"          # "resend" (default) or "smtp"
EMAIL_FROM="noreply@borsflow.com"  # must be a domain verified with the provider
RESEND_API_KEY="re_..."          # when EMAIL_PROVIDER=resend

# ...or, when EMAIL_PROVIDER=smtp
# SMTP_HOST="smtp.example.com"
# SMTP_PORT=587
# SMTP_USER="apikey"
# SMTP_PASSWORD="your-smtp-password"

# Origin used to build the link inside the invitation email.
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

`NEXT_PUBLIC_APP_URL` is a `NEXT_PUBLIC_` variable, so it is inlined at **build**
time - setting it only at runtime in the deployment is not enough. When it is
unset the code falls back to `NEXTAUTH_URL` and then to `http://localhost:3000`,
so make sure at least one of the two names the real origin in production, or
every invitation email will carry a link the recipient cannot open.

### Generating Secrets

Generate secure secrets using OpenSSL:

```bash
# Generate CRON_SECRET
openssl rand -base64 32

# Generate NEXTAUTH_SECRET (if not already set)
openssl rand -base64 32
```

## Setting Up the Cron Job

The invitation expiration feature requires a cron job to periodically expire pending invitations.

### Already configured: the Cloudflare scheduler Worker

**In this project you don't need to set anything up.** `/api/cron/expire-invitations`
is already scheduled hourly by the Cloudflare Worker in [`workers/cron`](../workers/cron/README.md),
which drives every cron job for the app. You only need `CRON_SECRET` to match
between the app's environment and the Worker's secret — see that README.

Vercel Cron is **not** used: on the Hobby plan a schedule can run at most once a
day, which is why the jobs moved to Cloudflare. Don't add these paths back to
`vercel.json` while the Worker is deployed, or both schedulers will fire them and
the job will run twice an hour.

The alternatives below are kept only for reference, in case this app is ever run
outside the Worker setup.

### Option 1: Using another cron service

Use services like:
- [GitHub Actions](https://docs.github.com/en/actions)
- [EasyCron](https://www.easycron.com/)
- [Cron-job.org](https://cron-job.org/)

#### GitHub Actions

Create `.github/workflows/expire-invitations.yml`:

```yaml
name: Expire Invitations

on:
  schedule:
    - cron: '0 * * * *'  # Every hour

jobs:
  expire:
    runs-on: ubuntu-latest
    steps:
      - name: Call Cron Endpoint
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://your-app-url.com/api/cron/expire-invitations
```

### Option 2: Using System Cron (Development Only)

On Linux/Mac:

```bash
# Edit crontab
crontab -e

# Add this line (runs every hour)
0 * * * * curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/expire-invitations
```

On Windows (using Task Scheduler):

1. Open Task Scheduler
2. Create a new task
3. Set trigger to "Daily" and repeat every hour
4. Set action to run a program:
   ```
   curl.exe -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/expire-invitations
   ```

## Email Service Integration

Email is already wired up in `src/lib/email.ts`. Pick the provider with
`EMAIL_PROVIDER`:

- `resend` (default) - needs `RESEND_API_KEY` and `EMAIL_FROM`.
- `smtp` - needs `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
  (and `SMTP_SECURE` for STARTTLS on a port other than 465).

**`EMAIL_FROM` must be on a domain you have verified with your provider.** An
unverified sending domain is the most common cause of invitations that appear to
send but never arrive: Resend rejects the request, and until that rejection is
surfaced the invitation row still gets created.

Delivery is reported, not assumed. `deliverInvitationEmail`
(`src/lib/invitation-delivery.ts`) never throws; it returns one of three
outcomes, which the invite modal renders distinctly:

| Outcome | Meaning |
| --- | --- |
| `emailSent: true` | The provider accepted the message. |
| `reason: 'suppressed'` | The address has bounced before, so no send was attempted (`src/lib/email/suppression.ts`). |
| `reason: 'provider_error'` | The provider rejected the send; `emailError` carries its message. |

In every case the invitation row is created, so an admin can still copy the
link or use **Resend** once the provider is configured.

## API Endpoints

### Invitation Management

- `POST /api/workspaces/[id]/invitations/bulk` - Send invitations (what the invite modal uses, for one address or many)
- `POST /api/workspaces/[id]/invitations` - Send a single invitation
- `GET /api/workspaces/[id]/invitations` - List workspace invitations
- `GET /api/invitations/pending` - Get user's pending invitations
- `POST /api/invitations/[id]/accept` - Accept invitation
- `POST /api/invitations/[id]/decline` - Decline invitation
- `DELETE /api/workspaces/[id]/invitations/[invitationId]` - Cancel invitation
- `POST /api/workspaces/[id]/invitations/[invitationId]` - Resend invitation (rotates the token and resets the 7-day expiry)

### Member Management

- `PATCH /api/workspaces/[id]/members/[memberId]` - Update member role
- `DELETE /api/workspaces/[id]/members/[memberId]` - Remove member
- `POST /api/workspaces/[id]/leave` - Leave workspace

### Cron Job

- `POST /api/cron/expire-invitations` - Expire pending invitations
- `GET /api/cron/expire-invitations` - Health check

## Testing the Implementation

### 1. Test Sending an Invitation

```bash
curl -X POST http://localhost:3000/api/workspaces/{workspaceId}/invitations \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "email": "test@example.com",
    "role": "member"
  }'
```

### 2. Test Getting Pending Invitations

```bash
curl http://localhost:3000/api/invitations/pending \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

### 3. Test Accepting an Invitation

```bash
curl -X POST http://localhost:3000/api/invitations/{invitationId}/accept \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "token": "invitation-token-here"
  }'
```

### 4. Test Cron Job

```bash
curl -X POST http://localhost:3000/api/cron/expire-invitations \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Troubleshooting

### TypeScript Errors

If you see TypeScript errors about `prisma.invitation`, regenerate the Prisma client:

```bash
npx prisma generate
```

### Emails Not Sending

1. Read the banner in the invite modal. A red *"Email delivery failed for ..."*
   carries the provider's own message; *"no email was sent - that address has
   bounced before"* means the address is suppressed, not that sending is broken.
2. Check the server log for `Failed to send invitation email:`
   (`src/lib/invitation-delivery.ts`).
3. Verify `EMAIL_FROM` is on a domain verified with your provider, and that
   `RESEND_API_KEY` (or the `SMTP_*` set) is correct.
4. If the mail arrives but the link is dead, `NEXT_PUBLIC_APP_URL` is wrong -
   see Environment Variables above.

### Invitations Not Expiring

1. Verify the cron job is running
2. Check the CRON_SECRET is set correctly
3. Test the cron endpoint manually:
   ```bash
   curl -X POST http://localhost:3000/api/cron/expire-invitations \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

### Permission Errors

1. Verify the user has the correct role
2. Check the permission mapping in `src/lib/workspace.ts`
3. Ensure the user is a member of the workspace

## Security Considerations

1. **CRON_SECRET**: Always use a strong, randomly generated secret
2. **Email Verification**: Verify email ownership during invitation acceptance
3. **Token Security**: Tokens are 64-character hex strings (32 bytes)
4. **Rate Limiting**: Enforced in `src/lib/api/rate-limit.ts` - 50 invitations per user per hour and 200 per workspace per day
5. **Audit Logging**: Consider adding audit logs for security-sensitive actions

## Next Steps

1. Verify your sending domain with your email provider
2. Set `NEXT_PUBLIC_APP_URL` (build time) and `NEXTAUTH_URL` in the deployment
3. Test the complete invitation flow, including sign-up for a brand-new invitee
4. Add audit logging (optional)

## Support

For issues or questions:
- Check the technical specification: `plans/multi-tenant-workspace-specification.md`
- Review the API endpoint implementations in `src/app/api/`
- Check the utility functions in `src/lib/workspace.ts` and `src/lib/email.ts`
