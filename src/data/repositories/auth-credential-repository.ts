import { db } from '@/data/database/db'
import type { AuthCredentialRecord } from '@/shared/types/domain'

export const authCredentialRepository = {
  async getByUsername(username: string) {
    return db.authCredentials.where('username').equalsIgnoreCase(username).first()
  },

  async getByProfileId(profileId: string) {
    return db.authCredentials.get(profileId)
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
