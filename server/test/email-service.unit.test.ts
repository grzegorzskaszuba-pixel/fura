// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

const { sendMock, ResendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  ResendMock: vi.fn(),
}))

vi.mock('resend', () => ({ Resend: ResendMock }))

import { sendAccountDeletedEmail, sendEmailVerificationEmail, sendPasswordChangedEmail, sendPasswordResetEmail, sendTestEmail } from '../email-service.mjs'

const originalApiKey = process.env.RESEND_API_KEY
const originalWebBaseUrl = process.env.AUTH_WEB_BASE_URL

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.RESEND_API_KEY
  } else {
    process.env.RESEND_API_KEY = originalApiKey
  }

  if (originalWebBaseUrl === undefined) {
    delete process.env.AUTH_WEB_BASE_URL
  } else {
    process.env.AUTH_WEB_BASE_URL = originalWebBaseUrl
  }

  sendMock.mockReset()
  ResendMock.mockReset()
  ResendMock.mockImplementation(function (this: { emails: { send: typeof sendMock }; apiKey: string }, apiKey: string) {
    this.emails = {
      send: sendMock,
    }
    this.apiKey = apiKey
  })
})

describe('email service', () => {
  it('returns a clear error when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY

    await expect(sendTestEmail('grzegorz.s.kaszuba@gmail.com')).rejects.toThrow('RESEND_API_KEY is not configured')
    expect(ResendMock).not.toHaveBeenCalled()
  })

  it('sends the minimal test email through Resend', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    sendMock.mockResolvedValue({ data: { id: 'email-test-id' }, error: null })

    await expect(sendTestEmail('  grzegorz.s.kaszuba@gmail.com  ')).resolves.toEqual({ id: 'email-test-id' })

    expect(ResendMock).toHaveBeenCalledWith('test-key')
    const emailPayload = sendMock.mock.calls[0]?.[0] as { from: string; to: string; subject: string; html: string; text: string }

    expect(emailPayload).toMatchObject({
      from: 'FURA <no-reply@fura.info>',
      to: 'grzegorz.s.kaszuba@gmail.com',
      subject: 'Testowy e-mail FURA',
      text: 'FURA\n\nTestowy e-mail FURA\n\nTo jest testowa wiadomość e-mail od FURA.\n\nFURA\nProsty dziennik serwisowy dla każdego auta.',
    })
    expect(emailPayload.html).toContain('Testowy e-mail FURA')
    expect(emailPayload.html).toContain('To jest testowa wiadomość e-mail od FURA.')
    expect(emailPayload.html).toContain('Prosty dziennik serwisowy dla każdego auta.')
  })

  it('converts a Resend provider error into a readable error', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    sendMock.mockResolvedValue({ data: null, error: { message: 'domain is not verified' } })

    await expect(sendTestEmail('grzegorz.s.kaszuba@gmail.com')).rejects.toThrow('Resend failed to send the email: domain is not verified')
  })

  it('sends a verification link with a plain-text fallback', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    process.env.AUTH_WEB_BASE_URL = 'https://fura.info/'
    sendMock.mockResolvedValue({ data: { id: 'verification-email-id' }, error: null })

    await expect(sendEmailVerificationEmail('driver@example.com', 'verification-token')).resolves.toEqual({ id: 'verification-email-id' })

    const emailPayload = sendMock.mock.calls[0]?.[0] as { from: string; to: string; subject: string; html: string; text: string }

    expect(emailPayload).toMatchObject({
      from: 'FURA <no-reply@fura.info>',
      to: 'driver@example.com',
      subject: 'Potwierdź adres e-mail w FURA',
      text: 'FURA\n\nPotwierdź adres e-mail\n\nWitamy w FURA. Potwierdź adres e-mail, aby aktywować konto.\n\nLink jest ważny przez 24 godziny.\n\nPotwierdź adres e-mail: https://fura.info/verify-email?token=verification-token\n\nFURA\nProsty dziennik serwisowy dla każdego auta.',
    })
    expect(emailPayload.html).toContain('Potwierdź adres e-mail')
    expect(emailPayload.html).toContain('https://fura.info/verify-email?token=verification-token')
    expect(emailPayload.html).toContain('Prosty dziennik serwisowy dla każdego auta.')
    expect(emailPayload.html).toContain('#f97316')
  })

  it('sends a password reset link with its expiry and a password change notice', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    process.env.AUTH_WEB_BASE_URL = 'https://fura.info/'
    sendMock.mockResolvedValue({ data: { id: 'password-email-id' }, error: null })

    await expect(sendPasswordResetEmail('driver@example.com', 'password-token')).resolves.toEqual({ id: 'password-email-id' })
    await expect(sendPasswordChangedEmail('driver@example.com')).resolves.toEqual({ id: 'password-email-id' })

    const resetPayload = sendMock.mock.calls[0]?.[0] as { subject: string; text: string; html: string }
    const changedPayload = sendMock.mock.calls[1]?.[0] as { subject: string; text: string; html: string }

    expect(resetPayload.subject).toBe('Reset hasła w FURA')
    expect(resetPayload.text).toContain('Link jest ważny przez 30 minut i może zostać użyty tylko raz.')
    expect(resetPayload.text).toContain('https://fura.info/reset-password?token=password-token')
    expect(resetPayload.html).toContain('Ustaw nowe hasło')
    expect(changedPayload.subject).toBe('Hasło do konta FURA zostało zmienione')
    expect(changedPayload.text).toContain('Hasło do konta FURA zostało zmienione. Jeśli to nie Ty, skontaktuj się z nami.')
  })

  it('sends an account deletion confirmation', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    sendMock.mockResolvedValue({ data: { id: 'account-deleted-email-id' }, error: null })

    await expect(sendAccountDeletedEmail('driver@example.com')).resolves.toEqual({ id: 'account-deleted-email-id' })

    const emailPayload = sendMock.mock.calls[0]?.[0] as { to: string; subject: string; html: string; text: string }

    expect(emailPayload).toMatchObject({
      to: 'driver@example.com',
      subject: 'Potwierdzenie usunięcia konta FURA',
      text: 'FURA\n\nKonto zostało usunięte\n\nPotwierdzamy, że Twoje konto FURA oraz zapisane dane zostały pomyślnie usunięte.\n\nFURA\nProsty dziennik serwisowy dla każdego auta.',
    })
    expect(emailPayload.html).toContain('Konto zostało usunięte')
    expect(emailPayload.html).toContain('Potwierdzamy, że Twoje konto FURA oraz zapisane dane zostały pomyślnie usunięte.')
  })
})