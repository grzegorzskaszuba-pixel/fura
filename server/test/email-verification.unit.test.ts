// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { createEmailVerificationToken, EMAIL_VERIFICATION_TTL_MS, hashEmailVerificationToken, isEmailVerificationTokenUsable } from '../email-verification.mjs'

describe('email verification tokens', () => {
  it('creates a hashed token that expires after 24 hours', () => {
    const createdAt = new Date('2026-09-18T12:00:00.000Z')
    const verification = createEmailVerificationToken('profile-1', createdAt)

    expect(verification.token).toHaveLength(64)
    expect(verification.record.tokenHash).toBe(hashEmailVerificationToken(verification.token))
    expect(verification.record.tokenHash).not.toBe(verification.token)
    expect(verification.record.expiresAt).toBe(new Date(createdAt.getTime() + EMAIL_VERIFICATION_TTL_MS).toISOString())
    expect(isEmailVerificationTokenUsable(verification.record, new Date('2026-09-19T11:59:59.999Z'))).toBe(true)
  })

  it('rejects used and expired tokens', () => {
    const createdAt = new Date('2026-09-18T12:00:00.000Z')
    const verification = createEmailVerificationToken('profile-1', createdAt)

    expect(isEmailVerificationTokenUsable(verification.record, new Date('2026-09-19T12:00:00.000Z'))).toBe(false)

    verification.record.usedAt = '2026-09-18T12:05:00.000Z'
    expect(isEmailVerificationTokenUsable(verification.record, new Date('2026-09-18T12:06:00.000Z'))).toBe(false)
  })
})