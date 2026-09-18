// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

const { sendMock, ResendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  ResendMock: vi.fn(),
}))

vi.mock('resend', () => ({ Resend: ResendMock }))

import { sendEmailVerificationEmail, sendTestEmail } from '../email-service.mjs'

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
      subject: 'FURA test email',
      text: 'FURA\n\nFURA test email\n\nThis is a test email from FURA.\n\nFURA\nSimple service log for every car.',
    })
    expect(emailPayload.html).toContain('FURA test email')
    expect(emailPayload.html).toContain('This is a test email from FURA.')
    expect(emailPayload.html).toContain('Simple service log for every car.')
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
      subject: 'Confirm your FURA email address',
      text: 'FURA\n\nConfirm your email address\n\nWelcome to FURA. Confirm your email address to activate your account.\n\nThis link expires in 24 hours.\n\nConfirm email address: https://fura.info/verify-email?token=verification-token\n\nFURA\nSimple service log for every car.',
    })
    expect(emailPayload.html).toContain('Confirm your email address')
    expect(emailPayload.html).toContain('Confirm email address')
    expect(emailPayload.html).toContain('https://fura.info/verify-email?token=verification-token')
    expect(emailPayload.html).toContain('Simple service log for every car.')
    expect(emailPayload.html).toContain('#f97316')
  })
})