import crypto from 'node:crypto'

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000

export function hashEmailVerificationToken(token) {
  return crypto.createHash('sha256').update(String(token ?? '')).digest('hex')
}

export function createEmailVerificationToken(profileId, createdAt = new Date()) {
  const token = crypto.randomBytes(32).toString('hex')
  const createdAtIso = createdAt.toISOString()

  return {
    token,
    record: {
      id: crypto.randomUUID(),
      profileId,
      tokenHash: hashEmailVerificationToken(token),
      expiresAt: new Date(createdAt.getTime() + EMAIL_VERIFICATION_TTL_MS).toISOString(),
      createdAt: createdAtIso,
      usedAt: null,
    },
  }
}

export function isEmailVerificationTokenUsable(record, currentTime = new Date()) {
  if (!record || record.usedAt) {
    return false
  }

  const expiresAt = new Date(record.expiresAt).getTime()
  return Number.isFinite(expiresAt) && expiresAt > currentTime.getTime()
}

export function getEmailVerificationUrl(token) {
  const baseUrl = String(process.env.AUTH_WEB_BASE_URL ?? 'https://fura.info').trim().replace(/\/+$/, '')
  return `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`
}