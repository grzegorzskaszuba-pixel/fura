import { Resend } from 'resend'

import { getEmailVerificationUrl } from './email-verification.mjs'
import { getPasswordResetUrl } from './password-reset.mjs'
import { renderFuraEmailNote, renderFuraEmailTemplate, renderFuraEmailText } from './email-template.mjs'

const EMAIL_FROM = 'FURA <no-reply@fura.info>'
const TEST_SUBJECT = 'Testowy e-mail FURA'
const VERIFICATION_SUBJECT = 'Potwierdź adres e-mail w FURA'
const PASSWORD_RESET_SUBJECT = 'Reset hasła w FURA'
const PASSWORD_CHANGED_SUBJECT = 'Hasło do konta FURA zostało zmienione'
const ACCOUNT_DELETED_SUBJECT = 'Potwierdzenie usunięcia konta FURA'

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

export function sendPasswordResetEmail(to, token) {
  const resetUrl = getPasswordResetUrl(token)
  const title = 'Ustaw nowe hasło'
  const intro = 'Otrzymaliśmy prośbę o ustawienie nowego hasła do Twojego konta FURA.'
  const action = {
    label: 'Ustaw nowe hasło',
    url: resetUrl,
  }

  return sendEmail({
    to,
    subject: PASSWORD_RESET_SUBJECT,
    html: renderFuraEmailTemplate({
      preheader: 'Ustaw nowe hasło do konta FURA',
      title,
      intro,
      contentHtml: renderFuraEmailNote('Link jest ważny przez 30 minut i może zostać użyty tylko raz.'),
      action,
    }),
    text: renderFuraEmailText({
      title,
      intro,
      bodyText: 'Link jest ważny przez 30 minut i może zostać użyty tylko raz.',
      action,
    }),
  })
}

export function sendPasswordChangedEmail(to) {
  const title = 'Hasło zostało zmienione'
  const intro = 'Hasło do konta FURA zostało zmienione. Jeśli to nie Ty, skontaktuj się z nami.'

  return sendEmail({
    to,
    subject: PASSWORD_CHANGED_SUBJECT,
    html: renderFuraEmailTemplate({
      preheader: 'Hasło do konta FURA zostało zmienione',
      title,
      intro,
    }),
    text: renderFuraEmailText({
      title,
      intro,
    }),
  })
}

export function sendAccountDeletedEmail(to) {
  const title = 'Konto zostało usunięte'
  const intro = 'Potwierdzamy, że Twoje konto FURA oraz zapisane dane zostały pomyślnie usunięte.'

  return sendEmail({
    to,
    subject: ACCOUNT_DELETED_SUBJECT,
    html: renderFuraEmailTemplate({
      preheader: 'Potwierdzenie usunięcia konta FURA',
      title,
      intro,
    }),
    text: renderFuraEmailText({
      title,
      intro,
    }),
  })
}