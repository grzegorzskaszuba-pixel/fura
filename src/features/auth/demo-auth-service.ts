import { appStateRepository } from '@/data/repositories/app-state-repository'
import { profileRepository } from '@/data/repositories/profile-repository'
import type { AuthService } from '@/features/auth/auth-service'
import type { ProfileCredentials } from '@/shared/types/domain'

async function setAndReturnProfile(profileId: string) {
  const profile = await profileRepository.getById(profileId)

  if (!profile) {
    throw new Error('Profil nie istnieje')
  }

  await appStateRepository.setCurrentProfileId(profile.id)
  await profileRepository.touch(profile.id)
  return profile
}

export class DemoAuthService implements AuthService {
  async getCurrentProfileId() {
    return appStateRepository.getCurrentProfileId()
  }

  async login(input: ProfileCredentials) {
    const profile = await profileRepository.getByUsername(input.username.trim())

    if (!profile) {
      throw new Error('Nie znaleziono profilu o podanej nazwie użytkownika')
    }

    return setAndReturnProfile(profile.id)
  }

  async register(input: ProfileCredentials) {
    const normalizedUsername = input.username.trim().toLowerCase()
    const existingProfile = await profileRepository.getByUsername(normalizedUsername)

    if (existingProfile) {
      throw new Error('Taki profil już istnieje')
    }

    const profile = await profileRepository.create({
      username: normalizedUsername,
      displayName: input.displayName,
    })

    await appStateRepository.setCurrentProfileId(profile.id)
    return profile
  }

  async loginDemo() {
    const demoProfile = await profileRepository.getByUsername('demo')

    if (!demoProfile) {
      throw new Error('Brak danych demo')
    }

    return setAndReturnProfile(demoProfile.id)
  }

  async switchProfile(profileId: string) {
    return setAndReturnProfile(profileId)
  }

  async logout() {
    await appStateRepository.setCurrentProfileId(null)
  }
}

export const demoAuthService = new DemoAuthService()