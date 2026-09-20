import { appStateRepository } from '@/data/repositories/app-state-repository'
import { accountRepository } from '@/data/repositories/account-repository'
import { authCredentialRepository } from '@/data/repositories/auth-credential-repository'
import { initializeDatabase } from '@/data/database/db'
import { profileRepository } from '@/data/repositories/profile-repository'
import { LEGAL_DOCUMENTS } from '@/shared/constants/legal-documents'
import type { AuthService, RegistrationProfile } from '@/features/auth/auth-service'
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

  async register(input: RegisterCredentials): Promise<RegistrationProfile> {
    await initializeDatabase()
    const normalizedUsername = input.username.trim().toLowerCase()
    const displayName = input.displayName?.trim() ?? ''

    if (input.termsAccepted !== true) {
      throw new Error('Zaakceptuj Regulamin FURA, aby utworzyć profil')
    }

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
      termsVersion: LEGAL_DOCUMENTS.terms.version,
      termsAcceptedAt: new Date().toISOString(),
      privacyPolicyVersionPresented: LEGAL_DOCUMENTS.privacyPolicy.version,
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

  async verifyEmail(token: string) {
    void token
    throw new Error('Weryfikacja adresu e-mail jest dostępna tylko w trybie zdalnym.')
  }

  async resendVerificationEmail(username: string) {
    void username
    throw new Error('Ponowne wysłanie linku jest dostępne tylko w trybie zdalnym.')
  }

  async requestPasswordReset(username: string) {
    void username
    throw new Error('Odzyskiwanie hasła przez e-mail jest dostępne tylko w trybie zdalnym.')
  }

  async resetPassword(token: string, newPassword: string) {
    void token
    void newPassword
    throw new Error('Reset hasła przez e-mail jest dostępny tylko w trybie zdalnym.')
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

  async deleteAccount(profileId: string) {
    await initializeDatabase()
    await accountRepository.deleteByProfileId(profileId)
  }

  async logout() {
    await appStateRepository.setCurrentProfileId(null)
  }
}

export const appAuthService = new AppAuthService()
