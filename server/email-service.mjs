import { Resend } from 'resend'

import { getEmailVerificationUrl } from './email-verification.mjs'

const EMAIL_FROM = 'FURA <no-reply@fura.info>'
const TEST_SUBJECT = 'FURA test email'
const TEST_HTML = '<p>This is a test email from FURA.</p>'
const TEST_TEXT = 'This is a test email from FURA.'
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
  return sendEmail({
    to,
    subject: TEST_SUBJECT,
    html: TEST_HTML,
    text: TEST_TEXT,
  })
}

export function sendEmailVerificationEmail(to, token) {
  const verificationUrl = getEmailVerificationUrl(token)

  return sendEmail({
    to,
    subject: VERIFICATION_SUBJECT,
    html: `<p>Welcome to FURA.</p><p><a href="${verificationUrl}">Confirm your email address</a> to activate your account.</p><p>This link expires in 24 hours.</p>`,
    text: `Welcome to FURA. Confirm your email address: ${verificationUrl}\n\nThis link expires in 24 hours.`,
  })
}