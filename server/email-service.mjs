import { Resend } from 'resend'

import { getEmailVerificationUrl } from './email-verification.mjs'
import { renderFuraEmailNote, renderFuraEmailTemplate, renderFuraEmailText } from './email-template.mjs'

const EMAIL_FROM = 'FURA <no-reply@fura.info>'
const TEST_SUBJECT = 'FURA test email'
const VERIFICATION_SUBJECT = 'Confirm your FURA email address'

function getResendApiKey() {
  const apiKey = String(process.env.RESEND_API_KEY ?? '').trim()

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured for the backend.')
  }

  return apiKey
}

function normalizeRecipient(to) {
  if (typeof to !== 'string' || to.trim().length === 0) {
    throw new Error('A recipient email address is required.')
  }

  return to.trim()
}

async function sendEmail({ to, subject, html, text }) {
  const recipient = normalizeRecipient(to)
  const resend = new Resend(getResendApiKey())
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: recipient,
    subject,
    html,
    text,
  })

  if (error) {
    throw new Error(`Resend failed to send the email: ${error.message ?? 'unknown provider error'}`)
  }

  return data
}

export function sendTestEmail(to) {
  const title = 'FURA test email'
  const intro = 'This is a test email from FURA.'

  return sendEmail({
    to,
    subject: TEST_SUBJECT,
    html: renderFuraEmailTemplate({
      preheader: intro,
      title,
      intro,
    }),
    text: renderFuraEmailText({
      title,
      intro,
    }),
  })
}

export function sendEmailVerificationEmail(to, token) {
  const verificationUrl = getEmailVerificationUrl(token)
  const title = 'Confirm your email address'
  const intro = 'Welcome to FURA. Confirm your email address to activate your account.'
  const action = {
    label: 'Confirm email address',
    url: verificationUrl,
  }

  return sendEmail({
    to,
    subject: VERIFICATION_SUBJECT,
    html: renderFuraEmailTemplate({
      preheader: 'Confirm your FURA email address',
      title,
      intro,
      contentHtml: renderFuraEmailNote('This link expires in 24 hours.'),
      action,
    }),
    text: renderFuraEmailText({
      title,
      intro,
      bodyText: 'This link expires in 24 hours.',
      action,
    }),
  })
}