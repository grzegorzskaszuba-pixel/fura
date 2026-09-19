// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { createPasswordResetToken, getPasswordResetUrl, hashPasswordResetToken, isPasswordResetTokenUsable, PASSWORD_RESET_TTL_MS } from '../password-reset.mjs'

describe('password reset tokens', () => {
  it('creates a hashed token that expires after 30 minutes', () => {
    const createdAt = new Date('2026-09-19T12:00:00.000Z')
    const passwordReset = createPasswordResetToken('profile-1', createdAt)

    expect(passwordReset.token).toHaveLength(64)
    expect(passwordReset.record.tokenHash).toBe(hashPasswordResetToken(passwordReset.token))
    expect(passwordReset.record.tokenHash).not.toBe(passwordReset.token)
    expect(passwordReset.record.expiresAt).toBe(new Date(createdAt.getTime() + PASSWORD_RESET_TTL_MS).toISOString())
    expect(isPasswordResetTokenUsable(passwordReset.record, new Date('2026-09-19T12:29:59.999Z'))).toBe(true)
    expect(getPasswordResetUrl(passwordReset.token)).toContain(`/reset-password?token=${passwordReset.token}`)
  })

  it('rejects expired and used tokens', () => {
    const createdAt = new Date('2026-09-19T12:00:00.000Z')
    const passwordReset = createPasswordResetToken('profile-1', createdAt)

    expect(isPasswordResetTokenUsable(passwordReset.record, new Date('2026-09-19T12:30:00.000Z'))).toBe(false)

    passwordReset.record.usedAt = '2026-09-19T12:05:00.000Z'
    expect(isPasswordResetTokenUsable(passwordReset.record, new Date('2026-09-19T12:06:00.000Z'))).toBe(false)
  })
})