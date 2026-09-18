import { Resend } from 'resend'

import { getEmailVerificationUrl } from './email-verification.mjs'
import { renderFuraEmailNote, renderFuraEmailTemplate, renderFuraEmailText } from './email-template.mjs'

const EMAIL_FROM = 'FURA <no-reply@fura.info>'
const TEST_SUBJECT = 'Testowy e-mail FURA'
const VERIFICATION_SUBJECT = 'Potwierdź adres e-mail w FURA'

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
  const title = 'Testowy e-mail FURA'
  const intro = 'To jest testowa wiadomość e-mail od FURA.'

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
  const title = 'Potwierdź adres e-mail'
  const intro = 'Witamy w FURA. Potwierdź adres e-mail, aby aktywować konto.'
  const action = {
    label: 'Potwierdź adres e-mail',
    url: verificationUrl,
  }

  return sendEmail({
    to,
    subject: VERIFICATION_SUBJECT,
    html: renderFuraEmailTemplate({
      preheader: 'Potwierdź adres e-mail w FURA',
      title,
      intro,
      contentHtml: renderFuraEmailNote('Link jest ważny przez 24 godziny.'),
      action,
    }),
    text: renderFuraEmailText({
      title,
      intro,
      bodyText: 'Link jest ważny przez 24 godziny.',
      action,
    }),
  })
}