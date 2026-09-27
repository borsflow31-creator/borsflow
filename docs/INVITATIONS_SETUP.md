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

# Email Configuration (Optional - for sending invitations)
EMAIL_FROM="noreply@borsflow.com"
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="apikey"
SMTP_PASSWORD="your-smtp-password"

# Application URL (for invitation links)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

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

### Option 1: Using a Cron Job Service (Recommended for Production)

Use services like:
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [GitHub Actions](https://docs.github.com/en/actions)
- [EasyCron](https://www.easycron.com/)
- [Cron-job.org](https://cron-job.org/)

#### Vercel Cron Jobs

Create a `vercel.json` file in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/expire-invitations",
      "schedule": "0 * * * *"
    }
  ]
}
```

This will run the cron job every hour.

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

The email service is currently set up to log emails to the console. To send real emails, you need to integrate with an email service provider.

### Option 1: Resend (Recommended)

1. Install Resend:
   ```bash
   npm install resend
   ```

2. Update `src/lib/email.ts`:
   ```typescript
   import { Resend } from 'resend'

   const resend = new Resend(process.env.RESEND_API_KEY)

   export async function sendInvitationEmail(...) {
     // ... existing code ...

     await resend.emails.send({
       from: process.env.EMAIL_FROM || 'noreply@borsflow.com',
       to: email,
       subject: `You're invited to join ${workspaceName}`,
       html,
     })
   }
   ```

3. Add to `.env`:
   ```env
   RESEND_API_KEY="your-resend-api-key"
   ```

### Option 2: SendGrid

1. Install SendGrid:
   ```bash
   npm install @sendgrid/mail
   ```

2. Update `src/lib/email.ts`:
   ```typescript
   import sgMail from '@sendgrid/mail'

   sgMail.setApiKey(process.env.SENDGRID_API_KEY)

   export async function sendInvitationEmail(...) {
     // ... existing code ...

     await sgMail.send({
       to: email,
       from: process.env.EMAIL_FROM || 'noreply@borsflow.com',
       subject: `You're invited to join ${workspaceName}`,
       html,
     })
   }
   ```

3. Add to `.env`:
   ```env
   SENDGRID_API_KEY="your-sendgrid-api-key"
   ```

### Option 3: AWS SES

1. Install AWS SDK:
   ```bash
   npm install @aws-sdk/client-ses
   ```

2. Update `src/lib/email.ts`:
   ```typescript
   import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

   const sesClient = new SESClient({ region: process.env.AWS_REGION })

   export async function sendInvitationEmail(...) {
     // ... existing code ...

     await sesClient.send(new SendEmailCommand({
       Source: process.env.EMAIL_FROM || 'noreply@borsflow.com',
       Destination: { ToAddresses: [email] },
       Message: {
         Subject: { Data: `You're invited to join ${workspaceName}` },
         Body: { Html: { Data: html } },
       },
     }))
   }
   ```

3. Add to `.env`:
   ```env
   AWS_REGION="us-east-1"
   AWS_ACCESS_KEY_ID="your-access-key"
   AWS_SECRET_ACCESS_KEY="your-secret-key"
   ```

## API Endpoints

### Invitation Management

- `POST /api/workspaces/[id]/invitations` - Send invitation
- `GET /api/workspaces/[id]/invitations` - List workspace invitations
- `GET /api/invitations/pending` - Get user's pending invitations
- `POST /api/invitations/[id]/accept` - Accept invitation
- `POST /api/invitations/[id]/decline` - Decline invitation
- `DELETE /api/workspaces/[id]/invitations/[invitationId]` - Cancel invitation
- `POST /api/workspaces/[id]/invitations/[invitationId]/resend` - Resend invitation

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

1. Check the console logs for email content (currently logged)
2. Verify your email service credentials
3. Check if the email service API key is correct
4. Ensure the email service is properly configured

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
4. **Rate Limiting**: Consider implementing rate limiting for invitation endpoints
5. **Audit Logging**: Consider adding audit logs for security-sensitive actions

## Next Steps

1. Set up your email service provider
2. Configure the cron job for production
3. Test the complete invitation flow
4. Implement rate limiting (optional)
5. Add audit logging (optional)
6. Create frontend UI components for invitation management

## Support

For issues or questions:
- Check the technical specification: `plans/multi-tenant-workspace-specification.md`
- Review the API endpoint implementations in `src/app/api/`
- Check the utility functions in `src/lib/workspace.ts` and `src/lib/email.ts`
