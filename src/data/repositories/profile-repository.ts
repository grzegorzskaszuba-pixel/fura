import { db } from '@/data/database/db'
import { generateId } from '@/shared/lib/utils'
import type { ProfileCredentials, UserProfile } from '@/shared/types/domain'

export const profileRepository = {
  async list() {
    return db.profiles.orderBy('updatedAt').reverse().toArray()
  },

  async getById(id: string) {
    return db.profiles.get(id)
  },

  async getByUsername(username: string) {
    return db.profiles.where('username').equalsIgnoreCase(username).first()
  },

  async create(input: ProfileCredentials) {
    const now = new Date().toISOString()
    const profile: UserProfile = {
      id: generateId(),
      username: input.username.trim(),
      displayName: input.displayName?.trim() || input.username.trim(),
      createdAt: now,
      updatedAt: now,
    }

    await db.profiles.add(profile)
    return profile
  },

  async touch(id: string) {
    await db.profiles.update(id, { updatedAt: new Date().toISOString() })
  },
}
