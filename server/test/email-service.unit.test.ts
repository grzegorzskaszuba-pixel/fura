// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

const { sendMock, ResendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  ResendMock: vi.fn(),
}))

vi.mock('resend', () => ({ Resend: ResendMock }))

import { sendTestEmail } from '../email-service.mjs'

const originalApiKey = process.env.RESEND_API_KEY

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.RESEND_API_KEY
  } else {
    process.env.RESEND_API_KEY = originalApiKey
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
    expect(sendMock).toHaveBeenCalledWith({
      from: 'FURA <no-reply@fura.info>',
      to: 'grzegorz.s.kaszuba@gmail.com',
      subject: 'FURA test email',
      html: '<p>This is a test email from FURA.</p>',
      text: 'This is a test email from FURA.',
    })
  })

  it('converts a Resend provider error into a readable error', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    sendMock.mockResolvedValue({ data: null, error: { message: 'domain is not verified' } })

    await expect(sendTestEmail('grzegorz.s.kaszuba@gmail.com')).rejects.toThrow('Resend failed to send the email: domain is not verified')
  })
})