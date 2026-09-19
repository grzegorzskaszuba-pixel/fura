import crypto from 'node:crypto'

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000

export function hashPasswordResetToken(token) {
  return crypto.createHash('sha256').update(String(token ?? '')).digest('hex')
}

export function createPasswordResetToken(profileId, createdAt = new Date()) {
  const token = crypto.randomBytes(32).toString('hex')
  const createdAtIso = createdAt.toISOString()

  return {
    token,
    record: {
      id: crypto.randomUUID(),
      profileId,
      tokenHash: hashPasswordResetToken(token),
      expiresAt: new Date(createdAt.getTime() + PASSWORD_RESET_TTL_MS).toISOString(),
      createdAt: createdAtIso,
      usedAt: null,
    },
  }
}

export function isPasswordResetTokenUsable(record, currentTime = new Date()) {
  if (!record || record.usedAt) {
    return false
  }

  const expiresAt = new Date(record.expiresAt).getTime()
  return Number.isFinite(expiresAt) && expiresAt > currentTime.getTime()
}

export function getPasswordResetUrl(token) {
  const baseUrl = String(process.env.AUTH_WEB_BASE_URL ?? 'https://fura.info').trim().replace(/\/+$/, '')
  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`
}