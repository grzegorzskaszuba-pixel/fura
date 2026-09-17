import { db } from '@/data/database/db'
import { appConfig } from '@/shared/config/app-config'
import { httpRequest } from '@/shared/lib/http-client'
import { generateId } from '@/shared/lib/utils'
import type { ProfileCreateInput, UserProfile } from '@/shared/types/domain'

const profilesBaseUrl = `${appConfig.apiBaseUrl}/profiles`

function isRemoteMode() {
  return appConfig.authMode === 'remote'
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase()
}

function toProfileRecord(input: ProfileCreateInput): UserProfile {
  const now = new Date().toISOString()

  return {
    id: `profile-${generateId()}`,
    username: normalizeUsername(input.username),
    displayName: input.displayName?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }
}

export const profileRepository = {
  async list(): Promise<UserProfile[]> {
    if (!isRemoteMode()) {
      return db.profiles.orderBy('updatedAt').reverse().toArray()
    }

    const response = await httpRequest<{ profiles: UserProfile[] }>(profilesBaseUrl)
    return response.profiles
  },

  async syncRemoteList(): Promise<void> {
    return
  },

  async getById(id: string): Promise<UserProfile | null> {
    if (!isRemoteMode()) {
      return (await db.profiles.get(id)) ?? null
    }

    const response = await httpRequest<{ profiles: UserProfile[] }>(profilesBaseUrl)
    return response.profiles.find((profile) => profile.id === id) ?? null
  },

  async getByUsername(username: string): Promise<UserProfile | null> {
    const normalizedUsername = normalizeUsername(username)
    const candidates = [normalizedUsername]

    if (normalizedUsername.endsWith('@fura.info')) {
      candidates.push(`${normalizedUsername.slice(0, -'@fura.info'.length)}@gmail.com`)
    }

    if (!isRemoteMode()) {
      for (const candidate of candidates) {
        const profile = await db.profiles.where('username').equalsIgnoreCase(candidate).first()

        if (profile) {
          return profile
        }
      }

      return null
    }

    const response = await httpRequest<{ profiles: UserProfile[] }>(profilesBaseUrl)
    return response.profiles.find((profile) => candidates.includes(profile.username.toLowerCase())) ?? null
  },

  async create(input: ProfileCreateInput): Promise<UserProfile> {
    if (isRemoteMode()) {
      void input
      throw new Error('Tworzenie profilu działa tylko przez authService.register')
    }

    const normalizedUsername = normalizeUsername(input.username)
    const existingProfile = await db.profiles.where('username').equalsIgnoreCase(normalizedUsername).first()

    if (existingProfile) {
      throw new Error('Taki profil już istnieje')
    }

    const profile = toProfileRecord({ ...input, username: normalizedUsername })
    await db.profiles.add(profile)
    return profile
  },

  async upsert(profile: UserProfile): Promise<UserProfile> {
    if (!isRemoteMode()) {
      const existing = await db.profiles.get(profile.id)
      const now = new Date().toISOString()
      const nextProfile: UserProfile = {
        ...profile,
        displayName: profile.displayName?.trim() || undefined,
        createdAt: existing?.createdAt ?? profile.createdAt ?? now,
        updatedAt: now,
      }

      await db.profiles.put(nextProfile)
      return nextProfile
    }

    const response = await httpRequest<{ profile: UserProfile }>(`${profilesBaseUrl}/${profile.id}`, {
      method: 'PUT',
      body: {
        displayName: profile.displayName,
      },
    })

    return response.profile
  },

  async touch(id: string): Promise<void> {
    if (!isRemoteMode()) {
      await db.profiles.update(id, { updatedAt: new Date().toISOString() })
      return
    }

    void id
  },
}
