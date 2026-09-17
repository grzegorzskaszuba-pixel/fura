import { appStateRepository } from '@/data/repositories/app-state-repository'
import { authCredentialRepository } from '@/data/repositories/auth-credential-repository'
import { initializeDatabase } from '@/data/database/db'
import { profileRepository } from '@/data/repositories/profile-repository'
import type { AuthService } from '@/features/auth/auth-service'
import { createPasswordHash, verifyPassword } from '@/shared/lib/password'
import type { LoginCredentials, RegisterCredentials } from '@/shared/types/domain'

async function setAndReturnProfile(profileId: string) {
  const profile = await profileRepository.getById(profileId)

  if (!profile) {
    throw new Error('Profil nie istnieje')
  }

  await Promise.all([
    appStateRepository.setCurrentProfileId(profile.id),
    profileRepository.touch(profile.id),
    authCredentialRepository.touch(profile.id),
  ])
  return profile
}

export class AppAuthService implements AuthService {
  async getCurrentProfileId() {
    await initializeDatabase()
    return appStateRepository.getCurrentProfileId()
  }

  async login(input: LoginCredentials) {
    await initializeDatabase()
    const normalizedUsername = input.username.trim().toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedUsername)) {
      throw new Error('Podaj prawidłowy adres e-mail')
    }

    const credentials = await authCredentialRepository.getByUsername(normalizedUsername)

    if (!credentials) {
      throw new Error('Nie znaleziono profilu o podanej nazwie użytkownika')
    }

    const passwordValid = await verifyPassword(input.password, credentials.passwordSalt, credentials.passwordHash)

    if (!passwordValid) {
      throw new Error('Nieprawidłowe hasło')
    }

    const profile = await profileRepository.getById(credentials.profileId)

    if (profile && credentials.username !== normalizedUsername && normalizedUsername.endsWith('@fura.info')) {
      await Promise.all([
        profileRepository.upsert({ ...profile, username: normalizedUsername }),
        authCredentialRepository.updateUsername(credentials.profileId, normalizedUsername),
      ])
    }

    return setAndReturnProfile(credentials.profileId)
  }

  async register(input: RegisterCredentials) {
    await initializeDatabase()
    const normalizedUsername = input.username.trim().toLowerCase()
    const displayName = input.displayName?.trim() ?? ''

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedUsername)) {
      throw new Error('Podaj prawidłowy adres e-mail')
    }

    if (displayName.length < 2) {
      throw new Error('Podaj nazwę użytkownika')
    }

    const existingProfile = await profileRepository.getByUsername(normalizedUsername)

    if (existingProfile) {
      throw new Error('Taki profil już istnieje')
    }

    const profile = await profileRepository.create({
      username: normalizedUsername,
      displayName,
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
