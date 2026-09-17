import { db } from '@/data/database/db'
import type { AuthCredentialRecord } from '@/shared/types/domain'

export const authCredentialRepository = {
  async getByUsername(username: string) {
    const normalizedUsername = username.trim().toLowerCase()
    const candidates = [normalizedUsername]

    if (normalizedUsername.endsWith('@fura.info')) {
      candidates.push(`${normalizedUsername.slice(0, -'@fura.info'.length)}@gmail.com`)
    }

    for (const candidate of candidates) {
      const credentials = await db.authCredentials.where('username').equalsIgnoreCase(candidate).first()

      if (credentials) {
        return credentials
      }
    }

    return undefined
  },

  async getByProfileId(profileId: string) {
    return db.authCredentials.get(profileId)
  },

  async updateUsername(profileId: string, username: string) {
    await db.authCredentials.update(profileId, {
      username,
      updatedAt: new Date().toISOString(),
    })
  },

  async create(record: AuthCredentialRecord) {
    await db.authCredentials.add(record)
  },

  async updatePassword(profileId: string, payload: { passwordHash: string; passwordSalt: string }) {
    await db.authCredentials.update(profileId, {
      passwordHash: payload.passwordHash,
      passwordSalt: payload.passwordSalt,
      updatedAt: new Date().toISOString(),
    })
  },

  async touch(profileId: string) {
    await db.authCredentials.update(profileId, { updatedAt: new Date().toISOString() })
  },

  async listProfileIdsWithoutCredentials() {
    const profileIds = await db.profiles.toCollection().primaryKeys()
    const credentials = await db.authCredentials.toArray()
    const credentialsByProfile = new Set(credentials.map((item) => item.profileId))

    return profileIds.filter((profileId) => !credentialsByProfile.has(profileId))
  },
}
