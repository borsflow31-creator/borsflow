import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkSmtpConnection } from '@/lib/email';

// GET /api/smtp/check
// Returns whether the configured SMTP server is reachable.
// Requires an authenticated session so it is not publicly accessible.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const provider = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
  if (provider !== 'smtp') {
    return NextResponse.json({
      ok: false,
      error: `EMAIL_PROVIDER is "${provider}", not "smtp". Set EMAIL_PROVIDER=smtp to use this check.`,
    }, { status: 400 });
  }

  const config = {
    host: process.env.SMTP_HOST || '(not set)',
    port: process.env.SMTP_PORT || '(not set)',
    user: process.env.SMTP_USER || '(not set)',
  };

  const result = await checkSmtpConnection();

  return NextResponse.json({ ...result, config });
}
