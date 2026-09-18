import { Resend } from 'resend'

const EMAIL_FROM = 'FURA <no-reply@fura.info>'
const TEST_SUBJECT = 'FURA test email'
const TEST_HTML = '<p>This is a test email from FURA.</p>'
const TEST_TEXT = 'This is a test email from FURA.'

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

export async function sendTestEmail(to) {
  const recipient = normalizeRecipient(to)
  const resend = new Resend(getResendApiKey())
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: recipient,
    subject: TEST_SUBJECT,
    html: TEST_HTML,
    text: TEST_TEXT,
  })

  if (error) {
    throw new Error(`Resend failed to send the email: ${error.message ?? 'unknown provider error'}`)
  }

  return data
}