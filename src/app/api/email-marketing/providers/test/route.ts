import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { type, apiKey, fromEmail, domain, region, serverToken } = body

  if (!type || !apiKey || !fromEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    if (type === 'resend') {
      const resend = new Resend(apiKey)
      const response = await resend.emails.send({
        from: fromEmail,
        to: 'delivered@resend.dev',
        subject: 'Resend Configuration Test',
        html: '<p>This is a test email to validate your Resend configuration.</p>'
      })
      if (response.error) {
        return NextResponse.json({ success: false, error: response.error.message })
      }
      return NextResponse.json({ success: true })
    }

    if (type === 'sendgrid') {
      const { SendGridProvider } = await import('@/lib/email/providers/sendgrid-provider')
      const provider = new SendGridProvider({ id: 'test', type: 'sendgrid', apiKey, fromEmail, isActive: true, isDefault: false, priority: 1, weight: 1, costPerEmail: 0 })
      const result = await provider.sendEmail({ to: fromEmail, subject: 'SendGrid Configuration Test', html: '<p>This is a test email to validate your SendGrid configuration.</p>' })
      if (!result.success) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (type === 'brevo') {
      const payload = {
        sender: { email: fromEmail },
        to: [{ email: fromEmail }],
        subject: 'Brevo Configuration Test',
        htmlContent: '<p>This is a test email to validate your Brevo configuration.</p>',
      }
      const res = await fetch('https://api.brevo.com/v1/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        let errMsg = `Brevo API error ${res.status}`
        try { const data = await res.json(); errMsg = data.message || errMsg } catch {}
        return NextResponse.json({ success: false, error: errMsg })
      }
      return NextResponse.json({ success: true })
    }

    if (type === 'ses') {
      const { SESProvider } = await import('@/lib/email/providers/ses-provider')
      const provider = new SESProvider({ id: 'test', type: 'ses', apiKey, fromEmail, region: region || 'us-east-1', isActive: true, isDefault: false, priority: 1, weight: 1, costPerEmail: 0 })
      const result = await provider.sendEmail({ to: fromEmail, subject: 'SES Configuration Test', html: '<p>This is a test email to validate your SES configuration.</p>' })
      if (!result.success) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (type === 'mailgun') {
      const { MailgunProvider } = await import('@/lib/email/providers/mailgun-provider')
      // The form doesn't ask for a sending domain; find it from the From address,
      // exactly as saving the provider does.
      const { findMailgunDomain } = await import('@/lib/email/webhook-setup')
      const sendingDomain = domain || await findMailgunDomain(apiKey, region, fromEmail)
      const provider = new MailgunProvider({ id: 'test', type: 'mailgun', apiKey, fromEmail, domain: sendingDomain, region: region || 'us', isActive: true, isDefault: false, priority: 1, weight: 1, costPerEmail: 0 })
      const result = await provider.sendEmail({ to: fromEmail, subject: 'Mailgun Configuration Test', html: '<p>This is a test email to validate your Mailgun configuration.</p>' })
      if (!result.success) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (type === 'postmark') {
      const { PostmarkProvider } = await import('@/lib/email/providers/postmark-provider')
      const provider = new PostmarkProvider({ id: 'test', type: 'postmark', apiKey, fromEmail, serverToken: serverToken || apiKey, isActive: true, isDefault: false, priority: 1, weight: 1, costPerEmail: 0 })
      const result = await provider.sendEmail({ to: fromEmail, subject: 'Postmark Configuration Test', html: '<p>This is a test email to validate your Postmark configuration.</p>' })
      if (!result.success) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    // No sender exists for this type, so a "successful" test here was a false
    // assurance: campaigns sent through it were marked sent and never delivered.
    return NextResponse.json({ success: false, error: `Provider type "${type}" is not supported for sending` })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to test provider' })
  }
}
