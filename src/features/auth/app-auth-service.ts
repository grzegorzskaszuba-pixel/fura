import { appStateRepository } from '@/data/repositories/app-state-repository'
import { authCredentialRepository } from '@/data/repositories/auth-credential-repository'
import { profileRepository } from '@/data/repositories/profile-repository'
import type { AuthService } from '@/features/auth/auth-service'
import { createPasswordHash, verifyPassword } from '@/shared/lib/password'
import type { LoginCredentials, RegisterCredentials } from '@/shared/types/domain'

async function setAndReturnProfile(profileId: string) {
  const profile = await profileRepository.getById(profileId)

  if (!profile) {
    throw new Error('Profil nie istnieje')
  }

  await appStateRepository.setCurrentProfileId(profile.id)
  await profileRepository.touch(profile.id)
  await authCredentialRepository.touch(profile.id)
  return profile
}

export class AppAuthService implements AuthService {
  async getCurrentProfileId() {
    return appStateRepository.getCurrentProfileId()
  }

  async login(input: LoginCredentials) {
    const normalizedUsername = input.username.trim().toLowerCase()
    const credentials = await authCredentialRepository.getByUsername(normalizedUsername)

    if (!credentials) {
      throw new Error('Nie znaleziono profilu o podanej nazwie użytkownika')
    }

    const passwordValid = await verifyPassword(input.password, credentials.passwordSalt, credentials.passwordHash)

    if (!passwordValid) {
      throw new Error('Nieprawidłowe hasło')
    }

    return setAndReturnProfile(credentials.profileId)
  }

  async register(input: RegisterCredentials) {
    const normalizedUsername = input.username.trim().toLowerCase()
    const existingProfile = await profileRepository.getByUsername(normalizedUsername)

    if (existingProfile) {
      throw new Error('Taki profil już istnieje')
    }

    const profile = await profileRepository.create({
      username: normalizedUsername,
      displayName: input.displayName,
    })
    const passwordData = await createPasswordHash(input.password)
    const now = new Date().toISOString()

    await authCredentialRepository.create({
      profileId: profile.id,
      username: normalizedUsername,
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
      createdAt: now,
      updatedAt: now,
    })

    await appStateRepository.setCurrentProfileId(profile.id)
    return profile
  }

  async resetPassword(input: LoginCredentials) {
    void input
    throw new Error('Reset hasła jest niedostępny lokalnie. Zaloguj się i użyj opcji "Zmień hasło".')
  }

  async changePassword(profileId: string, input: { currentPassword: string; newPassword: string }) {
    const credentials = await authCredentialRepository.getByProfileId(profileId)

    if (!credentials) {
      throw new Error('Brak danych logowania dla profilu')
    }

    const isCurrentPasswordValid = await verifyPassword(input.currentPassword, credentials.passwordSalt, credentials.passwordHash)

    if (!isCurrentPasswordValid) {
      throw new Error('Nieprawidłowe obecne hasło')
    }

    const passwordData = await createPasswordHash(input.newPassword)
    await authCredentialRepository.updatePassword(profileId, {
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
    })
  }

  async logout() {
    await appStateRepository.setCurrentProfileId(null)
  }
}

export const appAuthService = new AppAuthService()
